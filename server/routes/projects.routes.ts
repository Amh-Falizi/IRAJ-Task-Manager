import express from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { dbPromise, extractTaskNumber } from "../db.js";
import { encryptSecret, decryptSecret } from "../config.js";
import {
  authenticateToken,
  isAdminOrSuperAdmin,
  isProjectAdminOrOwner,
  checkProjectAccess,
  checkTaskAccess,
  hasPermission,
  getAccessibleProjects
} from "../middleware/auth.js";

export const projectsRouter = express.Router();
const router = projectsRouter;

const sanitizeProject = (project: any) => {
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

// Projects APIs
router.get("/projects/:id/workload", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project workload." });
    }
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.sendStatus(404);

    const tasks = await db.all("SELECT id, status, assigneeId FROM tasks WHERE projectId = ?", req.params.id);
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

    const result = Object.values(workload).map((w: any) => {
      // For legacy 'done' logic calculation where custom boards might use something else, we take 'done' if present, otherwise 0
      const doneCount = w.statuses['done'] || 0;
      return {
        ...w,
        completionPercentage: w.total > 0 ? Math.round((doneCount / w.total) * 100) : 0
      };
    }).sort((a: any, b: any) => b.total - a.total);

    res.json(result);
  } catch (err: any) {
    console.error("Error fetching project workload:", err);
    res.status(500).json({ error: "Failed to fetch project workload" });
  }
});

router.get("/projects", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const projects = await getAccessibleProjects(db, req.user);
    res.json(projects.map(sanitizeProject));
  } catch (err: any) {
    console.error("Failed to list projects:", err);
    res.status(500).json({ error: "Failed to retrieve projects" });
  }
});

router.get("/projects/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const hasAccess = await checkProjectAccess(db, req.params.id, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to project." });
    }

    res.json(sanitizeProject(project));
  } catch (err: any) {
    console.error("Error fetching project:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", authenticateToken, async (req: any, res: any) => {
  try {
    const canCreate = await hasPermission(req.user, "manage_projects") || isAdminOrSuperAdmin(req.user);
    if (!canCreate) {
      return res.status(403).json({ error: "You do not have permission to create projects." });
    }

    const db = await dbPromise;

    const { name, description, projectKey: customProjectKey } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Project name is required" });
    }

    const projectId = uuidv4();
    
    let projectKey = customProjectKey ? customProjectKey.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() : null;
    
    if (!projectKey) {
      if (name) {
        projectKey = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
      }
      if (!projectKey || projectKey.length < 2) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        projectKey = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      }
    }

    if (db.isPg) {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description || "", req.user.id, projectKey, 0, new Date().toISOString()]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?) ON CONFLICT (projectId, userId) DO NOTHING",
        [projectId, req.user.id, new Date().toISOString()]
      );
    } else {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description || "", req.user.id, projectKey, 0, new Date().toISOString()]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?)",
        [projectId, req.user.id, new Date().toISOString()]
      );
    }
    
    const newProject = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    res.json(sanitizeProject(newProject));
  } catch (err: any) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: err?.message || "Failed to create project" });
  }
});

// Get Project Activity
router.get("/projects/:id/activity", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project activity." });
    }
    
    const activities = await db.all(`
      SELECT a.*, t.title as taskTitle
      FROM task_activities a
      JOIN tasks t ON a.taskId = t.id
      WHERE t.projectId = ?
      ORDER BY a.createdAt DESC
      LIMIT 50
    `, req.params.id);
    
    res.json(activities);
  } catch (err: any) {
    console.error("Error fetching project activity:", err);
    res.status(500).json({ error: "Failed to fetch project activity" });
  }
});

router.put("/projects/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied: user is not a member of this project." });
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.sendStatus(404);

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, project admins, or system administrators can edit project details." });
    }

    const { name, description } = req.body;
    await db.run(
      "UPDATE projects SET name = ?, description = ? WHERE id = ?",
      [name, description, req.params.id]
    );
    
    const updatedProject = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    res.json(sanitizeProject(updatedProject));
  } catch (err: any) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// Update Project Repository Settings
router.put("/projects/:id/repo", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied: user is not a member of this project." });
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, project admins, or system administrators can configure repository settings." });
    }

    const { repoProvider, repoOwner, repoName, repoUrl, repoToken, defaultBranch, webhookSecret } = req.body;

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

    // Preserve storedToken safely without destroying if decrypt fails or masked token was sent
    let storedToken = project.repoToken || null;
    if (repoToken !== undefined) {
      if (repoToken === '••••••••') {
        storedToken = project.repoToken;
      } else if (typeof repoToken === 'string' && repoToken.trim() !== '') {
        storedToken = encryptSecret(repoToken.trim());
      } else if (repoToken === '' || repoToken === null) {
        storedToken = null;
      }
    }

    // Preserve or update webhookSecret safely
    let storedWebhookSecret = project.webhookSecret || null;
    if (webhookSecret !== undefined) {
      if (webhookSecret === '••••••••') {
        storedWebhookSecret = project.webhookSecret;
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
        req.params.id
      ]
    );

    const updated = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    res.json(sanitizeProject(updated));
  } catch (err: any) {
    console.error("Error updating project repo settings:", err);
    res.status(500).json({ error: "Failed to update project repository settings" });
  }
});

