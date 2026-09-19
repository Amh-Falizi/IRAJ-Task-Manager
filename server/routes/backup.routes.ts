import express from "express";
import fs from "fs";
import { dbPromise, activeSqlitePath, PgWrapper } from "../db.js";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin
} from "../middleware/auth.js";

export const backupRouter = express.Router();
const router = backupRouter;

/**
 * GET /api/backup/info
 * @description Retrieves current database metadata, active engine (SQLite vs PostgreSQL), 
 * and row count statistics across core workspace tables (Users, Tasks, Projects, Teams, Documents).
 * Requires authorization token.
 */
router.get("/info", authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const isSqlite = !(db instanceof PgWrapper);

    let sqliteSize = 0;
    if (isSqlite && fs.existsSync(activeSqlitePath)) {
      const stats = fs.statSync(activeSqlitePath);
      sqliteSize = stats.size;
    }

    // Retrieve active count statistics concurrently or fallback safely on table-level failures
    const userCount = await db.get("SELECT COUNT(*) as count FROM users").then(r => r?.count || 0).catch(() => 0);
    const taskCount = await db.get("SELECT COUNT(*) as count FROM tasks").then(r => r?.count || 0).catch(() => 0);
    const projectCount = await db.get("SELECT COUNT(*) as count FROM projects").then(r => r?.count || 0).catch(() => 0);
    const teamCount = await db.get("SELECT COUNT(*) as count FROM teams").then(r => r?.count || 0).catch(() => 0);
    const documentCount = await db.get("SELECT COUNT(*) as count FROM documents").then(r => r?.count || 0).catch(() => 0);

    res.json({
      dbType: isSqlite ? "SQLite" : "PostgreSQL",
      sqliteSize,
      stats: {
        users: Number(userCount),
        tasks: Number(taskCount),
        projects: Number(projectCount),
        teams: Number(teamCount),
        documents: Number(documentCount)
      }
    });
  } catch (error: any) {
    console.error("Backup info error:", error);
    res.status(500).json({ error: "Failed to get database details." });
  }
});

/**
 * GET /api/backup/export-json
 * @description Exports all core database tables into a unified JSON format.
 * This provides engine-independent database persistence, allowing transfers between SQLite and Postgres.
 * Requires authorization token.
 */
router.get("/export-json", authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const backupData: Record<string, any[]> = {};
    const tables = [
      "users", "tasks", "teams", "projects", "project_members",
      "documents", "milestones", "team_members", "team_projects",
      "task_dependencies", "task_comments", "task_activities", "settings", "roles",
      "project_columns"
    ];

    for (const table of tables) {
      try {
        let rows = await db.all(`SELECT * FROM ${table}`);
        if (table === 'projects') {
          rows = rows.map((p: any) => ({
            ...p,
            repoToken: p.repoToken ? '••••••••' : null
          }));
        }
        if (table === 'users') {
          rows = rows.map((u: any) => ({
            ...u,
            passwordHash: '••••••••'
          }));
        }
        backupData[table] = rows;
      } catch (e) {
        backupData[table] = [];
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=workspace-backup.json");
    res.json(backupData);
  } catch (error: any) {
    console.error("Export JSON error:", error);
    res.status(500).json({ error: "Failed to export JSON backup." });
  }
});

/**
 * POST /api/backup/restore-json
 * @description Restores workspace database records from a portable JSON schema.
 * Purges all active data in target tables and inserts rows from JSON payload.
 * Requires authorization token.
 */
router.post("/restore-json", authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const backupData = req.body;

    if (!backupData || typeof backupData !== "object") {
      return res.status(400).json({ error: "Invalid backup data format." });
    }

    if (!backupData.users || !Array.isArray(backupData.users)) {
      return res.status(400).json({ error: "Invalid backup: 'users' table data is missing." });
    }

    const ALLOWED_TABLE_COLUMNS: Record<string, string[]> = {
      users: ["id", "name", "email", "passwordHash", "role", "skills", "rolePrefix", "status"],
      tasks: ["id", "title", "description", "status", "priority", "deadline", "assigneeId", "creatorId", "branchName", "parentId", "projectId", "milestoneId", "createdAt", "orderIndex", "prUrl", "prStatus"],
      teams: ["id", "name", "description", "ownerId", "createdAt", "projectId"],
      projects: ["id", "name", "description", "ownerId", "projectKey", "taskCounter", "createdAt", "repoProvider", "repoOwner", "repoName", "repoUrl", "repoToken", "defaultBranch"],
      project_members: ["projectId", "userId", "role", "joinedAt"],
      documents: ["id", "projectId", "title", "content", "authorId", "createdAt", "updatedAt"],
      milestones: ["id", "projectId", "name", "description", "startDate", "endDate", "status", "createdAt"],
      team_members: ["id", "teamId", "userId", "joinedAt"],
      team_projects: ["teamId", "projectId"],
      task_dependencies: ["taskId", "blockedByTaskId"],
      task_comments: ["id", "taskId", "userId", "content", "createdAt"],
      task_activities: ["id", "taskId", "userId", "action", "createdAt"],
      settings: ["key", "value"],
      roles: ["id", "name", "description", "is_custom", "permissions"],
      project_columns: ["id", "projectId", "columnsJson", "updatedAt"]
    };

    const executingAdmin = await db.get("SELECT id, email, passwordHash FROM users WHERE id = ?", req.user.id);

    // Execute wipe and sequential restore inside a transactional block
    await db.transaction(async (tx) => {
      try {
        await tx.exec("DELETE FROM password_resets;");
      } catch (delPrErr: any) {
        const msg = delPrErr.message?.toLowerCase() || '';
        if (!msg.includes('no such table') && !msg.includes('does not exist')) {
          throw delPrErr;
        }
      }

      for (const table of Object.keys(ALLOWED_TABLE_COLUMNS)) {
        try {
          await tx.exec(`DELETE FROM ${table}`);
        } catch (delErr: any) {
          const msg = delErr.message?.toLowerCase() || '';
          if (!msg.includes('no such table') && !msg.includes('does not exist')) {
            throw delErr;
          }
          console.warn(`Skipping missing table ${table} during restore`);
        }
      }

      for (const table of Object.keys(ALLOWED_TABLE_COLUMNS)) {
        const rows = backupData[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const allowedCols = ALLOWED_TABLE_COLUMNS[table];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const presentCols = Object.keys(row).filter(c => allowedCols.includes(c));
          if (presentCols.length === 0) continue;

          const placeholders = presentCols.map(() => "?").join(", ");
          const insertSql = `INSERT INTO ${table} (${presentCols.join(", ")}) VALUES (${placeholders})`;
          const params = presentCols.map(col => {
            if (table === "projects" && col === "repoToken" && row[col] === "••••••••") {
              return null;
            }
            if (table === "users" && col === "passwordHash" && row[col] === "••••••••") {
              if (executingAdmin && (row.id === executingAdmin.id || row.email === executingAdmin.email)) {
                return executingAdmin.passwordHash;
              }
              return "$2b$10$UnusablePlaceholderPasswordHash00000000000000000000000";
            }
            return row[col];
          });
          await tx.run(insertSql, params);
        }
      }
    });

    res.json({ success: true, message: "Workspace restored successfully from JSON backup!" });
  } catch (error: any) {
    console.error("Restore JSON error:", error);
    res.status(500).json({ error: `Failed to restore database: ${error.message}` });
  }
});
