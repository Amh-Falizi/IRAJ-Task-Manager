import crypto from "crypto";
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
}

export const projectService = new ProjectService();
