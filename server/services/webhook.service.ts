import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { dbPromise } from "../db.js";
import { decryptSecret } from "../config.js";
import { eventsService } from "./events.service.js";

export interface OutboundWebhookRecord {
  id: string;
  projectId: string;
  url: string;
  secret?: string;
  events: string;
  active: number;
  createdAt: string;
}

export function isSafeWebhookUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();

    // Block loopback, internal domains, cloud metadata
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "[::]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.includes("metadata.google.internal")
    ) {
      return false;
    }

    // Check if hostname is an IPv4 address
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const p1 = parseInt(ipv4Match[1], 10);
      const p2 = parseInt(ipv4Match[2], 10);
      // Loopback: 127.0.0.0/8
      if (p1 === 127) return false;
      // 0.0.0.0/8
      if (p1 === 0) return false;
      // Private Class A: 10.0.0.0/8
      if (p1 === 10) return false;
      // Private Class B: 172.16.0.0/12
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      // Private Class C: 192.168.0.0/16
      if (p1 === 192 && p2 === 168) return false;
      // Link-local / Metadata: 169.254.0.0/16
      if (p1 === 169 && p2 === 254) return false;
      // Carrier-grade NAT: 100.64.0.0/10
      if (p1 === 100 && p2 >= 64 && p2 <= 127) return false;
      // Multicast: 224.0.0.0/4
      if (p1 >= 224) return false;
    }

    // Disallow hex or octal formatted IP strings
    if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export class WebhookService {
  /**
   * Dispatch an event to all configured outbound webhooks for a project
   */
  public async dispatchProjectEvent(
    projectId: string,
    event: string,
    payload: any
  ): Promise<void> {
    try {
      const db = await dbPromise;
      const webhooks = await db.all(
        "SELECT * FROM webhooks WHERE projectId = ? AND active = 1",
        [projectId]
      );

      if (!webhooks || webhooks.length === 0) return;

      const eventPayload = {
        id: uuidv4(),
        event,
        projectId,
        timestamp: new Date().toISOString(),
        data: payload
      };

      const payloadString = JSON.stringify(eventPayload);

      for (const webhook of webhooks) {
        let subscribedEvents: string[] = [];
        try {
          subscribedEvents = JSON.parse(webhook.events);
        } catch {
          subscribedEvents = [webhook.events];
        }

        // Check if webhook is subscribed to this event or wildcard
        const isSubscribed =
          subscribedEvents.includes("*") ||
          subscribedEvents.includes(event) ||
          subscribedEvents.some((e: string) => e.endsWith(".*") && event.startsWith(e.slice(0, -2)));

        if (!isSubscribed) continue;

        // Dispatch in background with retry logic
        this.deliverWebhook(webhook, event, payloadString, 1).catch((err) => {
          console.error(`[Webhook] Delivery error for ${webhook.id}:`, err.message);
        });
      }
    } catch (err: any) {
      console.error("[Webhook] Failed dispatching project event:", err.message);
    }
  }

  private async deliverWebhook(
    webhook: OutboundWebhookRecord,
    event: string,
    payloadString: string,
    attempt: number = 1
  ): Promise<void> {
    const db = await dbPromise;
    const deliveryId = uuidv4();

    // Check SSRF protection
    if (!isSafeWebhookUrl(webhook.url)) {
      console.warn(`[Webhook] Blocked outbound dispatch to forbidden SSRF address: ${webhook.url}`);
      try {
        await db.run(
          "INSERT INTO webhook_deliveries (id, webhookId, event, statusCode, responseBody, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            deliveryId,
            webhook.id,
            event,
            400,
            "Error: Forbidden destination URL (SSRF protection)",
            payloadString.slice(0, 2000),
            new Date().toISOString()
          ]
        );
      } catch {}
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "DevTeam-TaskManager-Webhook/1.0",
      "X-Event-Type": event,
      "X-Delivery-Id": deliveryId,
      "X-Delivery-Attempt": String(attempt)
    };

    if (webhook.secret) {
      const rawSecret = decryptSecret(webhook.secret) || webhook.secret;
      const signature = crypto
        .createHmac("sha256", rawSecret)
        .update(payloadString)
        .digest("hex");
      headers["X-Signature-SHA256"] = `sha256=${signature}`;
    }

    let statusCode = 0;
    let responseBody = "";
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(8000)
      });

      statusCode = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 1000); // cap response size
      success = response.ok;
    } catch (err: any) {
      statusCode = 500;
      responseBody = `Error: ${err.message}`;
    }

    try {
      await db.run(
        "INSERT INTO webhook_deliveries (id, webhookId, event, statusCode, responseBody, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          deliveryId,
          webhook.id,
          event,
          statusCode,
          responseBody,
          payloadString.slice(0, 2000),
          new Date().toISOString()
        ]
      );
    } catch (logErr: any) {
      console.error("[Webhook] Failed to log webhook delivery:", logErr.message);
    }

    // Retry with backoff if failed and attempts < 3
    if (!success && attempt < 3) {
      const backoffMs = attempt === 1 ? 2000 : 5000;
      setTimeout(() => {
        this.deliverWebhook(webhook, event, payloadString, attempt + 1).catch(() => {});
      }, backoffMs);
    }
  }

  /**
   * Process inbound GitHub webhooks with cryptographic HMAC signature verification
   */
  public async handleGitHubWebhook(
    event: string,
    payload: any,
    rawBody: Buffer | string | undefined,
    signatureHeader?: string,
    projectIdParam?: string
  ): Promise<{ success: boolean; message: string }> {
    const db = await dbPromise;

    if (event === "ping") {
      return { success: true, message: "PONG" };
    }

    const repoFullName = payload.repository?.full_name; // e.g. owner/repo
    let project: any = null;

    if (projectIdParam) {
      project = await db.get("SELECT * FROM projects WHERE id = ?", [projectIdParam]);
    } else if (repoFullName) {
      const [owner, name] = repoFullName.split("/");
      project = await db.get(
        "SELECT * FROM projects WHERE (repoOwner = ? AND repoName = ?) OR (repoUrl LIKE ?)",
        [owner, name, `%${repoFullName}%`]
      );
    }

    if (!project) {
      throw new Error("Target project not found for repository payload");
    }

    if (!project.webhookSecret) {
      throw new Error("Project webhook secret is not configured");
    }

    const secret = decryptSecret(project.webhookSecret);
    if (!secret) {
      throw new Error("Unable to decrypt project webhook secret");
    }

    if (!signatureHeader) {
      throw new Error("Missing X-Hub-Signature-256 header");
    }

    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : typeof rawBody === "string"
      ? Buffer.from(rawBody, "utf8")
      : Buffer.from(JSON.stringify(payload), "utf8");

    const expectedSignature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(bodyBuffer)
      .digest("hex")}`;

    const sigBuf = Buffer.from(signatureHeader);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new Error("Invalid GitHub webhook signature");
    }

    if (event === "pull_request") {
      const action = payload.action;
      const pr = payload.pull_request;
      if (!pr) return { success: false, message: "Missing pull_request in payload" };

      const prUrl = pr.html_url;
      const prNumber = pr.number;
      const branchName = pr.head?.ref;
      const merged = pr.merged || false;
      const state = pr.state;
      let prStatus = state;
      if (merged) prStatus = "merged";

      // Find tasks scoped strictly to this validated project
      let tasksToUpdate: any[] = [];
      if (prUrl) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE projectId = ? AND (prUrl = ? OR prUrl LIKE ?)",
          [project.id, prUrl, `%/pull/${prNumber}`]
        );
      }

      if (tasksToUpdate.length === 0 && branchName) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE projectId = ? AND branchName = ?",
          [project.id, branchName]
        );
      }

      for (const task of tasksToUpdate) {
        let newStatus = task.status;
        if (prStatus === "merged" && task.status !== "done") {
          newStatus = "done";
        } else if (prStatus === "open" && (task.status === "todo" || task.status === "backlog")) {
          newStatus = "review";
        }

        await db.run(
          "UPDATE tasks SET prUrl = ?, prStatus = ?, status = ? WHERE id = ? AND projectId = ?",
          [prUrl, prStatus, newStatus, task.id, project.id]
        );

        // Record activity
        const activityId = uuidv4();
        const actionDesc = `GitHub Webhook: PR #${prNumber} ${action} (${prStatus}). Board status updated to '${newStatus}'`;
        await db.run(
          "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
          [activityId, task.id, "system", actionDesc, new Date().toISOString()]
        );

        // Notify assignee & creator
        const recipients = new Set<string>();
        if (task.assigneeId) recipients.add(task.assigneeId);
        if (task.creatorId) recipients.add(task.creatorId);

        for (const recipientId of recipients) {
          await eventsService.notifyUser(recipientId, {
            type: "webhook",
            title: `PR #${prNumber} ${action}`,
            message: `Task "${task.title}" status updated to ${newStatus}`,
            link: `/board?taskId=${task.id}`
          });
        }

        // Broadcast minimal scoped notification envelope
        eventsService.broadcast({
          type: "task:updated",
          data: {
            taskId: task.id,
            projectId: task.projectId,
            action: "updated"
          },
          projectId: task.projectId
        });
      }

      return {
        success: true,
        message: `Processed GitHub PR #${prNumber} for project ${project.name}, updated ${tasksToUpdate.length} linked tasks.`
      };
    }

    return { success: true, message: `Event ${event} ignored` };
  }

  /**
   * Process inbound GitLab webhooks with token verification
   */
  public async handleGitLabWebhook(
    event: string,
    payload: any,
    tokenHeader?: string,
    projectIdParam?: string
  ): Promise<{ success: boolean; message: string }> {
    const db = await dbPromise;

    const projectPath = payload.project?.path_with_namespace;
    let project: any = null;

    if (projectIdParam) {
      project = await db.get("SELECT * FROM projects WHERE id = ?", [projectIdParam]);
    } else if (projectPath) {
      const parts = projectPath.split("/");
      const name = parts.pop();
      const owner = parts.join("/");
      project = await db.get(
        "SELECT * FROM projects WHERE (repoOwner = ? AND repoName = ?) OR (repoUrl LIKE ?)",
        [owner, name, `%${projectPath}%`]
      );
    }

    if (!project) {
      throw new Error("Target project not found for GitLab repository");
    }

    if (!project.webhookSecret) {
      throw new Error("Project webhook secret is not configured");
    }

    const secret = decryptSecret(project.webhookSecret);
    if (!secret) {
      throw new Error("Unable to decrypt project webhook secret");
    }

    if (!tokenHeader) {
      throw new Error("Missing X-Gitlab-Token header");
    }

    const tokenBuf = Buffer.from(tokenHeader);
    const expectedBuf = Buffer.from(secret);

    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      throw new Error("Invalid GitLab webhook token");
    }

    if (event === "Merge Request Hook") {
      const objAttrs = payload.object_attributes;
      if (!objAttrs) return { success: false, message: "Missing object_attributes" };

      const mrUrl = objAttrs.url;
      const mrIid = objAttrs.iid;
      const branchName = objAttrs.source_branch;
      const state = objAttrs.state;
      let prStatus = state === "opened" ? "open" : state;

      let tasksToUpdate: any[] = [];
      if (mrUrl) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE projectId = ? AND (prUrl = ? OR prUrl LIKE ?)",
          [project.id, mrUrl, `%/merge_requests/${mrIid}`]
        );
      }

      if (tasksToUpdate.length === 0 && branchName) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE projectId = ? AND branchName = ?",
          [project.id, branchName]
        );
      }

      for (const task of tasksToUpdate) {
        let newStatus = task.status;
        if (prStatus === "merged" && task.status !== "done") {
          newStatus = "done";
        } else if (prStatus === "open" && (task.status === "todo" || task.status === "backlog")) {
          newStatus = "review";
        }

        await db.run(
          "UPDATE tasks SET prUrl = ?, prStatus = ?, status = ? WHERE id = ? AND projectId = ?",
          [mrUrl, prStatus, newStatus, task.id, project.id]
        );

        const activityId = uuidv4();
        const actionDesc = `GitLab Webhook: MR !${mrIid} ${state}. Board status updated to '${newStatus}'`;
        await db.run(
          "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
          [activityId, task.id, "system", actionDesc, new Date().toISOString()]
        );

        const recipients = new Set<string>();
        if (task.assigneeId) recipients.add(task.assigneeId);
        if (task.creatorId) recipients.add(task.creatorId);

        for (const recipientId of recipients) {
          await eventsService.notifyUser(recipientId, {
            type: "webhook",
            title: `GitLab MR !${mrIid} ${state}`,
            message: `Task "${task.title}" updated to ${newStatus}`,
            link: `/board?taskId=${task.id}`
          });
        }

        eventsService.broadcast({
          type: "task:updated",
          data: {
            taskId: task.id,
            projectId: task.projectId,
            action: "updated"
          },
          projectId: task.projectId
        });
      }

      return {
        success: true,
        message: `Processed GitLab MR !${mrIid} for project ${project.name}, updated ${tasksToUpdate.length} tasks.`
      };
    }

    return { success: true, message: `Event ${event} ignored` };
  }
}

export const webhookService = new WebhookService();
