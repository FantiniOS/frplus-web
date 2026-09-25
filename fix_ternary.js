const fs = require('fs');

const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(pathClient, 'utf8');

c = c.replace(/📦 \{client\.produtos\?\.length \|\| 0\} produtos produto\(s\) esgotando`\s*:\s*`📦 \$\{client\.produtos\.length\} produtos`\s*\}/g, '📦 {client.produtos?.length || 0} produtos');

fs.writeFileSync(pathClient, c, 'utf8');
console.log('Fixed syntax error in AIInsightsClient.tsx');
