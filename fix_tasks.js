const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }`;

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

code = code.replace(target1, replacement1);

const target2 = `  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
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

// Since target1 and target2 are the exact same string but appear twice, we can use a regex with a global flag or sequential replace.
let count = 0;
code = code.replace(new RegExp(target1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
  count++;
  if (count === 1) return replacement1;
  if (count === 2) return replacement2;
  return match;
});

fs.writeFileSync('server.ts', code);
