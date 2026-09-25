const fs = require('fs');
const path = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /SEM_DADOS:\s*\{[^}]+\}\s*\n\s*\};/g;

content = content.replace(regex, (match) => {
    // We insert INATIVO before the closing brace
    const parts = match.split('\n');
    const indent = parts[1].match(/^\s*/)[0];
    const newEntry = `,\n${indent}INATIVO: { label: '⛔ Sem Giro', cls: 'bg-gray-500/15 text-gray-500 border-gray-500/30' }\n${parts[1]}`;
    return parts[0] + newEntry;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Done replacing statusConfig');
