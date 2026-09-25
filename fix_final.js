const fs = require('fs');

// 1. Fix calculoRadar.ts
const pathRadar = 'e:/FRPlus/frplus-web/src/lib/calculoRadar.ts';
let radarCode = fs.readFileSync(pathRadar, 'utf8');

// The issue is literally `\`` was written to the file instead of just `.
// Wait, when I wrote to file I used \` to escape it inside the string literal of my tool call.
// But the tool writes EXACTLY the content. So it wrote \` inside the typescript code!
// Let's replace \` with just `

radarCode = radarCode.replace(/\\`/g, '`');
radarCode = radarCode.replace(/\\\\n/g, '\\n'); // Also fix escaped newlines

fs.writeFileSync(pathRadar, radarCode, 'utf8');
console.log('Fixed calculoRadar.ts syntax');

// 2. Fix AIInsightsClient.tsx Interface
const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let clientCode = fs.readFileSync(pathClient, 'utf8');

if (!clientCode.includes('fatorVolume?: number;')) {
    clientCode = clientCode.replace(
        "totalPedidos: number;",
        "totalPedidos: number;\n    fatorVolume?: number;\n    diagnostico?: string;"
    );
}

fs.writeFileSync(pathClient, clientCode, 'utf8');
console.log('Fixed interface in AIInsightsClient.tsx');