// Get Project Inbound Webhook Secret Status
router.get("/projects/:id/webhook-secret", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, admins, or managers can view webhook secrets." });
    }

    res.json({
      hasWebhookSecret: Boolean(project.webhookSecret && project.webhookSecret.trim() !== ''),
      webhookSecret: project.webhookSecret ? '••••••••' : null
    });
  } catch (err: any) {
    console.error("Error retrieving webhook secret status:", err);
    res.status(500).json({ error: "Internal server error retrieving webhook status" });
  }
});

// Generate and store new Inbound Webhook Secret for Project
router.post("/projects/:id/webhook-secret/generate", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, admins, or managers can generate webhook secrets." });
    }

    const generatedSecret = crypto.randomBytes(24).toString("hex");
    const encrypted = encryptSecret(generatedSecret);

    await db.run("UPDATE projects SET webhookSecret = ? WHERE id = ?", [encrypted, req.params.id]);

    res.json({
      success: true,
      secret: generatedSecret,
      message: "New webhook secret generated. Copy it now, it will not be shown again in plain text."
    });
  } catch (err: any) {
    console.error("Error generating webhook secret:", err);
    res.status(500).json({ error: "Internal server error generating webhook secret" });
  }
});

// Update or delete Project Inbound Webhook Secret
router.put("/projects/:id/webhook-secret", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, admins, or managers can update webhook secrets." });
    }

    const { secret } = req.body;
    let encryptedSecret: string | null = null;
    if (typeof secret === 'string' && secret.trim()) {
      encryptedSecret = encryptSecret(secret.trim());
    }

    await db.run("UPDATE projects SET webhookSecret = ? WHERE id = ?", [encryptedSecret, req.params.id]);

    res.json({
      success: true,
      hasWebhookSecret: Boolean(encryptedSecret)
    });
  } catch (err: any) {
    console.error("Error updating webhook secret:", err);
    res.status(500).json({ error: "Internal server error updating webhook secret" });
  }
});

// Get Live Branches from GitHub or GitLab for a Project
router.get("/projects/:id/git/branches", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project git branches." });
    }
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const tasks = await db.all("SELECT id, title, branchName, prUrl, prStatus FROM tasks WHERE projectId = ? AND branchName IS NOT NULL AND branchName != ''", req.params.id);
    const taskBranchMap = new Map();
    tasks.forEach((t: any) => {
      taskBranchMap.set(t.branchName, t);
    });

    const provider = project.repoProvider || 'github';
    const owner = project.repoOwner;
    const name = project.repoName;
    const token = decryptSecret(project.repoToken);

    const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);

    if (!owner || !name || !canUsePat) {
      // Fallback: return local task-linked branches
      const localBranches = Array.from(taskBranchMap.entries()).map(([bName, task]: [string, any]) => ({
        name: bName,
        commitSha: 'local',
        commitMessage: `Linked to task: ${task.title}`,
        isDefault: bName === (project.defaultBranch || 'main'),
        linkedTaskId: task.id,
        linkedTaskTitle: task.title,
        prUrl: task.prUrl,
        prStatus: task.prStatus
      }));

      if (localBranches.length === 0) {
        localBranches.push({
          name: project.defaultBranch || 'main',
          commitSha: 'main',
          commitMessage: 'Default branch',
          isDefault: true,
          linkedTaskId: null,
          linkedTaskTitle: null,
          prUrl: null,
          prStatus: null
        });
      }

      return res.json({ branches: localBranches, provider: 'none', configured: false });
    }

    try {
      if (provider === 'github') {
        const headers: Record<string, string> = {
          'User-Agent': 'devteam-taskmanager',
          'Accept': 'application/vnd.github.v3+json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`, { headers, signal: AbortSignal.timeout(8000) });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          throw new Error(`GitHub API Error (${ghRes.status}): ${errText}`);
        }

        const rawBranches = await ghRes.json();
        const branches = rawBranches.map((b: any) => {
          const linkedTask = taskBranchMap.get(b.name);
          return {
            name: b.name,
            commitSha: b.commit?.sha?.substring(0, 7) || '',
            protected: b.protected || false,
            webUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${encodeURIComponent(b.name)}`,
            isDefault: b.name === (project.defaultBranch || 'main'),
            linkedTaskId: linkedTask?.id,
            linkedTaskTitle: linkedTask?.title,
            prUrl: linkedTask?.prUrl,
            prStatus: linkedTask?.prStatus
          };
        });

        return res.json({ branches, provider: 'github', configured: true });
      } else if (provider === 'gitlab') {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
        const headers: Record<string, string> = {};
        if (token) headers['PRIVATE-TOKEN'] = token;

        const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/repository/branches`, { headers, signal: AbortSignal.timeout(8000) });
        if (!glRes.ok) {
          const errText = await glRes.text();
          throw new Error(`GitLab API Error (${glRes.status}): ${errText}`);
        }

        const rawBranches = await glRes.json();
        const branches = rawBranches.map((b: any) => {
          const linkedTask = taskBranchMap.get(b.name);
          return {
            name: b.name,
            commitSha: b.commit?.short_id || b.commit?.id?.substring(0, 7) || '',
            commitMessage: b.commit?.title || '',
            protected: b.protected || false,
            webUrl: b.web_url || `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/tree/${encodeURIComponent(b.name)}`,
            isDefault: b.default || b.name === (project.defaultBranch || 'main'),
            linkedTaskId: linkedTask?.id,
            linkedTaskTitle: linkedTask?.title,
            prUrl: linkedTask?.prUrl,
            prStatus: linkedTask?.prStatus
          };
        });

        return res.json({ branches, provider: 'gitlab', configured: true });
      }
    } catch (err: any) {
      console.error("Git API error:", err.message);
      // Return graceful fallback with error notice
      const localBranches = Array.from(taskBranchMap.entries()).map(([bName, task]: [string, any]) => ({
        name: bName,
        commitSha: 'local',
        commitMessage: `Linked to task: ${task.title}`,
        isDefault: bName === (project.defaultBranch || 'main'),
        linkedTaskId: task.id,
        linkedTaskTitle: task.title,
        prUrl: task.prUrl,
        prStatus: task.prStatus
      }));

      return res.json({ 
        branches: localBranches, 
        provider, 
        configured: true, 
        error: err.message || "Failed to connect to remote Git provider" 
      });
    }
  } catch (err: any) {
    console.error("Error retrieving branches:", err);
    res.status(500).json({ error: "Failed to retrieve git branches" });
  }
});

