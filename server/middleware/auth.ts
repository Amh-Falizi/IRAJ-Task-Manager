import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, SECRET_KEY } from "../config.js";
import { dbPromise } from "../db.js";

export const authenticateToken = (req: any, res: any, next: any) => {
  const token =
    req.cookies?.[AUTH_COOKIE_NAME] ||
    (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.sendStatus(401);

  let decodedUser: any = null;
  try {
    decodedUser = jwt.verify(token, SECRET_KEY, { algorithms: ["HS256"] });
  } catch (err) {
    return res.sendStatus(403);
  }

  if (!decodedUser) return res.sendStatus(403);

  (async () => {
    try {
      const db = await dbPromise;
      const user = await db.get(
        "SELECT id, name, email, role, rolePrefix, status, tokenVersion, emailVerified FROM users WHERE id = ?",
        decodedUser.id
      );
      if (!user) {
        return res.sendStatus(403); // User was deleted
      }
      if (
        user.status &&
        (user.status.toLowerCase() === "inactive" ||
          user.status.toLowerCase() === "disabled" ||
          user.status.toLowerCase() === "suspended")
      ) {
        return res.status(403).json({ error: "Account is inactive or disabled." });
      }
      if (user.emailVerified === 0 || user.emailVerified === false) {
        return res.status(403).json({ error: "Email address is not verified." });
      }
      const userTokenVersion = user.tokenVersion ?? 1;
      const decodedTokenVersion = decodedUser.tokenVersion;
      if (decodedTokenVersion === undefined || decodedTokenVersion !== userTokenVersion) {
        return res.status(401).json({ error: "Session expired or revoked. Please sign in again." });
      }
      req.user = user;
      next();
    } catch (e) {
      console.error("Auth DB Error:", e);
      return res.sendStatus(500);
    }
  })();
};

export const isSuperAdmin = (user: any): boolean => user?.role === "super_admin";
export const isAdminOrSuperAdmin = (user: any): boolean =>
  user?.role === "super_admin" || user?.role === "admin";

export const isProjectAdminOrOwner = async (
  db: any,
  projectId: string,
  user: any
): Promise<boolean> => {
  if (isAdminOrSuperAdmin(user)) return true;
  const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
  if (!project) return false;
  if (project.ownerId === user.id) return true;
  const pm = await db.get(
    "SELECT role FROM project_members WHERE projectId = ? AND userId = ?",
    [projectId, user.id]
  );
  if (pm && (pm.role === "admin" || pm.role === "lead")) return true;
  return false;
};

export const checkProjectAccess = async (
  db: any,
  projectId: string,
  user: any
): Promise<boolean> => {
  if (isAdminOrSuperAdmin(user)) return true;

  const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
  if (!project) return false;
  if (project.ownerId === user.id) return true;

  const pm = await db.get(
    "SELECT role FROM project_members WHERE projectId = ? AND userId = ?",
    [projectId, user.id]
  );
  if (pm) return true;

  const tm = await db.get(
    "SELECT 1 FROM team_projects tp JOIN team_members tm ON tp.teamId = tm.teamId WHERE tp.projectId = ? AND tm.userId = ?",
    [projectId, user.id]
  );
  if (tm) return true;

  return false;
};

/**
 * Validates that the user has write/mutation access to the project.
 * Viewers (role === 'viewer') have read-only access and are denied write access.
 */
export const checkProjectWriteAccess = async (
  db: any,
  projectId: string,
  user: any
): Promise<boolean> => {
  if (isAdminOrSuperAdmin(user)) return true;

  const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
  if (!project) return false;
  if (project.ownerId === user.id) return true;

  const pm = await db.get(
    "SELECT role FROM project_members WHERE projectId = ? AND userId = ?",
    [projectId, user.id]
  );
  if (pm) {
    if (pm.role === "viewer") return false;
    return true;
  }

  const tm = await db.get(
    "SELECT 1 FROM team_projects tp JOIN team_members tm ON tp.teamId = tm.teamId WHERE tp.projectId = ? AND tm.userId = ?",
    [projectId, user.id]
  );
  if (tm) return true;

  return false;
};

/**
 * Get all project records accessible to the given user based on the canonical project access policy.
 */
export const getAccessibleProjects = async (db: any, user: any): Promise<any[]> => {
  if (isAdminOrSuperAdmin(user)) {
    return await db.all("SELECT * FROM projects");
  }

  return await db.all(
    `SELECT DISTINCT p.* 
     FROM projects p 
     LEFT JOIN project_members pm ON p.id = pm.projectId 
     LEFT JOIN team_projects tp ON p.id = tp.projectId 
     LEFT JOIN team_members tm ON tp.teamId = tm.teamId 
     WHERE p.ownerId = ? 
        OR pm.userId = ? 
        OR tm.userId = ?`,
    [user.id, user.id, user.id]
  );
};

/**
 * Get the set of all user IDs authorized to access a given project.
 */
export const getAuthorizedProjectUserIds = async (db: any, projectId: string): Promise<Set<string>> => {
  const authorized = new Set<string>();
  const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
  if (!project) return authorized;
  if (project.ownerId) authorized.add(project.ownerId);

  const members = await db.all(
    `SELECT userId FROM project_members WHERE projectId = ?
     UNION
     SELECT tm.userId FROM team_members tm JOIN team_projects tp ON tm.teamId = tp.teamId WHERE tp.projectId = ?`,
    [projectId, projectId]
  );
  members.forEach((m: any) => {
    if (m.userId) authorized.add(m.userId);
  });

  return authorized;
};

export const checkTaskAccess = async (
  db: any,
  taskId: string,
  user: any
): Promise<{ allowed: boolean; task: any | null }> => {
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", taskId);
  if (!task) return { allowed: false, task: null };
  if (isAdminOrSuperAdmin(user)) return { allowed: true, task };
  if (task.creatorId === user.id || task.assigneeId === user.id) return { allowed: true, task };
  if (task.projectId) {
    const hasProjAccess = await checkProjectAccess(db, task.projectId, user);
    if (hasProjAccess) return { allowed: true, task };
  }
  return { allowed: false, task };
};

export const hasPermission = async (user: any, permission: string): Promise<boolean> => {
  if (!user) return false;
  if (user.role === "super_admin") return true;

  try {
    const db = await dbPromise;
    const roleRow = await db.get("SELECT permissions FROM roles WHERE id = ?", user.role);
    if (!roleRow) {
      return false;
    }
    const perms = JSON.parse(roleRow.permissions || "{}");
    return !!perms[permission];
  } catch (e) {
    console.error("Error checking permission:", e);
    return false;
  }
};

export const canManageUsers = async (user: any): Promise<boolean> => {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return await hasPermission(user, "manage_users");
};

export const canManageRoles = async (user: any): Promise<boolean> => {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return await hasPermission(user, "manage_roles");
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && (isAdminOrSuperAdmin(req.user) || req.user.role === "super_admin")) {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
};

export const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === "super_admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Super Admin privileges required." });
  }
};

