import path from "path";
import fs from "fs";
import { Pool } from "pg";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { DatabaseWrapper } from "./types.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://user:password@localhost:5432/dbname";

const KNOWN_CAMEL_COLUMNS: Record<string, string> = {
  assigneeid: "assigneeId",
  creatorid: "creatorId",
  branchname: "branchName",
  prurl: "prUrl",
  prnumber: "prNumber",
  prstatus: "prStatus",
  prheadbranch: "prHeadBranch",
  prbasebranch: "prBaseBranch",
  prlastsyncedat: "prLastSyncedAt",
  ownerid: "ownerId",
  projectkey: "projectKey",
  taskcounter: "taskCounter",
  repoprovider: "repoProvider",
  repoowner: "repoOwner",
  reponame: "repoName",
  repourl: "repoUrl",
  repotoken: "repoToken",
  defaultbranch: "defaultBranch",
  webhooksecret: "webhookSecret",
  roleprefix: "rolePrefix",
  authprovider: "authProvider",
  oauthid: "oauthId",
  emailverified: "emailVerified",
  verificationtoken: "verificationToken",
  resettoken: "resetToken",
  resettokenexpiry: "resetTokenExpiry",
  tokenversion: "tokenVersion",
  createdat: "createdAt",
  updatedat: "updatedAt",
  duedate: "dueDate",
  tasknumber: "taskNumber",
  parentid: "parentId",
  orderindex: "orderIndex",
  projectid: "projectId",
  userid: "userId",
  teamid: "teamId",
  taskid: "taskId",
  blockedbytaskid: "blockedByTaskId",
  columnid: "columnId",
  columnsjson: "columnsJson",
  joinedat: "joinedAt",
  expiresat: "expiresAt",
  startdate: "startDate",
  enddate: "endDate",
  authorid: "authorId",
  passwordhash: "passwordHash",
  isdefault: "isDefault",
  isdone: "isDone",
  is_custom: "is_custom",
};

