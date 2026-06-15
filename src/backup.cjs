const fs = require('fs');

const original = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
fs.writeFileSync('src/pages/Dashboard.tsx.backup', original, 'utf8');
console.log('Backed up Dashboard.tsx');
