import path from "path";
import fs from "fs";
import { Pool } from "pg";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { DatabaseWrapper } from "./types.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://user:password@localhost:5432/dbname";

export class PgWrapper implements DatabaseWrapper {
  public isPg = true;
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
    return params.map(p => typeof p === "undefined" ? null : p);
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
  async transaction<T>(callback: (tx: DatabaseWrapper) => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      const client = await this.pool.connect();
      const txWrapper: DatabaseWrapper = {
        isPg: true,
        exec: async (sql: string) => { await client.query(sql); },
        run: async (sql: string, params: any[] = []) => { 
          if (!Array.isArray(params)) params = [params];
          await client.query(this.convertSql(sql), this.mapParams(params)); 
        },
        get: async (sql: string, params: any[] = []) => { 
          if (!Array.isArray(params)) params = [params];
          const res = await client.query(this.convertSql(sql), this.mapParams(params)); 
          return res.rows[0]; 
        },
        all: async (sql: string, params: any[] = []) => { 
          if (!Array.isArray(params)) params = [params];
          const res = await client.query(this.convertSql(sql), this.mapParams(params)); 
          return res.rows; 
        },
        transaction: async <U>(cb: (tx: DatabaseWrapper) => Promise<U>) => cb(txWrapper)
      };

      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const result = await callback(txWrapper);
        await client.query("COMMIT");
        return result;
      } catch (e: any) {
        try {
          await client.query("ROLLBACK");
        } catch (rbErr) {
          console.warn("Rollback failed:", rbErr);
        }
        
        if (e.code === "40001" && attempt < maxRetries - 1) {
          attempt++;
          await new Promise(res => setTimeout(res, Math.floor(Math.random() * 50) + 10));
          continue;
        }
        
        throw e;
      } finally {
        client.release();
      }
    }
    throw new Error("Transaction failed after maximum retries");
  }
  async close() {
    await this.pool.end();
  }
}

export class SqliteWrapper implements DatabaseWrapper {
  public isPg = false;
  public db: any;
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
  async transaction<T>(callback: (tx: DatabaseWrapper) => Promise<T>): Promise<T> {
    await this.run("BEGIN IMMEDIATE");
    try {
      const result = await callback(this);
      await this.run("COMMIT");
      return result;
    } catch (e) {
      await this.run("ROLLBACK");
      throw e;
    }
  }
  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

export function extractTaskNumber(branchName: string | null | undefined): number | null {
  if (!branchName || typeof branchName !== "string") return null;
  const match = branchName.match(/(\d+)(?!.*\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      return num;
    }
  }
  return null;
}

export let activeSqlitePath: string = path.join(process.cwd(), "database.sqlite");

export async function purgeStaleUnverifiedUsers(db: any) {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      "DELETE FROM users WHERE authProvider = 'local' AND (emailVerified = 0 OR emailVerified IS NULL) AND createdAt IS NOT NULL AND createdAt < ?",
      [cutoffDate]
    );
  } catch (e) {
    console.error("Failed to purge stale unverified users:", e);
  }
}

