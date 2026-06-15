const fs = require('fs');

let fileStr = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const lines = fileStr.split('\n');

const newLines = [];
let i = 0;
while (i < lines.length) {
  if (i === 524) { // 525 minus 1 = 524 index, which is `                 </AnimatePresence>`
    i = 546; // Skip to length, replacing up to line 547
    newLines.push("                 {activeChart === 'velocity' && (");
  } else {
    newLines.push(lines[i]);
  }
  i++;
}

fileStr = newLines.join('\n');
fileStr = fileStr.replaceAll('activeAnalyticsChart', 'activeChart');

fs.writeFileSync('src/pages/Dashboard.tsx', fileStr, 'utf8');
console.log("Success!");
