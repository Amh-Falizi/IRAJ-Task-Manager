import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { dbPromise } from "../db.js";
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

        // Dispatch in background
        this.deliverWebhook(webhook, event, payloadString).catch((err) => {
          console.error(`[Webhook] Delivery failed for ${webhook.id}:`, err.message);
        });
      }
    } catch (err: any) {
      console.error("[Webhook] Failed dispatching project event:", err.message);
    }
  }

  private async deliverWebhook(
    webhook: OutboundWebhookRecord,
    event: string,
    payloadString: string
  ): Promise<void> {
    const db = await dbPromise;
    const deliveryId = uuidv4();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "DevTeam-TaskManager-Webhook/1.0",
      "X-Event-Type": event,
      "X-Delivery-Id": deliveryId
    };

    if (webhook.secret) {
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(payloadString)
        .digest("hex");
      headers["X-Signature-SHA256"] = `sha256=${signature}`;
    }

    let statusCode = 0;
    let responseBody = "";

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(8000)
      });

      statusCode = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 1000); // cap size
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
  }

  /**
   * Process inbound GitHub webhooks
   */
  public async handleGitHubWebhook(
    event: string,
    payload: any,
    signatureHeader?: string
  ): Promise<{ success: boolean; message: string }> {
    const db = await dbPromise;

    if (event === "ping") {
      return { success: true, message: "PONG" };
    }

    if (event === "pull_request") {
      const action = payload.action; // opened, closed, reopened, synchronize
      const pr = payload.pull_request;
      if (!pr) return { success: false, message: "Missing pull_request in payload" };

      const prUrl = pr.html_url;
      const prNumber = pr.number;
      const branchName = pr.head?.ref;
      const merged = pr.merged || false;
      const state = pr.state; // open, closed
      let prStatus = state;
      if (merged) prStatus = "merged";

      const repoFullName = payload.repository?.full_name; // e.g. owner/repo

      // Find matching project
      let project: any = null;
      if (repoFullName) {
        const [owner, name] = repoFullName.split("/");
        project = await db.get(
          "SELECT * FROM projects WHERE (repoOwner = ? AND repoName = ?) OR (repoUrl LIKE ?)",
          [owner, name, `%${repoFullName}%`]
        );
      }

      // Find tasks referencing this PR or branch
      let tasksToUpdate: any[] = [];
      if (prUrl) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE prUrl = ? OR prUrl LIKE ?",
          [prUrl, `%/pull/${prNumber}`]
        );
      }

      if (tasksToUpdate.length === 0 && branchName && project) {
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
          "UPDATE tasks SET prUrl = ?, prStatus = ?, status = ? WHERE id = ?",
          [prUrl, prStatus, newStatus, task.id]
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

        // Broadcast real-time SSE update so clients immediately re-render!
        eventsService.broadcast({
          type: "task:updated",
          data: {
            taskId: task.id,
            projectId: task.projectId,
            status: newStatus,
            prStatus,
            prUrl
          },
          projectId: task.projectId
        });
      }

      return {
        success: true,
        message: `Processed GitHub PR #${prNumber}, updated ${tasksToUpdate.length} linked tasks.`
      };
    }

    return { success: true, message: `Event ${event} ignored` };
  }

  /**
   * Process inbound GitLab webhooks
   */
  public async handleGitLabWebhook(
    event: string,
    payload: any,
    tokenHeader?: string
  ): Promise<{ success: boolean; message: string }> {
    const db = await dbPromise;

    if (event === "Merge Request Hook") {
      const objAttrs = payload.object_attributes;
      if (!objAttrs) return { success: false, message: "Missing object_attributes" };

      const mrUrl = objAttrs.url;
      const mrIid = objAttrs.iid;
      const branchName = objAttrs.source_branch;
      const state = objAttrs.state; // opened, closed, merged
      let prStatus = state === "opened" ? "open" : state;

      const projectPath = payload.project?.path_with_namespace;

      // Find matching project
      let project: any = null;
      if (projectPath) {
        const parts = projectPath.split("/");
        const name = parts.pop();
        const owner = parts.join("/");
        project = await db.get(
          "SELECT * FROM projects WHERE (repoOwner = ? AND repoName = ?) OR (repoUrl LIKE ?)",
          [owner, name, `%${projectPath}%`]
        );
      }

      let tasksToUpdate: any[] = [];
      if (mrUrl) {
        tasksToUpdate = await db.all(
          "SELECT * FROM tasks WHERE prUrl = ? OR prUrl LIKE ?",
          [mrUrl, `%/merge_requests/${mrIid}`]
        );
      }

      if (tasksToUpdate.length === 0 && branchName && project) {
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
          "UPDATE tasks SET prUrl = ?, prStatus = ?, status = ? WHERE id = ?",
          [mrUrl, prStatus, newStatus, task.id]
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
            status: newStatus,
            prStatus,
            prUrl: mrUrl
          },
          projectId: task.projectId
        });
      }

      return {
        success: true,
        message: `Processed GitLab MR !${mrIid}, updated ${tasksToUpdate.length} tasks.`
      };
    }

    return { success: true, message: `Event ${event} ignored` };
  }
}

export const webhookService = new WebhookService();
