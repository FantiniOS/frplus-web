const fs = require('fs');
const path = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace the tooltip styling
const oldClass = "bg-gray-900 border border-white/10 p-3 rounded-lg shadow-xl text-[10px] text-gray-300 w-64 top-8 right-0 whitespace-pre-wrap transition-all pointer-events-none";
const newClass = "bg-gray-900 border border-white/10 p-4 rounded-lg shadow-xl text-xs text-gray-200 w-80 top-8 right-0 whitespace-pre-wrap transition-all pointer-events-none z-50 leading-relaxed";

content = content.split(oldClass).join(newClass);

fs.writeFileSync(path, content, 'utf8');
console.log('Tooltip classes updated successfully!');
