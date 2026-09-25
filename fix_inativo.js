const fs = require('fs');
const path = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/prod\.statusEstoque !== 'SEM_DADOS'/g, "(prod.statusEstoque !== 'SEM_DADOS' && prod.statusEstoque !== 'INATIVO')");

fs.writeFileSync(path, c, 'utf8');
console.log('Replaced display logic');