export async function initDb(): Promise<DatabaseWrapper> {
  let db: DatabaseWrapper;
  const isDefaultPg = !process.env.DATABASE_URL || process.env.DATABASE_URL === "postgres://user:password@localhost:5432/dbname";
  
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
    console.log("Using SQLite database engine");
  }

  if (!usePg) {
    let DB_FILE = path.join(process.cwd(), "database.sqlite");
    activeSqlitePath = DB_FILE;
    
    let sqliteDb = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });

    try {
      await sqliteDb.exec("CREATE TABLE IF NOT EXISTS _sqlite_write_test (id INTEGER PRIMARY KEY);");
      await sqliteDb.run("INSERT INTO _sqlite_write_test (id) VALUES (NULL);");
      await sqliteDb.run("DELETE FROM _sqlite_write_test;");
    } catch (e: any) {
      if (e.message && e.message.includes("READONLY")) {
        console.warn("Database is read-only. Falling back to /tmp/database.sqlite");
        sqliteDb.close();
        const TMP_DB_FILE = "/tmp/database.sqlite";
        if (fs.existsSync(DB_FILE) && !fs.existsSync(TMP_DB_FILE)) {
          try { fs.copyFileSync(DB_FILE, TMP_DB_FILE); } catch (e) {}
        }
        try { fs.chmodSync(TMP_DB_FILE, 0o600); } catch (e) {}
        DB_FILE = TMP_DB_FILE;
        activeSqlitePath = TMP_DB_FILE;
        sqliteDb = await open({
          filename: DB_FILE,
          driver: sqlite3.Database
        });
      } else {
        throw e;
      }
    }

    db = new SqliteWrapper(sqliteDb);
    
    try {
      await db.exec("PRAGMA journal_mode = WAL;");
      await db.exec("PRAGMA synchronous = NORMAL;");
      await db.exec("PRAGMA foreign_keys = ON;");
    } catch (e) {
      console.warn("Failed to set PRAGMAs:", e);
    }
  }

  try {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'Available'
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
      milestoneId TEXT,
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

    CREATE TABLE IF NOT EXISTS project_members (
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', 
      joinedAt TEXT NOT NULL,
      PRIMARY KEY (projectId, userId)
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
    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_nonces (
      nonce TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL
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
    await db.exec('ALTER TABLE tasks ADD COLUMN milestoneId TEXT;');
  } catch(err) {}

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN orderIndex REAL DEFAULT 0;');
  } catch(err) {}

  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN projectId TEXT");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE projects ADD COLUMN projectKey TEXT;");
  } catch (e) {}
  
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN taskCounter INTEGER DEFAULT 0;");
  } catch(e) {}

  const projectsWithoutKey = await db.all("SELECT id FROM projects WHERE projectKey IS NULL OR projectKey = ''");
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const p of projectsWithoutKey) {
    const randomLetters = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await db.run("UPDATE projects SET projectKey = ? WHERE id = ?", [randomLetters, p.id]);
  }

  try {
    await db.exec("ALTER TABLE teams ADD COLUMN projectId TEXT");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE users ADD COLUMN skills TEXT DEFAULT '[]';");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE users ADD COLUMN rolePrefix TEXT;");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Available';");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE users ADD COLUMN tokenVersion INTEGER DEFAULT 1;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE users ADD COLUMN authProvider TEXT DEFAULT 'local';");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT;");
  } catch (e) {}

  try {
    await db.exec("UPDATE users SET tokenVersion = 1 WHERE tokenVersion IS NULL;");
    await db.exec("UPDATE users SET authProvider = 'local' WHERE authProvider IS NULL;");
    await db.exec("UPDATE users SET emailVerified = 1 WHERE emailVerified IS NULL;");
  } catch (e) {}

  await purgeStaleUnverifiedUsers(db);

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS project_columns (
        id TEXT PRIMARY KEY,
        projectId TEXT UNIQUE NOT NULL,
        columnsJson TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE projects ADD COLUMN repoProvider TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN repoOwner TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN repoName TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN repoUrl TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN repoToken TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE projects ADD COLUMN defaultBranch TEXT DEFAULT 'main';");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN prUrl TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN prStatus TEXT;");
  } catch (e) {}

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    if (db.isPg) {
      await db.run("INSERT INTO settings (key, value) VALUES ('manager_prefix', 'Engineering') ON CONFLICT (key) DO NOTHING");
      await db.run("INSERT INTO settings (key, value) VALUES ('developer_prefix', 'Lead') ON CONFLICT (key) DO NOTHING");
    } else {
      await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('manager_prefix', 'Engineering')");
      await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('developer_prefix', 'Lead')");
    }
  } catch (e) {
    console.error("Failed to create/seed settings table:", e);
  }

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_custom INTEGER DEFAULT 0,
        permissions TEXT
      );
    `);
    try {
      await db.exec("ALTER TABLE roles ADD COLUMN permissions TEXT;");
    } catch (alterError) {}
    
    const defaultRoles = [
      { id: "super_admin", name: "Super Admin", description: "Full uninhibited system control", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":true,"manage_projects":true,"manage_teams":true,"manage_users":true,"manage_roles":true,"reset_database":true}' },
      { id: "admin", name: "Admin", description: "Standard administrator managed by Super Admin", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":true,"manage_projects":true,"manage_teams":true,"manage_users":true,"manage_roles":false,"reset_database":false}' },
      { id: "manager", name: "Manager", description: "Can manage projects, teams, and tasks", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":true,"manage_projects":true,"manage_teams":true,"manage_users":false,"manage_roles":false}' },
      { id: "developer", name: "Developer", description: "Core developer role to build and claim tasks", is_custom: 0, permissions: '{"create_tasks":false,"edit_all_tasks":false,"delete_tasks":false,"manage_projects":false,"manage_teams":false,"manage_users":false,"manage_roles":false}' },
      { id: "designer", name: "Designer", description: "Can design user interfaces and experiences", is_custom: 0, permissions: '{"create_tasks":false,"edit_all_tasks":false,"delete_tasks":false,"manage_projects":false,"manage_teams":false,"manage_users":false,"manage_roles":false}' },
      { id: "qa", name: "QA Engineer", description: "Can test and verify task completions", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":false,"manage_projects":false,"manage_teams":false,"manage_users":false,"manage_roles":false}' },
      { id: "product_owner", name: "Product Owner", description: "Can manage roadmap and verify milestones", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":true,"manage_projects":true,"manage_teams":false,"manage_users":false,"manage_roles":false}' },
      { id: "scrum_master", name: "Scrum Master", description: "Facilitates agile processes and unblocks team", is_custom: 0, permissions: '{"create_tasks":true,"edit_all_tasks":true,"delete_tasks":false,"manage_projects":false,"manage_teams":true,"manage_users":false,"manage_roles":false}' },
      { id: "viewer", name: "Viewer", description: "Read-only access to view projects and boards", is_custom: 0, permissions: '{"create_tasks":false,"edit_all_tasks":false,"delete_tasks":false,"manage_projects":false,"manage_teams":false,"manage_users":false,"manage_roles":false}' }
    ];
    for (const role of defaultRoles) {
      if (db.isPg) {
        await db.run(
          "INSERT INTO roles (id, name, description, is_custom, permissions) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
          [role.id, role.name, role.description, role.is_custom, role.permissions]
        );
      } else {
        await db.run(
          "INSERT OR IGNORE INTO roles (id, name, description, is_custom, permissions) VALUES (?, ?, ?, ?, ?)",
          [role.id, role.name, role.description, role.is_custom, role.permissions]
        );
      }
      await db.run(
        "UPDATE roles SET permissions = ? WHERE id = ? AND (permissions IS NULL OR permissions = '')",
        [role.permissions, role.id]
      );
    }
  } catch (e) {
    console.error("Failed to create/seed roles table:", e);
  }

  try {
    const existingProjects = await db.all("SELECT id, ownerId, createdAt FROM projects");
    for (const p of existingProjects) {
      if (db.isPg) {
        await db.run("INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?) ON CONFLICT (projectId, userId) DO NOTHING", [p.id, p.ownerId, p.createdAt]);
      } else {
        await db.run("INSERT OR IGNORE INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?)", [p.id, p.ownerId, p.createdAt]);
      }
    }
  } catch(e) {}

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
            "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, projectId, milestoneId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [t.id, t.title, t.description, t.status, t.priority, t.deadline, t.assigneeId, t.creatorId, t.branchName, t.parentId || null, t.projectId || null, t.milestoneId || null, t.createdAt]
          );
        }
        console.log("Migrated data from db.json to database.sqlite");
      }
      fs.renameSync(JSON_DB_FILE, JSON_DB_FILE + ".bak");
    } catch (e) {
      console.error("Migration error", e);
    }
  }

  try {
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigneeId ON tasks(assigneeId);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_activities_taskId ON task_activities(taskId);
      CREATE INDEX IF NOT EXISTS idx_task_comments_taskId ON task_comments(taskId);
      CREATE INDEX IF NOT EXISTS idx_project_members_userId ON project_members(userId);
      CREATE INDEX IF NOT EXISTS idx_team_members_userId ON team_members(userId);
      CREATE INDEX IF NOT EXISTS idx_task_dependencies_blocked ON task_dependencies(blockedByTaskId);
      CREATE INDEX IF NOT EXISTS idx_documents_projectId ON documents(projectId);
      CREATE INDEX IF NOT EXISTS idx_milestones_projectId ON milestones(projectId);
    `);
  } catch (idxErr) {}

} catch (error) {
  console.warn("DB Connection/Init Error. The app will run, but DB features will fail until DATABASE_URL is correct:", error);
}

  return db;
}

export let dbPromise: Promise<DatabaseWrapper> = initDb();

export async function getDb(): Promise<DatabaseWrapper> {
  return await dbPromise;
}
