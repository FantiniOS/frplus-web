const fs = require('fs');
let c = fs.readFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', 'utf8');
if (!c.includes('Info,')) {
    c = c.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, Info } from 'lucide-react';");
    fs.writeFileSync('e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx', c);
    console.log('Fixed Info import');
}
