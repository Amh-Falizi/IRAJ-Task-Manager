const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'const searchTerm = `%${query}%`;',
  'const searchTerm = `%${query.toLowerCase()}%`;'
);
code = code.replace(
  'WHERE (p.ownerId = ? OR pm.userId = ?) AND (p.name LIKE ? OR p.description LIKE ?)',
  'WHERE (p.ownerId = ? OR pm.userId = ?) AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)'
);
code = code.replace(
  'AND (t.title LIKE ? OR t.description LIKE ?)',
  'AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ?)'
);
code = code.replace(
  'AND (d.title LIKE ? OR d.content LIKE ?)',
  'AND (LOWER(d.title) LIKE ? OR LOWER(d.content) LIKE ?)'
);
code = code.replace(
  'WHERE name LIKE ? OR email LIKE ?',
  'WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?'
);
fs.writeFileSync('server.ts', code);
