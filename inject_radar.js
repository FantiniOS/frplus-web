const fs = require('fs');

const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

// I need to import it at the top
if (!route.includes('calcularCicloPonderadoPorCarga')) {
    route = route.replace("import { getServerUser } from '@/lib/getServerUser'", "import { getServerUser } from '@/lib/getServerUser'\nimport { calcularCicloPonderadoPorCarga } from '@/lib/calculoRadar'");
}

// Locate the block inside `for (const [fabricaNome, pedidosVirtuais] of Array.from(historicoPorFabrica.entries())) {`
const startMarker = 'const { cicloMedioDias, confianca } = calcularCicloMedio(pedidosVirtuais.map(p => p.data));';
const endMarker = 'const shouldAppear = macroShouldAppear;'; // In my previous rollback I made shouldAppear = macroShouldAppear

const idxStart = route.indexOf(startMarker);
const idxEnd = route.indexOf(endMarker) + endMarker.length;

if (idxStart !== -1 && idxEnd !== -1) {
    const replacement = `const radarCarga = calcularCicloPonderadoPorCarga(client.id, client.razaoSocial, pedidosVirtuais, hoje);
                
                if (!radarCarga) continue; // Pula se não tiver histórico suficiente
                
                const {
                    frequenciaBaseDias,
                    multiplicadorCarga,
                    previsaoDuracaoDias,
                    diasDesdeUltimaCompra,
                    prestesAComprar,
                    diagnostico
                } = radarCarga;

                // --- INICIO: PRODUTOS (APENAS HISTÓRICO) ---
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

                const shouldAppear = prestesAComprar;`;
                
    route = route.substring(0, idxStart) + replacement + route.substring(idxEnd);
    
    // Agora precisamos atualizar a estrutura final do `opportunities.push({ ... })`
    // Vou usar Regex para substituir o que for passado.
    
    // Locate the `opportunities.push` block
    const oppPushStart = route.indexOf('opportunities.push({');
    const oppPushEnd = route.indexOf('});', oppPushStart) + 3;
    
    if (oppPushStart !== -1 && oppPushEnd !== -1) {
        const newPush = `opportunities.push({
                        clienteId: client.id,
                        radarKey: \`\${client.id}_\${fabricaNome.replace(/\\s+/g, '_')}\`,
                        razaoSocial: client.razaoSocial,
                        nomeFantasia: client.nomeFantasia,
                        cidade: client.cidade,
                        estado: client.estado,
                        vendedorNome: client.vendedor?.nome || 'Sem Vendedor',
                        vendedorId: client.vendedor?.id,
                        nomeRepresentada: fabricaNome,
                        diasInativo: diasDesdeUltimaCompra,
                        cicloMedioDias: frequenciaBaseDias,
                        diasAteProximaCompra: Math.max(0, previsaoDuracaoDias - diasDesdeUltimaCompra),
                        confianca: 'alta', // A nova lógica é sempre alta porque filtra ruídos
                        produtos: produtosDaFabrica,
                        fatorVolume: multiplicadorCarga,
                        diagnostico // Injeta o texto explicativo
                    });`;
        route = route.substring(0, oppPushStart) + newPush + route.substring(oppPushEnd);
    }
    
    fs.writeFileSync(pathRoute, route, 'utf8');
    console.log('Successfully injected calcularCicloPonderadoPorCarga into route.ts');
} else {
    console.log('Failed to find markers in route.ts');
}