// Create Branch on Remote GitHub or GitLab Repository
router.post("/projects/:id/git/branches", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project git branches." });
    }
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { branchName, taskId, baseBranch } = req.body;
    if (!branchName) return res.status(400).json({ error: "Branch name is required" });

    if (taskId) {
      const task = await db.get("SELECT projectId FROM tasks WHERE id = ?", taskId);
      if (!task || task.projectId !== req.params.id) {
        return res.status(400).json({ error: "Specified task does not belong to this project." });
      }
      const taskAccess = await checkTaskAccess(db, taskId, req.user);
      if (!taskAccess.allowed) {
        return res.status(403).json({ error: "Access denied to specified task." });
      }
    }

    const targetBaseBranch = baseBranch || project.defaultBranch || 'main';
    const provider = project.repoProvider || 'github';
    const owner = project.repoOwner;
    const name = project.repoName;
    const token = decryptSecret(project.repoToken);

    // Protect against Confused Deputy: only project admins/owners can execute remote Git operations with configured PAT
    if (owner && name && token) {
      const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
      if (!canUsePat) {
        return res.status(403).json({ error: "Only project administrators or owners can execute remote repository operations using the configured repository token." });
      }
    }

    let remoteCreated = false;
    let remoteUrl = '';
    let remoteError = null;

    if (owner && name && token) {
      try {
        if (provider === 'github') {
          const headers: Record<string, string> = {
            'User-Agent': 'devteam-taskmanager',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`
          };

          // 1. Get SHA of base branch
          const baseRefRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/${targetBaseBranch}`, { headers, signal: AbortSignal.timeout(8000) });
          if (!baseRefRes.ok) {
            let errMsg = `Failed to find base branch '${targetBaseBranch}' on GitHub`;
            try {
              const errJson = await baseRefRes.json();
              if (errJson.message) {
                errMsg += ` (${errJson.message})`;
              }
            } catch (e) {}
            throw new Error(errMsg);
          }
          const baseRefData = await baseRefRes.json();
          const sha = baseRefData.object.sha;

          // 2. Create ref
          const createRefRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/refs`, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              ref: `refs/heads/${branchName}`,
              sha
            })
          });

          if (!createRefRes.ok) {
            let errMsg = 'Failed to create branch on GitHub';
            try {
              const createErr = await createRefRes.json();
              errMsg = createErr.message || errMsg;
              if (createErr.errors && Array.isArray(createErr.errors)) {
                const details = createErr.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ');
                errMsg += `: ${details}`;
              }
            } catch (e) {
              try {
                errMsg = await createRefRes.text() || errMsg;
              } catch (inner) {}
            }
            throw new Error(errMsg);
          }

          remoteCreated = true;
          remoteUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${encodeURIComponent(branchName)}`;
        } else if (provider === 'gitlab') {
          const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
          const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
          
          const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/repository/branches`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'PRIVATE-TOKEN': token
            },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              branch: branchName,
              ref: targetBaseBranch
            })
          });

          if (!glRes.ok) {
            let errMsg = 'Failed to create branch on GitLab';
            try {
              const glErr = await glRes.json();
              errMsg = glErr.message || glErr.error || errMsg;
            } catch (e) {
              try {
                errMsg = await glRes.text() || errMsg;
              } catch (inner) {}
            }
            throw new Error(errMsg);
          }

          const glData = await glRes.json();
          remoteCreated = true;
          remoteUrl = glData.web_url || `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/tree/${encodeURIComponent(branchName)}`;
        }
      } catch (err: any) {
        console.error("Error creating remote branch:", err.message);
        remoteError = err.message;
      }
    }

    // If a remote repo is configured, but remote branch creation failed, return an error response
    if (owner && name && token && !remoteCreated) {
      return res.status(400).json({
        success: false,
        error: remoteError || "Failed to create remote branch on Git provider. Check your repository token permissions, repository path, and default branch settings."
      });
    }

    // Save branch onto task if taskId provided
    if (taskId) {
      await db.run("UPDATE tasks SET branchName = ? WHERE id = ?", [branchName, taskId]);
      
      const taskNum = extractTaskNumber(branchName);
      if (taskNum !== null) {
        const proj = await db.get("SELECT taskCounter FROM projects WHERE id = ?", req.params.id);
        if (proj && taskNum > (proj.taskCounter || 0)) {
          await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [taskNum, req.params.id]);
        }
      }
      
      // Add activity
      const activityId = uuidv4();
      const actionText = remoteCreated 
        ? `created remote branch ${branchName} on ${provider.toUpperCase()}`
        : `linked branch ${branchName} to task`;

      await db.run(
        "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
        [activityId, taskId, req.user.id, actionText, new Date().toISOString()]
      );
    }

    res.json({
      success: true,
      branchName,
      remoteCreated,
      remoteUrl,
      remoteError,
      message: remoteCreated ? `Branch '${branchName}' created successfully on ${provider.toUpperCase()}` : `Branch '${branchName}' linked locally`
    });
  } catch (err: any) {
    console.error("Error creating branch:", err);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// Create Pull Request / Merge Request for a Task
router.post("/projects/:id/git/pull-requests", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project git pull requests." });
    }
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { taskId, sourceBranch, targetBranch, title, description } = req.body;
    if (!sourceBranch) return res.status(400).json({ error: "Source branch is required" });

    if (taskId) {
      const task = await db.get("SELECT projectId FROM tasks WHERE id = ?", taskId);
      if (!task || task.projectId !== req.params.id) {
        return res.status(400).json({ error: "Specified task does not belong to this project." });
      }
      const taskAccess = await checkTaskAccess(db, taskId, req.user);
      if (!taskAccess.allowed) {
        return res.status(403).json({ error: "Access denied to specified task." });
      }
    }

    const baseBranch = targetBranch || project.defaultBranch || 'main';
    const provider = project.repoProvider || 'github';
    const owner = project.repoOwner;
    const name = project.repoName;
    const token = decryptSecret(project.repoToken);

    // Protect against Confused Deputy: only project admins/owners can execute remote Git operations with configured PAT
    if (owner && name && token) {
      const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
      if (!canUsePat) {
        return res.status(403).json({ error: "Only project administrators or owners can execute remote repository operations using the configured repository token." });
      }
    }

    let prUrl = '';
    let prStatus = 'open';
    let isFallback = false;

    if (!owner || !name || !token) {
      isFallback = true;
      // If no token or repo configured, generate web creation URL
      if (provider === 'github') {
        prUrl = `https://github.com/${encodeURIComponent(owner || 'owner')}/${encodeURIComponent(name || 'repo')}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(sourceBranch)}?expand=1`;
      } else {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        prUrl = `${gitlabUrl}/${encodeURIComponent(owner || 'owner')}/${encodeURIComponent(name || 'repo')}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(baseBranch)}`;
      }
    } else {
      try {
        if (provider === 'github') {
          const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`, {
            method: 'POST',
            headers: {
              'User-Agent': 'devteam-taskmanager',
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              title: title || `[Task] ${sourceBranch}`,
              head: sourceBranch,
              base: baseBranch,
              body: description || `Automated Pull Request created from DevTeam TaskManager`
            })
          });

          if (!ghRes.ok) {
            const ghErr = await ghRes.json();
            throw new Error(ghErr.message || 'Failed to create PR on GitHub');
          }

          const ghData = await ghRes.json();
          prUrl = ghData.html_url;
        } else if (provider === 'gitlab') {
          const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
          const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);

          const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'PRIVATE-TOKEN': token
            },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              title: title || `[Task] ${sourceBranch}`,
              source_branch: sourceBranch,
              target_branch: baseBranch,
              description: description || `Automated Merge Request created from DevTeam TaskManager`
            })
          });

          if (!glRes.ok) {
            const glErr = await glRes.json();
            throw new Error(glErr.message || 'Failed to create Merge Request on GitLab');
          }

          const glData = await glRes.json();
          prUrl = glData.web_url;
        }
      } catch (err: any) {
        console.error("PR Creation error:", err.message);
        isFallback = true;
        // Fallback web URL
        if (provider === 'github') {
          prUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(sourceBranch)}?expand=1`;
        } else {
          const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
          prUrl = `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(baseBranch)}`;
        }
      }
    }

    if (taskId) {
      await db.run("UPDATE tasks SET prUrl = ?, prStatus = ? WHERE id = ?", [prUrl, prStatus, taskId]);
      
      // Add activity
      const activityId = uuidv4();
      await db.run(
        "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
        [activityId, taskId, req.user.id, `opened Pull Request on ${provider.toUpperCase()}`, new Date().toISOString()]
      );
    }

    res.json({ success: true, prUrl, prStatus, isFallback });
  } catch (err: any) {
    console.error("Error creating pull request:", err);
    res.status(500).json({ error: "Failed to create pull request" });
  }
});

