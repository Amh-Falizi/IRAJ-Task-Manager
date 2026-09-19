import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, SECRET_KEY } from "../config.js";
import { dbPromise } from "../db.js";

export const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) return res.sendStatus(401);

  let decodedUser: any = null;
  try {
    decodedUser = jwt.verify(token, SECRET_KEY);
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

  const t = await db.get(
    "SELECT 1 FROM tasks WHERE projectId = ? AND (assigneeId = ? OR creatorId = ?)",
    [projectId, user.id, user.id]
  );
  if (t) return true;

  return false;
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
