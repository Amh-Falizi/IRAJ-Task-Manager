import express, { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { dbPromise } from "../db.js";
import { SECRET_KEY, setAuthCookie } from "../config.js";
import {
  authenticateToken,
  isAdminOrSuperAdmin,
  canManageUsers,
  canManageRoles
} from "../middleware/auth.js";
import { AuthRequest } from "../types.js";

export const usersRouter = express.Router();
const router = usersRouter;

// Update Profile
router.put("/users/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const { name, skills, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required." });
    }

    // Prevent users from setting admin lockout statuses on themselves
    const disallowedStatuses = ['inactive', 'disabled', 'suspended'];
    let statusVal = status || "Available";
    if (disallowedStatuses.includes(statusVal.toLowerCase())) {
      statusVal = "Available";
    }

    if (skills !== undefined) {
      await db.run(
        "UPDATE users SET name = ?, skills = ?, status = ? WHERE id = ?",
        [name, JSON.stringify(skills), statusVal, req.user!.id]
      );
    } else {
      await db.run(
        "UPDATE users SET name = ?, status = ? WHERE id = ?",
        [name, statusVal, req.user!.id]
      );
    }
    
    const updatedUser = await db.get("SELECT id, name, email, role, skills, rolePrefix, status FROM users WHERE id = ?", req.user!.id);
    res.json({
      ...updatedUser,
      skills: updatedUser.skills ? JSON.parse(updatedUser.skills) : [],
      rolePrefix: updatedUser.rolePrefix || "",
      status: updatedUser.status || "Available"
    });
  } catch (err: any) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// Change Password
router.put("/users/me/password", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required." });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    const user = await db.get("SELECT passwordHash, tokenVersion, role FROM users WHERE id = ?", req.user!.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const nextTokenVersion = (user.tokenVersion || 1) + 1;
    await db.run("UPDATE users SET passwordHash = ?, tokenVersion = ? WHERE id = ?", [passwordHash, nextTokenVersion, req.user!.id]);
    
    const newToken = jwt.sign({ id: req.user!.id, role: user.role, tokenVersion: nextTokenVersion }, SECRET_KEY, { expiresIn: "7d" });
    setAuthCookie(res, newToken);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password." });
  }
});

// User Stats
router.get("/users/me/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const tasksCount = await db.get("SELECT COUNT(*) as count FROM tasks WHERE assigneeId = ?", req.user!.id);
    const projectsCountQuery = isAdminOrSuperAdmin(req.user) 
      ? "SELECT COUNT(*) as count FROM projects" 
      : "SELECT COUNT(DISTINCT projectId) as count FROM project_members WHERE userId = ?";
    const projectsCount = await db.get(projectsCountQuery, isAdminOrSuperAdmin(req.user) ? [] : [req.user!.id]);
    
    const recentActivity = await db.all(`
      SELECT a.*, t.title as taskTitle
      FROM task_activities a
      JOIN tasks t ON a.taskId = t.id
      WHERE a.userId = ?
      ORDER BY a.createdAt DESC
      LIMIT 10
    `, [req.user!.id]);

    res.json({
      tasks: tasksCount ? Number(tasksCount.count) : 0,
      projects: projectsCount ? Number(projectsCount.count) : 0,
      recentActivity
    });
  } catch (err: any) {
    console.error("Fetch user stats error:", err);
    res.status(500).json({ error: "Failed to fetch user statistics." });
  }
});

