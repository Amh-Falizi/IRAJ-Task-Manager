const fs = require('fs');

let fileStr = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

fileStr = fileStr.replaceAll(
`                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     transition={{ duration: 0.2 }}`,
`                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     transition={{ duration: 0.4, ease: 'easeOut' }}`
);

fs.writeFileSync('src/pages/Dashboard.tsx', fileStr, 'utf8');
console.log('Success!');
