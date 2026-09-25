const fs = require('fs');

// 1. Update route.ts
const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let routeContent = fs.readFileSync(pathRoute, 'utf8');

const startMarker = '// --- INICIO: CALCULO DE PRODUTOS ---';
const endMarker = 'const shouldAppear = macroShouldAppear || temProdutoEsgotando;';

const idxStart = routeContent.indexOf(startMarker);
const idxEnd = routeContent.indexOf(endMarker) + endMarker.length;

if (idxStart !== -1 && idxEnd !== -1) {
    const replacementCodeRoute = `// --- INICIO: CALCULO DE PRODUTOS (APENAS HISTÓRICO, FIM DO MICRO-ESTOQUE) ---
                    const produtosDaFabrica: any[] = [];
                    // Descobrir Volume Total da Fábrica para classificar Curva A
                    let volTotalFabricaHist = 0;
                    for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
                        if (prodData.fabricaNome === fabricaNome) {
                            volTotalFabricaHist += prodData.ocorrencias.reduce((acc, o) => acc + o.quantidade, 0);
                        }
                    }

                    for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
                        if (prodData.fabricaNome !== fabricaNome) continue;

                        const ocorrenciasChronological = [...prodData.ocorrencias].sort((a, b) => a.data.getTime() - b.data.getTime());
                        const mergedOcorrencias: {data: Date, quantidade: number}[] = [];
                        for (const oc of ocorrenciasChronological) {
                            const last = mergedOcorrencias[mergedOcorrencias.length - 1];
                            if (last && last.data.toDateString() === oc.data.toDateString()) {
                                last.quantidade += oc.quantidade;
                            } else {
                                mergedOcorrencias.push({ data: new Date(oc.data), quantidade: oc.quantidade });
                            }
                        }

                        const totalOcorrencias = prodData.ocorrencias.length;
                        const volHistProduto = mergedOcorrencias.reduce((acc, o) => acc + o.quantidade, 0);
                        const representatividade = volTotalFabricaHist > 0 ? (volHistProduto / volTotalFabricaHist) : 0;
                        const isCurvaA = representatividade >= 0.10;

                        const dataUltimaCompraProd = mergedOcorrencias[mergedOcorrencias.length - 1].data;
                        const qtdUltimaCompra = mergedOcorrencias[mergedOcorrencias.length - 1].quantidade;
                        const qtdMediaHistorica = volHistProduto / mergedOcorrencias.length;

                        if (mergedOcorrencias.length < 1) continue;

                        const diasAteHoje = Math.max(0, Math.round((hoje.getTime() - dataUltimaCompraProd.getTime()) / (1000 * 60 * 60 * 24)));

                        const cicloSeguro = novoCicloEstimado > 0 ? novoCicloEstimado : 30;
                        const isInativo = diasAteHoje > Math.max(90, cicloSeguro * 1.5);

                        produtosDaFabrica.push({
                            produtoId: prodData.produtoId,
                            nome: prodData.nome,
                            codigo: prodData.codigo,
                            unidade: prodData.unidade,
                            qtdUltimaCompra,
                            dataUltimaCompra: dataUltimaCompraProd.toISOString(),
                            qtdMediaHistorica: Math.round(qtdMediaHistorica * 10) / 10,
                            diasSemComprar: diasAteHoje,
                            statusGiro: isInativo ? 'INATIVO' : 'ATIVO',
                            totalOcorrencias,
                            isCurvaA
                        });
                    }

                    produtosDaFabrica.sort((a, b) => {
                        if (a.statusGiro === 'INATIVO' && b.statusGiro !== 'INATIVO') return 1;
                        if (b.statusGiro === 'INATIVO' && a.statusGiro !== 'INATIVO') return -1;
                        if (a.isCurvaA && !b.isCurvaA) return -1;
                        if (!a.isCurvaA && b.isCurvaA) return 1;
                        return b.diasSemComprar - a.diasSemComprar;
                    });
                // --- FIM: CALCULO DE PRODUTOS ---

                const shouldAppear = macroShouldAppear;`;

    routeContent = routeContent.substring(0, idxStart) + replacementCodeRoute + routeContent.substring(idxEnd);
    fs.writeFileSync(pathRoute, routeContent, 'utf8');
    console.log('Successfully updated route.ts');
}

// 2. Update AIInsightsClient.tsx
const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let clientContent = fs.readFileSync(pathClient, 'utf8');

// Remove pink badge
clientContent = clientContent.replace(/\{produtosEsgotandoCount > 0 && \([\s\S]*?<\/span>\s*\)\}/g, '');
clientContent = clientContent.replace(/const produtosEsgotandoCount = client\.produtos\?\.filter\(p => p\.statusEstoque === 'CRITICO' \|\| p\.statusEstoque === 'ATENCAO'\)\.length \|\| 0;/g, '');

const targetSection = /<span className="text-xs font-semibold text-white uppercase tracking-wider">Estimativa de Estoque por Produto<\/span>[\s\S]*?<table className="w-full text-xs">[\s\S]*?<\/table>/g;

const newTableClient = `<span className="text-xs font-semibold text-white uppercase tracking-wider">Histórico de Produtos</span>
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

clientContent = clientContent.replace(targetSection, newTableClient);
fs.writeFileSync(pathClient, clientContent, 'utf8');
console.log('Successfully updated AIInsightsClient.tsx');