// Project Custom Columns Management
router.get("/projects/:id/columns", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project." });
    }
    const row = await db.get("SELECT columnsJson FROM project_columns WHERE projectId = ?", req.params.id);
    if (!row) {
      return res.json({ columns: null });
    }
    try {
      const columns = JSON.parse(row.columnsJson);
      return res.json({ columns });
    } catch (e) {
      return res.json({ columns: null });
    }
  } catch (err: any) {
    console.error("Error fetching project columns:", err);
    res.status(500).json({ error: "Failed to fetch project columns" });
  }
});

router.put("/projects/:id/columns", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied: user is not a member of this project." });
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && (pm.role === 'admin' || pm.role === 'lead');

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Permission denied. Only project owners, project admins, or system administrators can modify board column structure." });
    }

    const { columns } = req.body;
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: "Columns must be an array." });
    }

    const columnsJson = JSON.stringify(columns);
    const id = uuidv4();
    const now = new Date().toISOString();

    if (db.isPg) {
      await db.run(`
        INSERT INTO project_columns (id, projectId, columnsJson, updatedAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (projectId) DO UPDATE SET columnsJson = EXCLUDED.columnsJson, updatedAt = EXCLUDED.updatedAt
      `, [id, req.params.id, columnsJson, now]);
    } else {
      const existing = await db.get("SELECT id FROM project_columns WHERE projectId = ?", req.params.id);
      if (existing) {
        await db.run("UPDATE project_columns SET columnsJson = ?, updatedAt = ? WHERE projectId = ?", [columnsJson, now, req.params.id]);
      } else {
        await db.run("INSERT INTO project_columns (id, projectId, columnsJson, updatedAt) VALUES (?, ?, ?, ?)", [id, req.params.id, columnsJson, now]);
      }
    }

    res.json({ success: true, columns });
  } catch (err: any) {
    console.error("Error updating project columns:", err);
    res.status(500).json({ error: "Failed to update project columns" });
  }
});

