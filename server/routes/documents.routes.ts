import express, { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { dbPromise } from "../db.js";
import {
  authenticateToken,
  isAdminOrSuperAdmin,
  checkProjectAccess,
  checkProjectWriteAccess
} from "../middleware/auth.js";
import { AuthRequest } from "../types.js";

export const documentsRouter = express.Router();
const router = documentsRouter;

// Documents APIs

router.get("/projects/:projectId/documents", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const docs = await db.all(
      "SELECT * FROM documents WHERE projectId = ? ORDER BY updatedAt DESC",
      req.params.projectId
    );
    res.json(docs);
  } catch (err: any) {
    console.error("Error fetching project documents:", err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.post("/projects/:projectId/documents", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectWriteAccess(db, req.params.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    const { title, content } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Document title is required" });
    }
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      "INSERT INTO documents (id, projectId, title, content, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, req.params.projectId, title.trim(), content || "", req.user?.id, now, now]
    );

    const doc = await db.get("SELECT * FROM documents WHERE id = ?", id);
    res.status(201).json(doc);
  } catch (err: any) {
    console.error("Error creating document:", err);
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.get("/documents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!(await checkProjectAccess(db, doc.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(doc);
  } catch (err: any) {
    console.error("Error fetching document:", err);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

router.put("/documents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
    if (!docCheck) return res.status(404).json({ error: "Document not found" });
    if (!(await checkProjectWriteAccess(db, docCheck.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    const { title, content } = req.body;
    const now = new Date().toISOString();

    await db.run(
      "UPDATE documents SET title = COALESCE(?, title), content = COALESCE(?, content), updatedAt = ? WHERE id = ?",
      [title !== undefined ? title.trim() : null, content, now, req.params.id]
    );

    const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
    res.json(doc);
  } catch (err: any) {
    console.error("Error updating document:", err);
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/documents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
    if (!docCheck) return res.status(404).json({ error: "Document not found" });
    if (!(await checkProjectWriteAccess(db, docCheck.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    await db.run("DELETE FROM documents WHERE id = ?", req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting document:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Milestones APIs

router.get("/milestones", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    let milestones = [];
    if (isAdminOrSuperAdmin(req.user)) {
      milestones = await db.all("SELECT * FROM milestones");
    } else {
      milestones = await db.all(
        `
        SELECT DISTINCT m.* 
        FROM milestones m
        LEFT JOIN projects p ON m.projectId = p.id
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        WHERE p.ownerId = ? OR pm.userId = ? OR tm.userId = ?
      `,
        [req.user?.id, req.user?.id, req.user?.id]
      );
    }
    res.json(milestones);
  } catch (err: any) {
    console.error("Error fetching milestones:", err);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.get("/projects/:projectId/milestones", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const milestones = await db.all(
      "SELECT * FROM milestones WHERE projectId = ? ORDER BY startDate ASC",
      req.params.projectId
    );
    res.json(milestones);
  } catch (err: any) {
    console.error("Error fetching project milestones:", err);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.post("/projects/:projectId/milestones", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectWriteAccess(db, req.params.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    const { name, description, startDate, endDate, status } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Milestone name is required" });
    }
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      "INSERT INTO milestones (id, projectId, name, description, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        req.params.projectId,
        name.trim(),
        description || "",
        startDate || null,
        endDate || null,
        status || "pending",
        now
      ]
    );

    const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", id);
    res.status(201).json(milestone);
  } catch (err: any) {
    console.error("Error creating milestone:", err);
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.put("/milestones/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
    if (!msCheck) return res.status(404).json({ error: "Milestone not found" });
    if (!(await checkProjectWriteAccess(db, msCheck.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    const { name, description, startDate, endDate, status } = req.body;

    await db.run(
      "UPDATE milestones SET name = COALESCE(?, name), description = COALESCE(?, description), startDate = COALESCE(?, startDate), endDate = COALESCE(?, endDate), status = COALESCE(?, status) WHERE id = ?",
      [name, description, startDate, endDate, status, req.params.id]
    );

    const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", req.params.id);
    res.json(milestone);
  } catch (err: any) {
    console.error("Error updating milestone:", err);
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

router.delete("/milestones/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
    if (!msCheck) return res.status(404).json({ error: "Milestone not found" });
    if (!(await checkProjectWriteAccess(db, msCheck.projectId, req.user))) {
      return res.status(403).json({ error: "Access denied. Viewers have read-only access to this project." });
    }
    await db.run("DELETE FROM milestones WHERE id = ?", req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting milestone:", err);
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});
