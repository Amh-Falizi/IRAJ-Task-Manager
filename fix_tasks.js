const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// POST /api/tasks parentId cross-project fix
code = code.replace(
  'const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", newTask.parentId);',
  'const parentTask = await db.get("SELECT * FROM tasks WHERE id = ? AND projectId = ?", [newTask.parentId, newTask.projectId]);'
);

// PUT /api/tasks/:id parentId and projectId check
const putProjectCheck = `  if (req.body.projectId !== undefined && String(req.body.projectId) !== String(task.projectId)) {
    const hasDestAccess = await checkProjectAccess(db, req.body.projectId, req.user);
    if (!hasDestAccess) {
      return res.status(403).json({ error: "You do not have access to the destination project." });
    }
  }
  
  if (req.body.parentId !== undefined && req.body.parentId !== null) {
    const parentTask = await db.get("SELECT projectId FROM tasks WHERE id = ?", req.body.parentId);
    if (parentTask && String(parentTask.projectId) !== String(req.body.projectId || task.projectId)) {
      return res.status(400).json({ error: "Parent task must be in the same project." });
    }
  }

  const updated = { ...task, ...req.body, id: task.id };`;

code = code.replace('  const updated = { ...task, ...req.body, id: task.id };', putProjectCheck);

fs.writeFileSync('server.ts', code);