// Sync and Update Statuses of Pull/Merge Requests of a Project
router.post("/projects/:id/git/pull-requests/sync", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project git pull requests." });
    }
    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const provider = project.repoProvider || 'github';
    const owner = project.repoOwner;
    const name = project.repoName;
    const token = decryptSecret(project.repoToken);

    const tasks = await db.all("SELECT id, title, prUrl, prStatus, status FROM tasks WHERE projectId = ? AND prUrl IS NOT NULL AND prUrl != ''", req.params.id);
    if (tasks.length === 0) {
      return res.json({ success: true, message: "No active Pull Requests to sync.", updatedCount: 0 });
    }

    if (!owner || !name || !token) {
      return res.status(400).json({ error: "Repository or authentication credentials are not configured for this project." });
    }

    const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
    if (!canUsePat) {
      return res.status(403).json({ error: "Only project administrators or owners can execute remote repository sync using the configured token." });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const task of tasks) {
      try {
        let prNumber: string | null = null;
        if (provider === 'github') {
          const match = task.prUrl.match(/\/pull\/(\d+)/);
          if (match) prNumber = match[1];
        } else if (provider === 'gitlab') {
          const match = task.prUrl.match(/\/merge_requests\/(\d+)/);
          if (match) prNumber = match[1];
        }

        if (!prNumber) continue;

        let remotePrStatus = task.prStatus || 'open';
        let remoteMerged = false;

        if (provider === 'github') {
          const headers: Record<string, string> = {
            'User-Agent': 'devteam-taskmanager',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`
          };
          const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${prNumber}`, { headers, signal: AbortSignal.timeout(8000) });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            remoteMerged = ghData.merged || false;
            remotePrStatus = ghData.state; // 'open' or 'closed'
            if (remoteMerged) {
              remotePrStatus = 'merged';
            }
          } else {
            errors.push(`GitHub error for task ${task.title}: ${ghRes.statusText}`);
          }
        } else if (provider === 'gitlab') {
          const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
          const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
          const headers = { 'PRIVATE-TOKEN': token };
          const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${prNumber}`, { headers, signal: AbortSignal.timeout(8000) });
          if (glRes.ok) {
            const glData = await glRes.json();
            const glState = glData.state; // 'opened', 'closed', 'merged', 'locked'
            if (glState === 'opened') {
              remotePrStatus = 'open';
            } else if (glState === 'merged') {
              remotePrStatus = 'merged';
              remoteMerged = true;
            } else if (glState === 'closed') {
              remotePrStatus = 'closed';
            }
          } else {
            errors.push(`GitLab error for task ${task.title}: ${glRes.statusText}`);
          }
        }

        // If status changed, update the task!
        if (remotePrStatus !== task.prStatus) {
          let nextTaskStatus = task.status;
          
          // Auto-transition to 'done' column if merged!
          if (remotePrStatus === 'merged' && task.status !== 'done') {
            nextTaskStatus = 'done';
          } else if (remotePrStatus === 'open' && (task.status === 'todo' || task.status === 'backlog')) {
            // If PR is open, auto-transition to 'review' column
            nextTaskStatus = 'review';
          }

          await db.run(
            "UPDATE tasks SET prStatus = ?, status = ? WHERE id = ?",
            [remotePrStatus, nextTaskStatus, task.id]
          );

          // Add activity
          const activityId = uuidv4();
          await db.run(
            "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
            [activityId, task.id, req.user.id, `synchronized PR status: updated PR to '${remotePrStatus}' and Board Status to '${nextTaskStatus}'`, new Date().toISOString()]
          );

          updatedCount++;
        }
      } catch (err: any) {
        console.error(`Sync error for task ${task.id}:`, err.message);
        errors.push(`Failed to sync task ${task.title}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      updatedCount,
      errors: errors.length > 0 ? errors : null,
      message: `PR sync completed. Updated ${updatedCount} task(s).`
    });
  } catch (err: any) {
    console.error("Error syncing PR statuses:", err);
    res.status(500).json({ error: "Failed to sync PR statuses" });
  }
});

