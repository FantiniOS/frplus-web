const fs = require('fs');

// --- ROUTE.TS ---
const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

const startMarker = '// --- INICIO: CALCULO DE PRODUTOS ---';
const endMarker = 'const shouldAppear = macroShouldAppear || temProdutoEsgotando;';

const idxStart = route.indexOf(startMarker);
const idxEnd = route.indexOf(endMarker) + endMarker.length;

if (idxStart !== -1 && idxEnd !== -1) {
    const replacement = `// --- INICIO: PRODUTOS (APENAS HISTÓRICO) ---
                    const produtosDaFabrica: any[] = [];
                    for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
                        if (prodData.fabricaNome !== fabricaNome) continue;

                        const ocorrencias = [...prodData.ocorrencias].sort((a, b) => b.data.getTime() - a.data.getTime());
                        if (ocorrencias.length < 1) continue;

                        produtosDaFabrica.push({
                            produtoId: prodData.produtoId,
                            nome: prodData.nome,
                            codigo: prodData.codigo,
                            unidade: prodData.unidade,
                            qtdUltimaCompra: ocorrencias[0].quantidade,
                            dataUltimaCompra: ocorrencias[0].data.toISOString()
                        });
                    }
                // --- FIM: PRODUTOS ---

                const shouldAppear = macroShouldAppear;`;

    route = route.substring(0, idxStart) + replacement + route.substring(idxEnd);
    fs.writeFileSync(pathRoute, route, 'utf8');
}

// --- AIInsightsClient.tsx ---
const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let client = fs.readFileSync(pathClient, 'utf8');

// Remove pink badge completely
client = client.replace(/\{produtosEsgotandoCount > 0 && \([\s\S]*?<\/span>\s*\)\}/g, '');
client = client.replace(/const produtosEsgotandoCount = .*?;/g, '');

// Replace the table with a dead simple one
const targetTable = /<span className="text-xs font-semibold text-white uppercase tracking-wider">Estimativa de Estoque por Produto<\/span>[\s\S]*?<table className="w-full text-xs">[\s\S]*?<\/table>/g;

const simpleTable = `<span className="text-xs font-semibold text-white uppercase tracking-wider">Últimos Produtos Comprados</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5 text-gray-400">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">Produto</th>
                                <th className="px-4 py-2 text-center font-medium">Últ. Qtd</th>
                                <th className="px-4 py-2 text-center font-medium">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {client.produtos?.map((prod: any, idx: number) => (
                                <tr key={idx} className="hover:bg-white/[0.02]">
                                    <td className="px-4 py-3 font-medium text-gray-300">
                                        {prod.nome}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-300">
                                        {prod.qtdUltimaCompra} {prod.unidade}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-400">
                                        {new Date(prod.dataUltimaCompra).toLocaleDateString('pt-BR')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>`;

client = client.replace(targetTable, simpleTable);
fs.writeFileSync(pathClient, client, 'utf8');
