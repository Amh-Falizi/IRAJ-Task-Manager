import fs from 'fs';
import path from 'path';

function walk(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        walk(path.join(dir, file), fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

function refactor() {
  const files = walk('./src');
  
  for (const file of files) {
    if (file.includes('config.ts') || file.includes('refactor.ts')) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    let changed = false;

    // Replace '/api/...' -> `${config.apiBaseUrl}/...` inside fetch
    // Actually, maybe not just fetch, but anywhere '/api' or `/api` is used.
    // e.g. fetch('/api/tasks' -> fetch(`${config.apiBaseUrl}/tasks`
    if (content.match(/['"`]\/api/)) {
      // replace '/api/...' with `${config.apiBaseUrl}/...`
      content = content.replace(/'\/api([^']*)'/g, '`${config.apiBaseUrl}$1`');
      
      // replace `/api/...` with `${config.apiBaseUrl}/...`
      content = content.replace(/`\/api([^`]*)`/g, '`${config.apiBaseUrl}$1`');
      
      changed = true;
    }

    if (changed) {
      // Add import config
      const isSrcRoot = !file.includes('/') && !file.includes('\\') || file.split(path.sep).length === 2; // e.g. src/App.tsx
      const depth = file.split(path.sep).length - 2; // e.g. src/pages/Board.tsx -> depth 1 -> '../config'
      
      let importPath = './config';
      if (depth === 1) importPath = '../config';
      if (depth === 2) importPath = '../../config';
      if (depth === 3) importPath = '../../../config';
      
      const importStatement = `import config from "${importPath}";\n`;
      if (!content.includes('import config from')) {
        // find first import to put it after
        content = importStatement + content;
      }
      
      fs.writeFileSync(file, content);
      console.log(`Refactored ${file}`);
    }
  }
}

refactor();