export function normalizePgRow<T = any>(row: T): T {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const normalized: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    const mapped = KNOWN_CAMEL_COLUMNS[key.toLowerCase()] || key;
    normalized[mapped] = val;
    if (mapped !== key) {
      normalized[key] = val;
    }
  }
  return normalized as T;
}

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
  async get<T = any>(sql: string, params: any | any[] = []): Promise<T | undefined> {
    if (!Array.isArray(params)) params = [params];
    const converted = this.convertSql(sql);
    const result = await this.pool.query(converted, this.mapParams(params));
    return normalizePgRow(result.rows[0]);
  }
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!Array.isArray(params)) params = [params];
    const converted = this.convertSql(sql);
    const result = await this.pool.query(converted, this.mapParams(params));
    return result.rows.map(normalizePgRow);
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
          return normalizePgRow(res.rows[0]); 
        },
        all: async (sql: string, params: any[] = []) => { 
          if (!Array.isArray(params)) params = [params];
          const res = await client.query(this.convertSql(sql), this.mapParams(params)); 
          return res.rows.map(normalizePgRow); 
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
  async get<T = any>(sql: string, params: any | any[] = []): Promise<T | undefined> {
    if (!Array.isArray(params)) params = [params];
    return await this.db.get(sql, ...params);
  }
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
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
  let db!: DatabaseWrapper;
  const rawUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";
  const isPgConfigured = /^postgres(ql)?:\/\//i.test(rawUrl) && rawUrl !== "postgres://user:password@localhost:5432/dbname";
  
  let usePg = false;
  if (isPgConfigured) {
    try {
      const pgTest = new PgWrapper(rawUrl);
      await pgTest.testConnection();
      db = pgTest;
      usePg = true;
      console.log("Connected to PostgreSQL successfully");
    } catch (e: any) {
      if (process.env.NODE_ENV === "production" || process.env.FAIL_ON_DB_CONNECT_ERROR === "true") {
        console.error("FATAL: Configured PostgreSQL connection failed in production mode:", e.message);
        throw new Error(`Configured PostgreSQL connection failed: ${e.message}`);
      }
      console.warn("PostgreSQL connection failed in development, falling back to SQLite:", e.message);
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
        if (process.env.NODE_ENV === "production" || process.env.FAIL_ON_DB_CONNECT_ERROR === "true") {
          console.error("FATAL: SQLite database file is read-only in production mode. Aborting to prevent data loss.");
          throw new Error("SQLite database file is read-only in production.");
        }
        console.warn("Database is read-only in development. Falling back to /tmp/database.sqlite");
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

interface Migration {
  id: number;
  name: string;
  up: (db: DatabaseWrapper) => Promise<void>;
}

async function safeAddColumn(db: DatabaseWrapper, table: string, column: string, typeDef: string) {
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef};`);
  } catch (err: any) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("duplicate column") || msg.includes("already exists") || msg.includes("duplicate")) {
      return;
    }
    console.warn(`[Migration] safeAddColumn warning on ${table}.${column}:`, err.message);
  }
}

const migrations: Migration[] = [
  {
    id: 1,
    name: "001_base_schema",
    up: async (db) => {
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
    }
  },
  {
    id: 2,
    name: "002_columns_and_defaults",
    up: async (db) => {
      await safeAddColumn(db, "tasks", "milestoneId", "TEXT");
      await safeAddColumn(db, "tasks", "orderIndex", "REAL DEFAULT 0");
      await safeAddColumn(db, "tasks", "projectId", "TEXT");
      await safeAddColumn(db, "projects", "projectKey", "TEXT");
      await safeAddColumn(db, "projects", "taskCounter", "INTEGER DEFAULT 0");
      await safeAddColumn(db, "teams", "projectId", "TEXT");
      await safeAddColumn(db, "users", "skills", "TEXT DEFAULT '[]'");
      await safeAddColumn(db, "users", "rolePrefix", "TEXT");
      await safeAddColumn(db, "users", "status", "TEXT DEFAULT 'Available'");
      await safeAddColumn(db, "users", "tokenVersion", "INTEGER DEFAULT 1");
      await safeAddColumn(db, "users", "authProvider", "TEXT DEFAULT 'local'");
      await safeAddColumn(db, "users", "emailVerified", "INTEGER DEFAULT 0");
      await safeAddColumn(db, "users", "createdAt", "TEXT");

      try {
        await db.exec("UPDATE users SET tokenVersion = 1 WHERE tokenVersion IS NULL;");
        await db.exec("UPDATE users SET authProvider = 'local' WHERE authProvider IS NULL;");
        await db.exec("UPDATE users SET emailVerified = 1 WHERE emailVerified IS NULL;");
      } catch (e) {}

      const projectsWithoutKey = await db.all("SELECT id FROM projects WHERE projectKey IS NULL OR projectKey = ''");
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const p of projectsWithoutKey) {
        const randomLetters = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        await db.run("UPDATE projects SET projectKey = ? WHERE id = ?", [randomLetters, p.id]);
      }
    }
  },
  {
    id: 3,
    name: "003_git_integration_and_project_columns",
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS project_columns (
          id TEXT PRIMARY KEY,
          projectId TEXT UNIQUE NOT NULL,
          columnsJson TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);
      await safeAddColumn(db, "projects", "repoProvider", "TEXT");
      await safeAddColumn(db, "projects", "repoOwner", "TEXT");
      await safeAddColumn(db, "projects", "repoName", "TEXT");
      await safeAddColumn(db, "projects", "repoUrl", "TEXT");
      await safeAddColumn(db, "projects", "repoToken", "TEXT");
      await safeAddColumn(db, "projects", "defaultBranch", "TEXT DEFAULT 'main'");
      await safeAddColumn(db, "tasks", "prUrl", "TEXT");
      await safeAddColumn(db, "tasks", "prStatus", "TEXT");
    }
  },
  {
    id: 4,
    name: "004_settings_and_roles",
    up: async (db) => {
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

      await db.exec(`
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          is_custom INTEGER DEFAULT 0,
          permissions TEXT
        );
      `);
      await safeAddColumn(db, "roles", "permissions", "TEXT");

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
    }
  },
  {
    id: 5,
    name: "005_project_members_and_indices",
    up: async (db) => {
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
    }
  },
  {
    id: 6,
    name: "006_notifications_and_webhooks",
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          link TEXT,
          read INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      `);
      await safeAddColumn(db, "projects", "webhookSecret", "TEXT");
    }
  },
  {
    id: 7,
    name: "007_outbound_webhooks",
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          url TEXT NOT NULL,
          secret TEXT,
          events TEXT NOT NULL,
          active INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_webhooks_projectId ON webhooks(projectId);
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id TEXT PRIMARY KEY,
          webhookId TEXT NOT NULL,
          event TEXT NOT NULL,
          statusCode INTEGER,
          responseBody TEXT,
          payload TEXT,
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhookId ON webhook_deliveries(webhookId);
      `);
    }
  }
];

async function runMigrations(db: DatabaseWrapper) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      appliedAt TEXT NOT NULL
    );
  `);

  const appliedRows = await db.all("SELECT id FROM schema_migrations");
  const appliedSet = new Set(appliedRows.map((r: any) => Number(r.id)));

  for (const migration of migrations) {
    if (!appliedSet.has(migration.id)) {
      console.log(`[DB Migration] Applying migration ${migration.id}: ${migration.name}...`);
      await migration.up(db);
      await db.run(
        "INSERT INTO schema_migrations (id, name, appliedAt) VALUES (?, ?, ?)",
        [migration.id, migration.name, new Date().toISOString()]
      );
      console.log(`[DB Migration] Successfully applied migration ${migration.id}: ${migration.name}`);
    }
  }
}

  try {
    await runMigrations(db);
    await purgeStaleUnverifiedUsers(db);
  } catch (error) {
    console.error("FATAL DB Migration Error:", error);
    throw error;
  }

  return db;
}

let customDb: DatabaseWrapper | undefined;

export function setCustomDb(db: DatabaseWrapper | undefined) {
  customDb = db;
}

export let dbPromise: Promise<DatabaseWrapper> = initDb();

export async function getDb(): Promise<DatabaseWrapper> {
  if (customDb) return customDb;
  return await dbPromise;
}
