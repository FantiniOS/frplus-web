const fs = require('fs');
const path = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(path, 'utf8');

// The pink badge for "X produto(s) esgotando"
const badgeRegex = /\{produtosEsgotandoCount > 0 && \([\s\S]*?<\/span>\s*\)\}/g;
c = c.replace(badgeRegex, '');

// Also remove `const produtosEsgotandoCount = ...`
c = c.replace(/const produtosEsgotandoCount = client\.produtos\?\.filter\(p => p\.statusEstoque === 'CRITICO' \|\| p\.statusEstoque === 'ATENCAO'\)\.length \|\| 0;/g, '');

// Change title of the table section
c = c.replace(/Estimativa de Estoque por Produto/g, 'Histórico de Produtos');

// Let's replace ONLY the tables that are immediately after `<Package className="w-4 h-4 text-purple-400" />`
// or the title `Histórico de Produtos` (since we just replaced it).

const targetSection = /<span className="text-xs font-semibold text-white uppercase tracking-wider">Histórico de Produtos<\/span>[\s\S]*?<table className="w-full text-xs">[\s\S]*?<\/table>/g;

const newTable = `<span className="text-xs font-semibold text-white uppercase tracking-wider">Histórico de Produtos</span>
                                                    <span className="text-[10px] text-gray-500 ml-auto">Baseado no histórico de compras</span>
                                                </div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-medium">Produto</th>
                                                                <th className="px-4 py-2 text-center font-medium">Últ. Qtd</th>
                                                                <th className="px-4 py-2 text-center font-medium">Média Histórica</th>
                                                                <th className="px-4 py-2 text-center font-medium">Última Compra</th>
                                                                <th className="px-4 py-2 text-center font-medium">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {client.produtos?.map((prod: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-white/[0.02]">
                                                                    <td className="px-4 py-3">
                                                                        <div className="font-medium text-gray-300">
                                                                            {prod.nome}
                                                                            {prod.isCurvaA && (
                                                                                <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[9px] font-bold">Curva A</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 mt-0.5">{prod.codigo} · {prod.totalOcorrencias} pedido(s)</div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-300">
                                                                        {prod.qtdUltimaCompra} {prod.unidade}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-400">
                                                                        {prod.qtdMediaHistorica} {prod.unidade}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-400">
                                                                        Há {prod.diasSemComprar} dias
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {prod.statusGiro === 'INATIVO' ? (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 text-[10px] font-bold border border-gray-500/20">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div> Sem Giro
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Ativo
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>`;

c = c.replace(targetSection, newTable);
fs.writeFileSync(path, c, 'utf8');
console.log('Successfully updated AIInsightsClient.tsx with precise regex');
