import { Router, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { dbPromise } from "../db.js";
import { eventsService } from "../services/events.service.js";
import { AuthRequest } from "../types.js";

export const eventsRouter = Router();

// Server-Sent Events stream
eventsRouter.get("/events", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const projectId = req.query.projectId as string | undefined;

    const clientId = eventsService.registerClient(userId, userRole, res, projectId);

    req.on("close", () => {
      eventsService.unregisterClient(clientId);
    });
  } catch (err: any) {
    console.error("Error registering SSE client:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to establish events stream" });
    }
  }
});

// Get user notifications
eventsRouter.get("/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const userId = req.user!.id;

    const notifications = await db.all(
      "SELECT id, userId, type, title, message, link, read, createdAt FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50",
      [userId]
    );

    const unreadResult = await db.get(
      "SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0",
      [userId]
    );

    const unreadCount = Number(unreadResult?.count || 0);

    res.json({
      notifications: notifications.map((n: any) => ({
        ...n,
        isRead: Boolean(n.read)
      })),
      unreadCount
    });
  } catch (err: any) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark single notification as read
eventsRouter.patch("/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const { id } = req.params;
    const userId = req.user!.id;

    await db.run(
      "UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?",
      [id, userId]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all notifications as read
eventsRouter.post("/notifications/read-all", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const userId = req.user!.id;

    await db.run(
      "UPDATE notifications SET read = 1 WHERE userId = ?",
      [userId]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// Delete a notification
eventsRouter.delete("/notifications/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const { id } = req.params;
    const userId = req.user!.id;

    await db.run(
      "DELETE FROM notifications WHERE id = ? AND userId = ?",
      [id, userId]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});
