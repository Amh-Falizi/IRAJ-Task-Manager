const fs = require('fs');

const filesToInjectToastObj = [
  'src/components/TaskModal.tsx',
  'src/pages/Board.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Projects.tsx',
  'src/pages/Planning.tsx',
  'src/pages/Teams.tsx'
];

for (const f of filesToInjectToastObj) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    
    // Add useToast import if not there
    if (!content.includes('useToast')) {
      content = content.replace(/(import .* from '..\/contexts\/AuthContext';)/, "$1\nimport { useToast } from '../contexts/ToastContext';");
    }
    
    // Add toast to the component body.
    // We look for:
    // export default function ComponentName(...) {
    //   const { ... } = useAuth();
    if (!content.includes('const { toast, success, error, info } = useToast();') && !content.includes('const { success, error, info } = useToast();') && !content.includes('const toast = useToast();')) {
      content = content.replace(/(const {.*?useAuth\(\);)/, "$1\n  const { success, error, info } = useToast();");
    }

    fs.writeFileSync(f, content, 'utf8');
  }
}