router.delete("/projects/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied: user is not a member of this project." });
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
    if (!project) return res.sendStatus(404);

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only project owners, project admins, or system administrators can delete projects." });
    }

    const projectId = req.params.id;
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
    await db.run("DELETE FROM projects WHERE id = ?", projectId);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// Integration Connectivity Status API for GitHub & GitLab
router.get("/integrations/status", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    let projects;
    if (isAdminOrSuperAdmin(req.user)) {
      projects = await db.all("SELECT id, name, repoProvider, repoOwner, repoName, repoToken FROM projects");
    } else {
      projects = await db.all(`
        SELECT DISTINCT p.id, p.name, p.repoProvider, p.repoOwner, p.repoName, p.repoToken 
        FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.projectId 
        LEFT JOIN team_projects tp ON p.id = tp.projectId 
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId 
        LEFT JOIN tasks t ON p.id = t.projectId 
        WHERE p.ownerId = ? 
           OR pm.userId = ? 
           OR tm.userId = ? 
           OR t.assigneeId = ?
      `, [req.user.id, req.user.id, req.user.id, req.user.id]);
    }

    const githubProjects = projects.filter(p => p.repoProvider === 'github' && p.repoOwner && p.repoName);
    const gitlabProjects = projects.filter(p => p.repoProvider === 'gitlab' && p.repoOwner && p.repoName);

    // Evaluate GitHub (Optional by default)
    let ghStatus = 'disconnected';
    let ghText = 'Not Linked';
    let ghColor = 'slate';
    let ghDetail = 'Optional - No GitHub repository linked';

    if (githubProjects.length > 0) {
      const ghWithToken = githubProjects.filter(p => p.repoToken && p.repoToken.trim() !== '');
      if (ghWithToken.length === githubProjects.length) {
        ghStatus = 'connected';
        ghText = 'Connected';
        ghColor = 'emerald';
        ghDetail = `${githubProjects.length} GitHub ${githubProjects.length === 1 ? 'repo' : 'repos'} connected`;
      } else if (ghWithToken.length > 0) {
        ghStatus = 'connected_partial';
        ghText = 'Partial';
        ghColor = 'emerald';
        ghDetail = `${ghWithToken.length} of ${githubProjects.length} GitHub repos configured`;
      } else {
        ghStatus = 'not_linked';
        ghText = 'Not Linked';
        ghColor = 'slate';
        ghDetail = `Optional - Token not configured for ${githubProjects.length} GitHub repo(s)`;
      }
    }

    // Evaluate GitLab (Optional by default)
    let glStatus = 'disconnected';
    let glText = 'Not Linked';
    let glColor = 'slate';
    let glDetail = 'Optional - No GitLab repository linked';

    if (gitlabProjects.length > 0) {
      const glWithToken = gitlabProjects.filter(p => p.repoToken && p.repoToken.trim() !== '');
      if (glWithToken.length === gitlabProjects.length) {
        glStatus = 'connected';
        glText = 'Connected';
        glColor = 'emerald';
        glDetail = `${gitlabProjects.length} GitLab ${gitlabProjects.length === 1 ? 'repo' : 'repos'} connected`;
      } else if (glWithToken.length > 0) {
        glStatus = 'connected_partial';
        glText = 'Partial';
        glColor = 'emerald';
        glDetail = `${glWithToken.length} of ${gitlabProjects.length} GitLab repos configured`;
      } else {
        glStatus = 'not_linked';
        glText = 'Not Linked';
        glColor = 'slate';
        glDetail = `Optional - Token not configured for ${gitlabProjects.length} GitLab repo(s)`;
      }
    }

    res.json({
      github: {
        provider: 'github',
        name: 'GitHub',
        status: ghStatus,
        label: ghText,
        color: ghColor,
        details: ghDetail,
        count: githubProjects.length,
        repoCount: githubProjects.length,
        hasToken: githubProjects.length > 0 && githubProjects.every(p => p.repoToken && p.repoToken.trim() !== '')
      },
      gitlab: {
        provider: 'gitlab',
        name: 'GitLab',
        status: glStatus,
        label: glText,
        color: glColor,
        details: glDetail,
        count: gitlabProjects.length,
        repoCount: gitlabProjects.length,
        hasToken: gitlabProjects.length > 0 && gitlabProjects.every(p => p.repoToken && p.repoToken.trim() !== '')
      }
    });
  } catch (err: any) {
    console.error("Error fetching integration status:", err);
    res.status(500).json({ error: "Failed to fetch integration status" });
  }
});

