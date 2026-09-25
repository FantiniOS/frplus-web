const fs = require('fs');
let c = fs.readFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', 'utf8');
if (!c.includes("import { Info } from 'lucide-react';")) {
    c = "import { Info } from 'lucide-react';\n" + c;
    fs.writeFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', c);
}
