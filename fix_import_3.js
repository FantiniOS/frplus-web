const fs = require('fs');
let c = fs.readFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', 'utf8');

c = c.replace("import { Info } from 'lucide-react';\n", ''); // remove the one at the top
c = c.replace(/'use client';\n/, "'use client';\nimport { Info } from 'lucide-react';\n");

fs.writeFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', c);