// Project Members APIs
router.get("/projects/:id/members", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkProjectAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to project members." });
    }
    const members = await db.all(`
      SELECT u.id, u.name, u.email, u.role as globalRole, pm.role, pm.joinedAt, pm.projectId
      FROM project_members pm
      JOIN users u ON pm.userId = u.id
      WHERE pm.projectId = ?
    `, req.params.id);
    res.json(members);
  } catch (err: any) {
    console.error("Error fetching project members:", err);
    res.status(500).json({ error: "Failed to fetch project members" });
  }
});

router.post("/projects/:id/members", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const projectId = req.params.id;
    const { userId, role } = req.body;

    const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    if (!project) return res.sendStatus(404);

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin) {
      return res.status(403).json({ error: "Only admins, project owner or project admins can manage members." });
    }

    const ALLOWED_PROJECT_ROLES = ['admin', 'member', 'viewer', 'contributor', 'lead'];
    const newRole = ALLOWED_PROJECT_ROLES.includes(role) ? role : 'member';

    const targetUser = await db.get("SELECT id FROM users WHERE id = ?", userId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    try {
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, ?, ?) ON CONFLICT(projectId, userId) DO UPDATE SET role = ?",
        [projectId, userId, newRole, new Date().toISOString(), newRole]
      );
      res.json({ success: true });
    } catch (e: any) {
      if (e.message?.includes("UNIQUE constraint failed") || e.code === 'SQLITE_CONSTRAINT' || e.code === '23505' || e.message?.includes("duplicate key value")) {
        await db.run("UPDATE project_members SET role = ? WHERE projectId = ? AND userId = ?", [newRole, projectId, userId]);
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to add/update member" });
      }
    }
  } catch (err: any) {
    console.error("Error adding project member:", err);
    res.status(500).json({ error: "Failed to add project member" });
  }
});

router.delete("/projects/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const projectId = req.params.id;

    const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    if (!project) return res.sendStatus(404);

    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';

    if (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: "Only admins, project owner or project admins can remove members." });
    }

    await db.run("DELETE FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.params.userId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error removing project member:", err);
    res.status(500).json({ error: "Failed to remove project member" });
  }
});

// Teams APIs
router.get("/teams", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    let teams;
    if (isAdminOrSuperAdmin(req.user)) {
      teams = await db.all("SELECT * FROM teams");
    } else {
      teams = await db.all(`
        SELECT DISTINCT t.* 
        FROM teams t 
        LEFT JOIN project_members pm ON t.projectId = pm.projectId 
        LEFT JOIN projects p ON t.projectId = p.id
        LEFT JOIN team_members tm ON t.id = tm.teamId
        WHERE t.ownerId = ? 
           OR tm.userId = ? 
           OR (t.projectId IS NOT NULL AND (pm.userId = ? OR p.ownerId = ?))
      `, [req.user.id, req.user.id, req.user.id, req.user.id]);
    }
    res.json(teams);
  } catch (err: any) {
    console.error("Error fetching teams:", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

router.post("/teams", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;

    const { name, description, projectId } = req.body;

    if (projectId) {
      const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
      const isProjectAdmin = pm && pm.role === 'admin';
      if (!project || (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin)) {
         return res.status(403).json({ error: "Only admins, project owner or project admins can create teams for this project." });
      }
    } else {
      const canManageTeams = await hasPermission(req.user, "manage_teams");
      if (!canManageTeams) {
        return res.status(403).json({ error: "You do not have permission to create global teams." });
      }
    }

    const teamId = uuidv4();
    await db.run(
      "INSERT INTO teams (id, name, description, ownerId, createdAt, projectId) VALUES (?, ?, ?, ?, ?, ?)",
      [teamId, name, description || "", req.user.id, new Date().toISOString(), projectId || null]
    );
    // add owner to members
    await db.run(
      "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
      [uuidv4(), teamId, req.user.id, new Date().toISOString()]
    );
    const newTeam = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
    res.json(newTeam);
  } catch (err: any) {
    console.error("Error creating team:", err);
    res.status(500).json({ error: "Failed to create team" });
  }
});

