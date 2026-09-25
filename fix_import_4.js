const fs = require('fs');
let c = fs.readFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', 'utf8');

c = c.replace(/Activity \} from 'lucide-react';/, "Activity, Info } from 'lucide-react';");

fs.writeFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', c);
console.log('Fixed import properly this time');
