const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement1 = `  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
    if (!canManageTask) {
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [task.projectId, req.user.id]);
      if (pm && pm.role !== 'viewer') {
        canManageTask = await hasPermission(req.user, "edit_all_tasks");
      }
    }
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }`;

const replacement2 = `  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
    if (!canManageTask) {
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [task.projectId, req.user.id]);
      if (pm && pm.role !== 'viewer') {
        canManageTask = await hasPermission(req.user, "delete_tasks");
      }
    }
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }`;

const original = `  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }`;

code = code.replace(replacement1, original);
code = code.replace(replacement2, original);

fs.writeFileSync('server.ts', code);