const checkTeamAccess = async (db: any, teamId: string, user: any): Promise<boolean> => {
  if (isAdminOrSuperAdmin(user)) return true;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  if (!team) return false;
  if (team.ownerId === user.id) return true;
  const tm = await db.get("SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?", [teamId, user.id]);
  if (tm) return true;
  if (team.projectId) {
    return await checkProjectAccess(db, team.projectId, user);
  }
  return false;
};

router.get("/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkTeamAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to team members." });
    }
    const members = await db.all(`
      SELECT u.id, u.name, u.email, u.role, tm.joinedAt, tm.teamId
      FROM team_members tm
      JOIN users u ON tm.userId = u.id
      WHERE tm.teamId = ?
    `, req.params.id);
    res.json(members);
  } catch (err: any) {
    console.error("Error fetching team members:", err);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

router.post("/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const { userId } = req.body;
    const teamId = req.params.id;

    const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
    if (!team) return res.sendStatus(404);

    if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id) {
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
      if (err.message?.includes("UNIQUE constraint failed") || err.code === '23505' || err.message?.includes("duplicate key value")) {
        res.status(400).json({ error: "User is already in team" });
      } else {
        res.status(500).json({ error: "Failed to add member" });
      }
    }
  } catch (err: any) {
    console.error("Error in add team member handler:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.delete("/teams/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;

    const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    if (!team) return res.sendStatus(404);

    if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: "Only admins or the team owner can remove members." });
    }

    await db.run("DELETE FROM team_members WHERE teamId = ? AND userId = ?", [req.params.id, req.params.userId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error removing team member:", err);
    res.status(500).json({ error: "Failed to remove team member" });
  }
});

router.get("/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    if (!(await checkTeamAccess(db, req.params.id, req.user))) {
      return res.status(403).json({ error: "Access denied to team projects." });
    }
    const projects = await db.all(`
      SELECT p.* 
      FROM projects p
      JOIN team_projects tp ON p.id = tp.projectId
      WHERE tp.teamId = ?
    `, req.params.id);
    res.json(projects.map(sanitizeProject));
  } catch (err: any) {
    console.error("Error fetching team projects:", err);
    res.status(500).json({ error: "Failed to fetch team projects" });
  }
});

router.post("/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;

    const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    if (!team) return res.sendStatus(404);

    if (!isAdminOrSuperAdmin(req.user)) {
      if (team.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Only admins or the team owner can add projects." });
      }
      const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", req.body.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.body.projectId, req.user.id]);
      if (project.ownerId !== req.user.id && (!pm || pm.role !== 'admin')) {
        return res.status(403).json({ error: "You must be a project admin or owner to link this project to a team." });
      }
    }

    try {
      await db.run(
        "INSERT INTO team_projects (teamId, projectId) VALUES (?, ?)",
        [req.params.id, req.body.projectId]
      );
      res.json({ success: true });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint failed") || err.code === '23505' || err.message?.includes("duplicate key value")) {
        res.status(400).json({ error: "Project is already in team" });
      } else {
        res.status(500).json({ error: "Failed to add project" });
      }
    }
  } catch (err: any) {
    console.error("Error in add team project handler:", err);
    res.status(500).json({ error: "Failed to add project" });
  }
});

router.delete("/teams/:id/projects/:projectId", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;

    const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    if (!team) return res.sendStatus(404);

    if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only admins or the team owner can remove projects." });
    }

    await db.run("DELETE FROM team_projects WHERE teamId = ? AND projectId = ?", [req.params.id, req.params.projectId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error removing team project:", err);
    res.status(500).json({ error: "Failed to remove team project" });
  }
});

router.put("/teams/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    if (!team) return res.sendStatus(404);

    const canManageTeams = await hasPermission(req.user, "manage_teams");
    if (!canManageTeams && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only team owners, admins, or authorized roles can edit this team." });
    }

    const { name = null, description = null, projectId } = req.body;
    
    if (projectId !== undefined) {
      await db.run(
        "UPDATE teams SET name = COALESCE(?, name), description = COALESCE(?, description), projectId = ? WHERE id = ?",
        [name, description, projectId, req.params.id]
      );
    } else {
      await db.run(
        "UPDATE teams SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
        [name, description, req.params.id]
      );
    }
    
    const updatedTeam = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    res.json(updatedTeam);
  } catch (err: any) {
    console.error("Error updating team:", err);
    res.status(500).json({ error: "Failed to update team" });
  }
});

router.delete("/teams/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
    if (!team) return res.sendStatus(404);
    
    const canManageTeams = await hasPermission(req.user, "manage_teams");
    if (!canManageTeams && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only team owners, admins, or authorized roles can delete this team." });
    }

    await db.run("DELETE FROM teams WHERE id = ?", req.params.id);
    await db.run("DELETE FROM team_members WHERE teamId = ?", req.params.id);
    await db.run("DELETE FROM team_projects WHERE teamId = ?", req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting team:", err);
    res.status(500).json({ error: "Failed to delete team" });
  }
});
