const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'if (e.message?.includes("UNIQUE constraint failed") || e.code === \'SQLITE_CONSTRAINT\') {',
  'if (e.message?.includes("UNIQUE constraint failed") || e.code === \'SQLITE_CONSTRAINT\' || e.code === \'23505\' || e.message?.includes("duplicate key value")) {'
);
code = code.replace(
  'if (err.message.includes("UNIQUE constraint failed")) {',
  'if (err.message?.includes("UNIQUE constraint failed") || err.code === \'23505\' || err.message?.includes("duplicate key value")) {'
);
// second one
code = code.replace(
  'if (err.message.includes("UNIQUE constraint failed")) {',
  'if (err.message?.includes("UNIQUE constraint failed") || err.code === \'23505\' || err.message?.includes("duplicate key value")) {'
);
fs.writeFileSync('server.ts', code);
