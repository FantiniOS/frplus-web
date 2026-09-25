const fs = require('fs');

const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(pathClient, 'utf8');

// Replace the status block across all 3 tabs (Prestes, Atrasados, No Prazo)
const oldStatusBlockRegex = /<div className="space-y-1\.5 bg-black\/20 p-2 rounded-lg border border-white\/5">[\s\S]*?<\/td>/g;

// I will insert a new UI Grid. Note: To use `client.fatorVolume` properly, I need to format it.
// The layout:
// Ritmo Padrão: X dias
// Última Carga: X% (Acima/Abaixo)
// Expectativa Ponderada: X dias
// Tempo Decorrido: Y dias

const newStatusBlock = `<div className="bg-black/20 p-3 rounded-lg border border-white/5 relative group cursor-help">
                                                                        <div className="absolute top-2 right-2 text-gray-500 hover:text-blue-400 transition-colors">
                                                                            <Info className="w-4 h-4" />
                                                                        </div>
                                                                        {/* Tooltip escondido, aparece no hover do group */}
                                                                        <div className="absolute z-50 invisible opacity-0 group-hover:visible group-hover:opacity-100 bg-gray-900 border border-white/10 p-3 rounded-lg shadow-xl text-[10px] text-gray-300 w-64 top-8 right-0 whitespace-pre-wrap transition-all pointer-events-none">
                                                                            {client.diagnostico || "Diagnóstico não disponível."}
                                                                        </div>
                                                                        
                                                                        <div className="mb-2">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Diagnóstico Comercial</span>
                                                                        </div>
                                                                        
                                                                        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-gray-500 uppercase">Ritmo Padrão</span>
                                                                                <span className="text-xs font-medium text-gray-300">{client.cicloMedioDias} dias</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-gray-500 uppercase">Última Carga</span>
                                                                                <span className={\`text-xs font-bold \${(client.fatorVolume || 1) > 1.05 ? 'text-green-400' : (client.fatorVolume || 1) < 0.95 ? 'text-red-400' : 'text-blue-400'}\`}>
                                                                                    {(client.fatorVolume || 1) > 1.05 ? \`+\${(((client.fatorVolume || 1) - 1) * 100).toFixed(0)}% Acima\` : (client.fatorVolume || 1) < 0.95 ? \`\${(((client.fatorVolume || 1) - 1) * 100).toFixed(0)}% Abaixo\` : 'Média Normal'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-gray-500 uppercase">Expectativa Limite</span>
                                                                                <span className="text-xs font-medium text-purple-400">{Math.round((client.cicloMedioDias || 30) * (client.fatorVolume || 1))} dias</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-gray-500 uppercase">Tempo Decorrido</span>
                                                                                <span className={\`text-xs font-bold \${(client.diasInativo || 0) >= ((client.cicloMedioDias || 30) * (client.fatorVolume || 1) * 0.85) ? 'text-orange-400' : 'text-gray-300'}\`}>
                                                                                    {client.diasInativo} dias
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>`;

c = c.replace(oldStatusBlockRegex, newStatusBlock);

// Remove any remaining `produtosEsgotandoCount` badge stuff
c = c.replace(/\{client\.produtos\.filter\(p => p\.statusEstoque === 'CRITICO'\)\.length > 0[\s\S]*?\}/g, '📦 {client.produtos?.length || 0} produtos');

// I also need to make sure Info icon is imported at the top of AIInsightsClient.tsx
if (!c.includes('import {') || (!c.includes('Info,') && !c.includes(' Info '))) {
    // just a simple regex to add Info to lucide-react imports
    c = c.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, Info } from 'lucide-react';");
}

fs.writeFileSync(pathClient, c, 'utf8');
console.log('Successfully updated AIInsightsClient.tsx visual layout');