// Global Search
router.get("/search", authenticateToken, async (req: AuthRequest, res: Response) => {
  const query = req.query.q as string | undefined;
  if (!query) return res.json({ projects: [], tasks: [], documents: [], users: [] });

  const userId = req.user!.id;
  const userRole = req.user!.role;
  const searchTerm = `%${query.toLowerCase()}%`;
  const db = await dbPromise;

  try {
    let projects;
    let tasks;
    let documents;

    if (isAdminOrSuperAdmin(req.user)) {
      projects = await db.all("SELECT id, name as title, description, 'project' as type FROM projects WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?", [searchTerm, searchTerm]);
      tasks = await db.all("SELECT id, title, description, 'task' as type, projectId FROM tasks WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?", [searchTerm, searchTerm]);
      documents = await db.all("SELECT id, title, 'document' as type, projectId FROM documents WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?", [searchTerm, searchTerm]);
    } else {
      projects = await db.all(`
        SELECT DISTINCT p.id, p.name as title, p.description, 'project' as type 
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        LEFT JOIN tasks t ON p.id = t.projectId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR t.assigneeId = ? OR t.creatorId = ?) AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)
      `, [userId, userId, userId, userId, userId, searchTerm, searchTerm]);

      tasks = await db.all(`
        SELECT DISTINCT t.id, t.title, t.description, 'task' as type, t.projectId
        FROM tasks t
        LEFT JOIN projects p ON t.projectId = p.id
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR t.creatorId = ? OR t.assigneeId = ?) 
        AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ?)
      `, [userId, userId, userId, userId, userId, searchTerm, searchTerm]);

      documents = await db.all(`
        SELECT DISTINCT d.id, d.title, 'document' as type, d.projectId
        FROM documents d
        LEFT JOIN projects p ON d.projectId = p.id
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR d.authorId = ?) 
        AND (LOWER(d.title) LIKE ? OR LOWER(d.content) LIKE ?)
      `, [userId, userId, userId, userId, searchTerm, searchTerm]);
    }

    let users: any[] = [];
    if (userRole === 'admin' || userRole === 'super_admin') {
      users = await db.all(`
        SELECT id, name as title, email as description, 'user' as type
        FROM users
        WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
      `, [searchTerm, searchTerm]);
    }

    res.json({ projects, tasks, documents, users });
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Users (for assigning tasks and team directories)
router.get("/users", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const canSeeAll = isAdminOrSuperAdmin(req.user) || await canManageUsers(req.user);
    
    if (canSeeAll) {
      const users = await db.all("SELECT id, name, email, role, skills, rolePrefix, status FROM users");
      return res.json(users.map((u: any) => ({ ...u, skills: u.skills ? JSON.parse(u.skills) : [], rolePrefix: u.rolePrefix || "", status: u.status || "Available" })));
    }

    // Non-admins only get peers who share projects/teams with them (and self), preventing stranger enumeration
    const users = await db.all(`
      SELECT DISTINCT u.id, u.name, u.role, u.skills, u.rolePrefix, u.status, u.email
      FROM users u
      JOIN (
        SELECT ? as peerId
        UNION
        SELECT pm_peer.userId as peerId
        FROM project_members pm_my
        JOIN project_members pm_peer ON pm_peer.projectId = pm_my.projectId
        WHERE pm_my.userId = ?
        UNION
        SELECT p.ownerId as peerId
        FROM project_members pm_my
        JOIN projects p ON p.id = pm_my.projectId
        WHERE pm_my.userId = ?
        UNION
        SELECT pm.userId as peerId
        FROM projects p
        JOIN project_members pm ON pm.projectId = p.id
        WHERE p.ownerId = ?
        UNION
        SELECT tm_peer.userId as peerId
        FROM team_members tm_my
        JOIN team_members tm_peer ON tm_peer.teamId = tm_my.teamId
        WHERE tm_my.userId = ?
      ) peers ON peers.peerId = u.id
      WHERE u.status IS NULL OR (LOWER(u.status) != 'disabled' AND LOWER(u.status) != 'inactive' AND LOWER(u.status) != 'suspended')
    `, [req.user!.id, req.user!.id, req.user!.id, req.user!.id, req.user!.id]);
    
    res.json(users.map((u: any) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      skills: u.skills ? (typeof u.skills === 'string' ? JSON.parse(u.skills) : u.skills) : [],
      rolePrefix: u.rolePrefix || "",
      status: u.status || "Available",
      email: u.id === req.user!.id ? u.email : undefined
    })));
  } catch (err: any) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to retrieve users." });
  }
});

// Admin create user
router.post("/users", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageUsers(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with user management permissions can create users." });
    }
    let { name, email, password, role, rolePrefix } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields." });
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    if (email) email = email.toLowerCase().trim();

    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can assign Admin or Super Admin roles." });
    }
    
    const db = await dbPromise;
    const existing = await db.get("SELECT * FROM users WHERE email = ? ", email);
    if (existing) return res.status(400).json({ error: "Email already registered." });

    const roleExists = role ? await db.get("SELECT * FROM roles WHERE id = ?", role) : null;
    const finalRole = roleExists ? role : "developer";

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = uuidv4();

    await db.run(
      "INSERT INTO users (id, name, email, passwordHash, role, rolePrefix, status, tokenVersion, authProvider, emailVerified) VALUES (?, ?, ?, ?, ?, ?, 'Available', 1, 'local', 1)",
      [id, name, email, passwordHash, finalRole, rolePrefix || null]
    );
    const newUser = await db.get("SELECT id, name, email, role, rolePrefix, status FROM users WHERE id = ?", id);
    res.json({ ...newUser, rolePrefix: newUser.rolePrefix || "", status: newUser.status || "Available" });
  } catch (err: any) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user." });
  }
});

