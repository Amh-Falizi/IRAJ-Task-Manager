const fs = require('fs');

let fileStr = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Replace activeAnalyticsChart variables to activeChart
fileStr = fileStr.replaceAll('activeAnalyticsChart ===', 'activeChart ===');

// Remove the end of the Snapshot card and the beginning of the Analytics card completely
const startIdx = fileStr.indexOf('                  </AnimatePresence>\n                </div>\n             </div>');
const endIdx = fileStr.indexOf('                  {activeChart === \'velocity\' && (', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  fileStr = fileStr.substring(0, startIdx) + fileStr.substring(endIdx);
  fs.writeFileSync('src/pages/Dashboard.tsx', fileStr, 'utf8');
  console.log('Success!');
} else {
  console.log('Not found!');
}
