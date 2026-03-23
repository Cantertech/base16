const fs = require('fs');
let c = fs.readFileSync('c:/Users/silas/Desktop/orbit/components/Exams.tsx', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('c:/Users/silas/Desktop/orbit/components/Exams.tsx', c);