// Admin bulk change user roles
router.put("/users/bulk/role", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageUsers(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with user management permissions can perform bulk actions." });
    }

    const { userIds, role } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "At least one user must be selected." });
    }
    if (!role) {
      return res.status(400).json({ error: "Role is required." });
    }

    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can assign Admin or Super Admin roles." });
    }

    const db = await dbPromise;
    
    // Check if any target user is admin or super_admin
    const placeholders = userIds.map(() => "?").join(",");
    const targetPrivileged = await db.all(`SELECT id FROM users WHERE (role = 'super_admin' OR role = 'admin') AND id IN (${placeholders})`, userIds);
    if (targetPrivileged.length > 0 && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can modify Admin or Super Admin accounts." });
    }

    const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
    if (!roleExists) {
      return res.status(400).json({ error: "Invalid role. Role does not exist in definitions." });
    }

    await db.run(`UPDATE users SET role = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id IN (${placeholders})`, [role, ...userIds]);

    res.json({ success: true, message: `Successfully updated roles for ${userIds.length} users.` });
  } catch (err: any) {
    console.error("Bulk role update error:", err);
    res.status(500).json({ error: "Failed to update user roles." });
  }
});

// Admin update user
router.put("/users/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageUsers(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Permission denied." });
    }
    const { name, email, role, password, rolePrefix, status } = req.body;
    if (!name || !email || !role) return res.status(400).json({ error: "Missing required fields." });
    
    const db = await dbPromise;
    const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    if ((targetUser.role === "super_admin" || targetUser.role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can edit Admin or Super Admin accounts." });
    }
    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can assign Admin or Super Admin roles." });
    }

    const existing = await db.get("SELECT * FROM users WHERE email = ? AND id != ?", [email, req.params.id]);
    if (existing) return res.status(400).json({ error: "Email already in use." });

    const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
    if (!roleExists) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    const statusVal = status || "Available";

    if (password) {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long." });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await db.run(
        "UPDATE users SET name = ?, email = ?, role = ?, passwordHash = ?, rolePrefix = ?, status = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?",
        [name, email, role, passwordHash, rolePrefix || null, statusVal, req.params.id]
      );
    } else {
      const shouldInvalidate = (statusVal.toLowerCase() === 'disabled' || statusVal.toLowerCase() === 'suspended' || role !== targetUser.role);
      if (shouldInvalidate) {
        await db.run(
          "UPDATE users SET name = ?, email = ?, role = ?, rolePrefix = ?, status = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?",
          [name, email, role, rolePrefix || null, statusVal, req.params.id]
        );
      } else {
        await db.run(
          "UPDATE users SET name = ?, email = ?, role = ?, rolePrefix = ?, status = ? WHERE id = ?",
          [name, email, role, rolePrefix || null, statusVal, req.params.id]
        );
      }
    }
    const updatedUser = await db.get("SELECT id, name, email, role, rolePrefix, status FROM users WHERE id = ?", req.params.id);
    res.json({ ...updatedUser, rolePrefix: updatedUser.rolePrefix || "", status: updatedUser.status || "Available" });
  } catch (err: any) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user." });
  }
});

// Admin delete user
router.delete("/users/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageUsers(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Permission denied." });
    }
    
    const db = await dbPromise;
    const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    if (targetUser.role === "super_admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can delete Super Admin accounts." });
    }

    if (req.user!.id === req.params.id) {
       return res.status(400).json({ error: "Cannot delete your own account." });
    }

    await db.run("DELETE FROM users WHERE id = ?", req.params.id);
    await db.run("DELETE FROM project_members WHERE userId = ?", req.params.id);
    await db.run("DELETE FROM team_members WHERE userId = ?", req.params.id);
    await db.run("DELETE FROM password_resets WHERE userId = ?", req.params.id);
    await db.run("UPDATE tasks SET assigneeId = NULL WHERE assigneeId = ?", req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// Admin change user role
router.put("/users/:id/role", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageUsers(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Permission denied." });
    }

    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: "Role is required." });
    }

    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can assign Admin or Super Admin roles." });
    }

    const db = await dbPromise;
    const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    if ((targetUser.role === "super_admin" || targetUser.role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can edit Admin or Super Admin accounts." });
    }

    const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
    if (!roleExists) {
      return res.status(400).json({ error: "Invalid role. Role does not exist in definitions." });
    }

    await db.run(
      "UPDATE users SET role = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?",
      [role, req.params.id]
    );
    const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.params.id);
    res.json(updatedUser);
  } catch (err: any) {
    console.error("Change user role error:", err);
    res.status(500).json({ error: "Failed to change user role." });
  }
});

// Roles API endpoints
const VALID_PERMS = [
  "manage_users",
  "manage_roles",
  "manage_projects",
  "manage_teams",
  "reset_database",
  "create_tasks",
  "edit_all_tasks",
  "delete_tasks",
] as const;

