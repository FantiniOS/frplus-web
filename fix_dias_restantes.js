const fs = require('fs');

const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(pathClient, 'utf8');

c = c.replace(
    /const diasRestantes = client\.diasInativo !== null \? maxWindow - client\.diasInativo : 0;/g,
    'const diasRestantes = client.diasInativo !== null ? Math.round(maxWindow - client.diasInativo) : 0;'
);

fs.writeFileSync(pathClient, c, 'utf8');
console.log('Fixed diasRestantes floating point issue in AIInsightsClient.tsx');
