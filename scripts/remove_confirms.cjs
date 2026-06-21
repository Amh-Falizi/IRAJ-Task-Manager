const fs = require('fs');
const glob = require('glob');

const files = [
  'src/pages/Board.tsx',
  'src/pages/CalendarView.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Graph.tsx',
  'src/pages/Planning.tsx',
  'src/pages/Projects.tsx',
  'src/pages/Teams.tsx',
  'src/pages/UsersAdmin.tsx',
  'src/components/ProjectMembersModal.tsx',
  'src/components/ProjectTeamsModal.tsx',
  'src/components/TaskModal.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(/[ \t]*if *\(!?window\.confirm\([^)]+\)\) return;/g, '');
    content = content.replace(/[ \t]*if *\(!?confirm\([^)]+\)\) return;/g, '');
    
    // specifically handle src/components/TaskModal.tsx
    content = content.replace(/[ \t]*if *\(!confirm\('Delete this comment\?'\) \|\| \!task\) return;/g, '\n    if (!task) return;');
    
    fs.writeFileSync(file, content);
  }
});
