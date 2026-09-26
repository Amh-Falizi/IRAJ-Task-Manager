import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { DatabaseWrapper } from "../types.js";
import { encryptSecret } from "../config.js";

export const sanitizeProject = (project: any) => {
  if (!project) return project;
  const sanitized = { ...project };
  if (sanitized.repoToken && sanitized.repoToken.trim() !== '') {
    sanitized.repoToken = '••••••••';
  } else {
    sanitized.repoToken = '';
  }
  if (sanitized.webhookSecret && sanitized.webhookSecret.trim() !== '') {
    sanitized.hasWebhookSecret = true;
    sanitized.webhookSecret = '••••••••';
  } else {
    sanitized.hasWebhookSecret = false;
    sanitized.webhookSecret = '';
  }
  return sanitized;
};

export class ProjectService {
  async getWorkload(db: DatabaseWrapper, projectId: string) {
    const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    if (!project) return null;

    const tasks = await db.all("SELECT id, status, assigneeId FROM tasks WHERE projectId = ?", projectId);
    const assigneeIds = Array.from(new Set(tasks.map((t: any) => t.assigneeId).filter(Boolean)));
    let users: any[] = [];
    if (assigneeIds.length > 0) {
      const placeholders = assigneeIds.map(() => '?').join(',');
      users = await db.all(`SELECT id, name, email FROM users WHERE id IN (${placeholders})`, assigneeIds);
    }

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

    return Object.values(workload).map((w: any) => {
      const doneCount = w.statuses['done'] || 0;
      return {
        ...w,
        completionPercentage: w.total > 0 ? Math.round((doneCount / w.total) * 100) : 0
      };
    }).sort((a: any, b: any) => b.total - a.total);
  }

  async getProjectById(db: DatabaseWrapper, id: string) {
    return await db.get("SELECT * FROM projects WHERE id = ?", id);
  }

  async getProjectActivity(db: DatabaseWrapper, projectId: string) {
    return await db.all(`
      SELECT a.*, t.title as taskTitle
      FROM task_activities a
      JOIN tasks t ON a.taskId = t.id
      WHERE t.projectId = ?
      ORDER BY a.createdAt DESC
      LIMIT 50
    `, projectId);
  }

  async updateProject(db: DatabaseWrapper, id: string, name: string, description: string) {
    await db.run(
      "UPDATE projects SET name = ?, description = ? WHERE id = ?",
      [name, description, id]
    );
    const updated = await db.get("SELECT * FROM projects WHERE id = ?", id);
    return sanitizeProject(updated);
  }

  async updateRepoSettings(db: DatabaseWrapper, projectId: string, existingProject: any, repoData: any) {
    const { repoProvider, repoOwner, repoName, repoUrl, repoToken, defaultBranch, webhookSecret } = repoData;

    let owner = repoOwner || '';
    let name = repoName || '';
    if (repoUrl && (!owner || !name)) {
      try {
        const parsed = new URL(repoUrl);
        const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
        if (parts.length >= 2) {
          owner = owner || parts[0];
          name = name || parts.slice(1).join('/');
        }
      } catch (e) {}
    }

    let storedToken = existingProject.repoToken || null;
    if (repoToken !== undefined) {
      if (repoToken === '••••••••') {
        storedToken = existingProject.repoToken;
      } else if (typeof repoToken === 'string' && repoToken.trim() !== '') {
        storedToken = encryptSecret(repoToken.trim());
      } else if (repoToken === '' || repoToken === null) {
        storedToken = null;
      }
    }

    let storedWebhookSecret = existingProject.webhookSecret || null;
    if (webhookSecret !== undefined) {
      if (webhookSecret === '••••••••') {
        storedWebhookSecret = existingProject.webhookSecret;
      } else if (typeof webhookSecret === 'string' && webhookSecret.trim() !== '') {
        storedWebhookSecret = encryptSecret(webhookSecret.trim());
      } else if (webhookSecret === '' || webhookSecret === null) {
        storedWebhookSecret = null;
      }
    }

    await db.run(
      `UPDATE projects SET 
        repoProvider = ?, 
        repoOwner = ?, 
        repoName = ?, 
        repoUrl = ?, 
        repoToken = ?, 
        webhookSecret = ?,
        defaultBranch = ? 
       WHERE id = ?`,
      [
        repoProvider || 'github',
        owner,
        name,
        repoUrl || '',
        storedToken,
        storedWebhookSecret,
        defaultBranch || 'main',
        projectId
      ]
    );

    const updated = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    return sanitizeProject(updated);
  }

  async generateWebhookSecret(db: DatabaseWrapper, projectId: string) {
    const generatedSecret = crypto.randomBytes(24).toString("hex");
    const encrypted = encryptSecret(generatedSecret);

    await db.run("UPDATE projects SET webhookSecret = ? WHERE id = ?", [encrypted, projectId]);
    return generatedSecret;
  }

  async updateWebhookSecret(db: DatabaseWrapper, projectId: string, secret: string | undefined | null) {
    let encryptedSecret: string | null = null;
    if (typeof secret === 'string' && secret.trim()) {
      encryptedSecret = encryptSecret(secret.trim());
    }

    await db.run("UPDATE projects SET webhookSecret = ? WHERE id = ?", [encryptedSecret, projectId]);
    return Boolean(encryptedSecret);
  }

