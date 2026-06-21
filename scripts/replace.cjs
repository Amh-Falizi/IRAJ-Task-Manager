const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

function processDir(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      processDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = readFileSync(filePath, 'utf8');
      content = content
        .replace(/bg-\[#0f1115\]/g, 'bg-page-bg')
        .replace(/bg-\[#1a1d23\]/g, 'bg-surface')
        .replace(/bg-\[#0a0c10\]/g, 'bg-surface-dim')
        .replace(/bg-\[#2d3139\]/g, 'bg-surface-accent')
        .replace(/border-\[#2d3139\]/g, 'border-border-subtle')
        .replace(/border-\[#3d424e\]/g, 'border-border-strong')
        .replace(/text-slate-300/g, 'text-primary')
        .replace(/text-white/g, 'text-strong')
        .replace(/text-slate-400/g, 'text-muted')
        .replace(/text-slate-500/g, 'text-subtle')
        .replace(/text-slate-200/g, 'text-strong');
      writeFileSync(filePath, content, 'utf8');
    }
  }
}

processDir('src');
console.log('Done replacement');
