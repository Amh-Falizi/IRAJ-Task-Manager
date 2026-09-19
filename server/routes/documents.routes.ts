import express from "express";
import { v4 as uuidv4 } from "uuid";
import { dbPromise } from "../db.js";
import {
  authenticateToken,
  isAdminOrSuperAdmin,
  checkProjectAccess
} from "../middleware/auth.js";

export const documentsRouter = express.Router();
const router = documentsRouter;

// Documents APIs

router.get("/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const docs = await db.all("SELECT * FROM documents WHERE projectId = ? ORDER BY updatedAt DESC", req.params.projectId);
  res.json(docs);
});

router.post("/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { title, content } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db.run(
    "INSERT INTO documents (id, projectId, title, content, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.projectId, title, content || "", req.user.id, now, now]
  );
  
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", id);
  res.json(doc);
});

router.get("/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  if (!doc) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, doc.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(doc);
});

router.put("/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
  if (!docCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, docCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { title, content } = req.body;
  const now = new Date().toISOString();
  
  await db.run(
    "UPDATE documents SET title = COALESCE(?, title), content = COALESCE(?, content), updatedAt = ? WHERE id = ?",
    [title, content, now, req.params.id]
  );
  
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  res.json(doc);
});

router.delete("/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
  if (!docCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, docCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  await db.run("DELETE FROM documents WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Milestones APIs
router.get("/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  let milestones = [];
  if (isAdminOrSuperAdmin(req.user)) {
    milestones = await db.all("SELECT * FROM milestones");
  } else {
    milestones = await db.all(`
      SELECT DISTINCT m.* 
      FROM milestones m
      LEFT JOIN projects p ON m.projectId = p.id
      LEFT JOIN project_members pm ON p.id = pm.projectId
      LEFT JOIN team_projects tp ON p.id = tp.projectId
      LEFT JOIN team_members tm ON tp.teamId = tm.teamId
      WHERE p.ownerId = ? OR pm.userId = ? OR tm.userId = ?
    `, [req.user.id, req.user.id, req.user.id]);
  }
  res.json(milestones);
});

router.get("/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const milestones = await db.all("SELECT * FROM milestones WHERE projectId = ? ORDER BY startDate ASC", req.params.projectId);
  res.json(milestones);
});

router.post("/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { name, description, startDate, endDate, status } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db.run(
    "INSERT INTO milestones (id, projectId, name, description, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.projectId, name, description, startDate, endDate, status || "pending", now]
  );
  
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", id);
  res.json(milestone);
});

router.put("/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
  if (!msCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, msCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { name, description, startDate, endDate, status } = req.body;
  
  await db.run(
    "UPDATE milestones SET name = COALESCE(?, name), description = COALESCE(?, description), startDate = COALESCE(?, startDate), endDate = COALESCE(?, endDate), status = COALESCE(?, status) WHERE id = ?",
    [name, description, startDate, endDate, status, req.params.id]
  );
  
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", req.params.id);
  res.json(milestone);
});

router.delete("/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
  if (!msCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, msCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  await db.run("DELETE FROM milestones WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// --- DATABASE BACKUP AND RESTORE APIS ---