function sanitizeAndValidatePermissions(permissions: any, userRole: string): { valid: boolean; perms: Record<string, boolean>; error?: string } {
  let inputPerms: any = {};
  if (permissions !== undefined && permissions !== null) {
    try {
      inputPerms = typeof permissions === "string" ? JSON.parse(permissions) : (typeof permissions === "object" ? permissions : {});
    } catch {
      inputPerms = {};
    }
  }
  const parsedPerms: Record<string, boolean> = {};
  for (const key of VALID_PERMS) {
    if (inputPerms[key] === true) {
      if ((key === "manage_users" || key === "manage_roles" || key === "reset_database") && userRole !== "super_admin") {
        return { valid: false, perms: {}, error: "Only Super Admin can grant manage_users, manage_roles, or reset_database." };
      }
      parsedPerms[key] = true;
    }
  }
  return { valid: true, perms: parsedPerms };
}

// Get all roles
router.get("/roles", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageRoles(req.user) || isAdminOrSuperAdmin(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only admins or role managers can view roles." });
    }
    const db = await dbPromise;
    const roles = await db.all("SELECT * FROM roles ORDER BY is_custom ASC, name ASC");
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Create custom role
router.post("/roles", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can create custom roles." });
    }
    let { id, name, description, permissions } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "Role ID and Name are required." });
    }
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, "").trim();
    if (id === "") {
      return res.status(400).json({ error: "Invalid Role ID. Must be alphanumeric." });
    }

    const BUILT_IN_ROLES = ["super_admin", "admin", "manager", "developer"];
    if (BUILT_IN_ROLES.includes(id)) {
      return res.status(400).json({ error: "Cannot create a role with a reserved system role ID." });
    }
    
    const db = await dbPromise;
    const existing = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (existing) {
      return res.status(400).json({ error: "A role with this ID already exists." });
    }

    const permCheck = sanitizeAndValidatePermissions(permissions, req.user!.role);
    if (!permCheck.valid) {
      return res.status(403).json({ error: permCheck.error });
    }

    const permsStr = JSON.stringify(permCheck.perms);

    await db.run(
      "INSERT INTO roles (id, name, description, is_custom, permissions) VALUES (?, ?, ?, 1, ?)",
      [id, name, description || "", permsStr]
    );

    const newRole = await db.get("SELECT * FROM roles WHERE id = ?", id);
    res.json(newRole);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update role permissions and settings
router.put("/roles/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (id === "super_admin") {
      return res.status(400).json({ error: "Super Admin role permissions are immutable." });
    }
    const BUILT_IN_ROLES = ["admin", "manager", "developer"];
    if (BUILT_IN_ROLES.includes(id) && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can modify built-in role permissions." });
    }

    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can update roles." });
    }

    const { name, description, permissions } = req.body;
    
    let permsToSave: string | undefined = undefined;
    if (permissions !== undefined) {
      const permCheck = sanitizeAndValidatePermissions(permissions, req.user!.role);
      if (!permCheck.valid) {
        return res.status(403).json({ error: permCheck.error });
      }
      permsToSave = JSON.stringify(permCheck.perms);
    }

    const db = await dbPromise;
    const role = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (!role) {
      return res.status(404).json({ error: "Role not found." });
    }

    let finalName = role.name;
    if (role.is_custom === 1) {
      if (!name) {
        return res.status(400).json({ error: "Role Name is required." });
      }
      finalName = name;
    }

    const finalPerms = permsToSave !== undefined ? permsToSave : (role.permissions || "{}");

    await db.run(
      "UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?",
      [finalName, description !== undefined ? description : role.description, finalPerms, id]
    );

    const updatedRole = await db.get("SELECT * FROM roles WHERE id = ?", id);
    res.json(updatedRole);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete custom role
router.delete("/roles/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can delete roles." });
    }
    const { id } = req.params;

    const db = await dbPromise;
    const role = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (!role) {
      return res.status(404).json({ error: "Role not found." });
    }
    if (role.is_custom !== 1) {
      return res.status(400).json({ error: "Default roles cannot be deleted." });
    }

    // Delete the role
    await db.run("DELETE FROM roles WHERE id = ?", id);

    // Reassign any users who had this role to 'developer' as default
    await db.run("UPDATE users SET role = 'developer' WHERE role = ?", id);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Settings
router.get("/settings", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;
    const settings = await db.all("SELECT * FROM settings");
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value || "";
      return acc;
    }, {});
    res.json(settingsObj);
  } catch (err: any) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
});

// Update Settings
router.put("/settings", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!isAdminOrSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only admins can change settings." });
    }

    const db = await dbPromise;
    const keys = Object.keys(req.body);
    for (const key of keys) {
      if (!/^[a-zA-Z0-9_]{1,64}$/.test(key)) continue;
      const value = req.body[key];
      if (typeof value !== 'string') continue;
      if (db.isPg) {
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
      } else {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
      }
    }
    
    const settings = await db.all("SELECT * FROM settings");
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value || "";
      return acc;
    }, {});
    res.json(settingsObj);
  } catch (err: any) {
    console.error("Update settings error:", err);
    res.status(500).json({ error: "Failed to update settings." });
  }
});
