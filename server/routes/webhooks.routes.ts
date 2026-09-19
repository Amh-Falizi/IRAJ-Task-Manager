import { Router } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken, isProjectAdminOrOwner } from "../middleware/auth.js";
import { dbPromise } from "../db.js";
import { webhookService } from "../services/webhook.service.js";

export const webhooksRouter = Router();

// Inbound GitHub webhook endpoint
webhooksRouter.post("/webhooks/github", async (req: any, res: any) => {
  const event = req.headers["x-github-event"] as string;
  const signature = req.headers["x-hub-signature-256"] as string;

  if (!event) {
    return res.status(400).json({ error: "Missing X-GitHub-Event header" });
  }

  try {
    const result = await webhookService.handleGitHubWebhook(event, req.body, signature);
    res.json(result);
  } catch (err: any) {
    console.error("[Webhook GitHub] Error processing:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Inbound GitLab webhook endpoint
webhooksRouter.post("/webhooks/gitlab", async (req: any, res: any) => {
  const event = req.headers["x-gitlab-event"] as string;
  const token = req.headers["x-gitlab-token"] as string;

  if (!event) {
    return res.status(400).json({ error: "Missing X-Gitlab-Event header" });
  }

  try {
    const result = await webhookService.handleGitLabWebhook(event, req.body, token);
    res.json(result);
  } catch (err: any) {
    console.error("[Webhook GitLab] Error processing:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// List outbound webhooks for a project
webhooksRouter.get("/projects/:projectId/webhooks", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { projectId } = req.params;

    const webhooks = await db.all(
      "SELECT id, projectId, url, events, active, createdAt FROM webhooks WHERE projectId = ? ORDER BY createdAt DESC",
      [projectId]
    );

    res.json(
      webhooks.map((w: any) => ({
        ...w,
        events: (() => {
          try {
            return JSON.parse(w.events);
          } catch {
            return [w.events];
          }
        })(),
        active: Boolean(w.active)
      }))
    );
  } catch (err: any) {
    console.error("Error fetching webhooks:", err);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

// Create outbound webhook for a project
webhooksRouter.post("/projects/:projectId/webhooks", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { projectId } = req.params;
    const { url, secret, events } = req.body;

    const isAdmin = await isProjectAdminOrOwner(db, projectId, req.user);
    if (!isAdmin) {
      return res.status(403).json({ error: "Only project administrators can manage webhooks" });
    }

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return res.status(400).json({ error: "Valid HTTP/HTTPS webhook URL is required" });
    }

    const webhookId = uuidv4();
    const eventsJson = JSON.stringify(Array.isArray(events) && events.length > 0 ? events : ["*"]);
    const createdAt = new Date().toISOString();

    await db.run(
      "INSERT INTO webhooks (id, projectId, url, secret, events, active, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)",
      [webhookId, projectId, url, secret || null, eventsJson, createdAt]
    );

    res.status(201).json({
      id: webhookId,
      projectId,
      url,
      events: JSON.parse(eventsJson),
      active: true,
      createdAt
    });
  } catch (err: any) {
    console.error("Error creating webhook:", err);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

// Delete outbound webhook
webhooksRouter.delete("/projects/:projectId/webhooks/:webhookId", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { projectId, webhookId } = req.params;

    const isAdmin = await isProjectAdminOrOwner(db, projectId, req.user);
    if (!isAdmin) {
      return res.status(403).json({ error: "Only project administrators can delete webhooks" });
    }

    await db.run("DELETE FROM webhooks WHERE id = ? AND projectId = ?", [webhookId, projectId]);
    await db.run("DELETE FROM webhook_deliveries WHERE webhookId = ?", [webhookId]);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting webhook:", err);
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

// Test trigger an outbound webhook
webhooksRouter.post("/projects/:projectId/webhooks/:webhookId/test", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { projectId, webhookId } = req.params;

    const webhook = await db.get("SELECT * FROM webhooks WHERE id = ? AND projectId = ?", [
      webhookId,
      projectId
    ]);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    // Trigger test event
    await webhookService.dispatchProjectEvent(projectId, "webhook.test", {
      test: true,
      message: "This is a test delivery from DevTeam Task Manager",
      triggeredBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      }
    });

    res.json({ success: true, message: "Test delivery dispatched" });
  } catch (err: any) {
    console.error("Error testing webhook:", err);
    res.status(500).json({ error: "Failed to test webhook" });
  }
});

// List recent deliveries for a webhook
webhooksRouter.get("/projects/:projectId/webhooks/:webhookId/deliveries", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { webhookId } = req.params;

    const deliveries = await db.all(
      "SELECT id, webhookId, event, statusCode, responseBody, createdAt FROM webhook_deliveries WHERE webhookId = ? ORDER BY createdAt DESC LIMIT 20",
      [webhookId]
    );

    res.json(deliveries);
  } catch (err: any) {
    console.error("Error fetching deliveries:", err);
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});