  /**
   * Creates a new project and assigns the owner as project admin.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {Object} data - Project creation parameters.
   * @param {string} data.name - Name of the project.
   * @param {string} [data.description] - Description of the project.
   * @param {string} data.ownerId - User ID of the project owner.
   * @param {string} [data.projectKey] - Optional custom project key.
   * @returns {Promise<any>} The created and sanitized project object.
   */
  async createProject(
    db: DatabaseWrapper,
    data: { name: string; description?: string; ownerId: string; projectKey?: string | null }
  ) {
    const { name, description = "", ownerId, projectKey: customProjectKey } = data;
    const projectId = uuidv4();
    const createdAt = new Date().toISOString();

    let projectKey = customProjectKey ? customProjectKey.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() : null;
    if (!projectKey) {
      if (name) {
        projectKey = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
      }
      if (!projectKey || projectKey.length < 2) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        projectKey = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      }
    }

    if (db.isPg) {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description, ownerId, projectKey, 0, createdAt]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?) ON CONFLICT (projectId, userId) DO NOTHING",
        [projectId, ownerId, createdAt]
      );
    } else {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description, ownerId, projectKey, 0, createdAt]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?)",
        [projectId, ownerId, createdAt]
      );
    }

    const newProject = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    return sanitizeProject(newProject);
  }

  /**
   * Deletes a project and cascades deletion to all associated entities.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @returns {Promise<void>}
   */
  async deleteProject(db: DatabaseWrapper, projectId: string) {
    const projectTasks = await db.all("SELECT id FROM tasks WHERE projectId = ?", projectId);
    if (projectTasks.length > 0) {
      const taskIds = projectTasks.map((t: any) => t.id);
      const placeholders = taskIds.map(() => "?").join(",");
      await db.run(`DELETE FROM task_dependencies WHERE taskId IN (${placeholders}) OR blockedByTaskId IN (${placeholders})`, [...taskIds, ...taskIds]);
      await db.run(`DELETE FROM task_comments WHERE taskId IN (${placeholders})`, taskIds);
      await db.run(`DELETE FROM task_activities WHERE taskId IN (${placeholders})`, taskIds);
      await db.run(`DELETE FROM tasks WHERE id IN (${placeholders})`, taskIds);
    }

    await db.run("DELETE FROM documents WHERE projectId = ?", projectId);
    await db.run("DELETE FROM milestones WHERE projectId = ?", projectId);
    await db.run("DELETE FROM project_members WHERE projectId = ?", projectId);
    await db.run("DELETE FROM team_projects WHERE projectId = ?", projectId);
    await db.run("DELETE FROM project_columns WHERE projectId = ?", projectId);
    await db.run("DELETE FROM webhooks WHERE projectId = ?", projectId);
    await db.run("DELETE FROM projects WHERE id = ?", projectId);
  }

  /**
   * Retrieves members belonging to a project joined with user details.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @returns {Promise<any[]>} List of project members.
   */
  async getMembers(db: DatabaseWrapper, projectId: string) {
    return await db.all(`
      SELECT u.id, u.name, u.email, u.role as globalRole, pm.role, pm.joinedAt, pm.projectId
      FROM project_members pm
      JOIN users u ON pm.userId = u.id
      WHERE pm.projectId = ?
    `, projectId);
  }

  /**
   * Adds or updates a project member.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @param {string} userId - User identifier.
   * @param {string} role - Project role name.
   * @returns {Promise<void>}
   */
  async addOrUpdateMember(db: DatabaseWrapper, projectId: string, userId: string, role: string) {
    const joinedAt = new Date().toISOString();
    try {
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, ?, ?) ON CONFLICT(projectId, userId) DO UPDATE SET role = ?",
        [projectId, userId, role, joinedAt, role]
      );
    } catch (e: any) {
      if (e.message?.includes("UNIQUE constraint failed") || e.code === 'SQLITE_CONSTRAINT' || e.code === '23505' || e.message?.includes("duplicate key value")) {
        await db.run("UPDATE project_members SET role = ? WHERE projectId = ? AND userId = ?", [role, projectId, userId]);
      } else {
        throw e;
      }
    }
  }

  /**
   * Removes a member from a project.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @param {string} userId - User identifier.
   * @returns {Promise<void>}
   */
  async removeMember(db: DatabaseWrapper, projectId: string, userId: string) {
    await db.run("DELETE FROM project_members WHERE projectId = ? AND userId = ?", [projectId, userId]);
  }

  /**
   * Retrieves column configurations for a project.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @returns {Promise<any | null>} Stored column configuration.
   */
  async getColumns(db: DatabaseWrapper, projectId: string) {
    const row = await db.get("SELECT * FROM project_columns WHERE projectId = ?", projectId);
    if (!row) return null;
    try {
      return typeof row.columnsJson === 'string' ? JSON.parse(row.columnsJson) : row.columnsJson;
    } catch {
      return null;
    }
  }

  /**
   * Saves column configurations for a project.
   *
   * @param {DatabaseWrapper} db - Database connection wrapper.
   * @param {string} projectId - Project identifier.
   * @param {string} columnsJson - JSON string of columns array.
   * @returns {Promise<void>}
   */
  async saveColumns(db: DatabaseWrapper, projectId: string, columnsJson: string) {
    const id = uuidv4();
    const updatedAt = new Date().toISOString();
    if (db.isPg) {
      await db.run(
        "INSERT INTO project_columns (id, projectId, columnsJson, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT (projectId) DO UPDATE SET columnsJson = ?, updatedAt = ?",
        [id, projectId, columnsJson, updatedAt, columnsJson, updatedAt]
      );
    } else {
      await db.run(
        "INSERT OR REPLACE INTO project_columns (id, projectId, columnsJson, updatedAt) VALUES (?, ?, ?, ?)",
        [id, projectId, columnsJson, updatedAt]
      );
    }
  }
}

export const projectService = new ProjectService();
