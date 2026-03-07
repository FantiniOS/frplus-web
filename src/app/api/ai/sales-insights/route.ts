import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/sales-insights - Get sales leverage insights
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// HELPERS
// ============================================================

/**
 * Extrai a Marca de uma string de produto.
 */
function extrairMarca(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return '';
    if (produtoNome.includes(' - ')) {
        const partes = produtoNome.split(' - ');
        const marca = partes[partes.length - 1].trim();
        return marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
    }
    const tokens = produtoNome.trim().split(/\s+/);
    const ultima = tokens[tokens.length - 1];
    return ultima.charAt(0).toUpperCase() + ultima.slice(1).toLowerCase();
}

/**
 * Humanizar nome do produto
 */
// Function to clean corporate prefixes from company names
function cleanCompanyName(name: string): string {
    if (!name) return 'parceiro';
    let cleaned = name.toUpperCase();
    const prefixesToRemove = [
        'SUPERMERCADO', 'SUPERMERCADOS', 'ATACAREJO', 'ATACADISTA', 'ATACADAO',
        'COMERCIAL', 'DISTRIBUIDORA', 'MERCADINHO', 'MERCEARIA', 'PADARIA',
        'LTDA', 'S/A', 'CIA', 'EIRELI', 'ME', 'EPP', 'SA', 'LIMITADA', '-'
    ];

    for (const prefix of prefixesToRemove) {
        const regex = new RegExp(`\\b${prefix}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    }

    cleaned = cleaned.trim().replace(/\s+/g, ' '); // Remove extra spaces

    // Capitalize first letters
    cleaned = cleaned.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

    return cleaned || 'parceiro';
}

function formatarNomeComercial(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return 'o produto';
    const marca = extrairMarca(produtoNome);
    let descricao = produtoNome;
    if (produtoNome.includes(' - ')) {
        descricao = produtoNome.split(' - ').slice(0, -1).join(' - ').trim();
    }
    descricao = descricao
        .toLowerCase()
        .replace(/\b\d+%/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/(\d+)\s*ml\b/gi, '$1ml')
        .replace(/(\d+)\s*litros?\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*l\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*g\b/gi, '$1g')
        .replace(/(\d+)\s*kg\b/gi, '$1kg');

    const femininas = ['mostarda', 'maionese', 'pimenta', 'azeitona', 'ketchup', 'catchup', 'massa', 'farinha', 'ervilha', 'sardinha', 'salsa', 'linhaça'];
    const artigoFem = femininas.some(f => descricao.includes(f));
    const artigo = artigoFem ? 'a' : 'o';

    if (marca) return `${artigo} ${descricao} da ${marca}`;
    return `${artigo} ${descricao}`;
}

function getControleVocabulario(segmento: string): string {
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    if (isAtacado) {
        return `O cliente é um ATACADISTA/DISTRIBUIDOR.
Use termos como: giro, volume, pallet, margem na ponta.`;
    }
    return `O cliente é um VAREJISTA.
Use termos como: gôndola, prateleira, ticket médio.`;
}

function getContextoAlavancagem(params: {
    segmento: string;
    comprador: string;
    nomeComercial: string;
    segmentLabel: string;
    motivoGancho: string;
    metricText: string;
    isAtivo: boolean;
    score: number;
    diasDesdeUltimaCompra: number;
    dadosHistoricosFormatados: string;
}): string {
    const { segmento, comprador, nomeComercial, score, diasDesdeUltimaCompra, metricText, motivoGancho, dadosHistoricosFormatados } = params;
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    const vocabControle = getControleVocabulario(segmento);

    const fomoData = score > 0 ? score : (isAtacado ? 350 : 45); // Fallback numérico se não houver score exato.
    const fomoMetricText = isAtacado ? 'unidades' : 'caixas';

    // REGRA 1: Sanidade Física de Display
    const isVolumeGrande = /5\s*l|5\s*litros|2\s*l|2\s*litros|fardo|galão/i.test(nomeComercial);
    const espacoPallet = isVolumeGrande ? 'um pallet' : (isAtacado ? 'um pallet' : 'um display');
    const espacoGondola = isVolumeGrande ? 'na base da gôndola ou ponto extra' : (isAtacado ? 'no ponto extra' : 'na frente de caixa');

    // MODO REPOSIÇÃO (Giro Normal) - Cliente Ativo
    const passo1 = isAtacado
        ? `Fala ${comprador}, teu estoque da linha de ${nomeComercial} deve estar no limite pelos meus cálculos. Como a semana tá virando e teu giro costuma dobrar, vamos antecipar essa reposição?`
        : `Fala ${comprador}, tua gôndola da linha de ${nomeComercial} deve estar baixando rápido. Como o movimento aumenta no final de semana, vamos antecipar a reposição?`;

    const passo2 = isAtacado
        ? `Aproveitando o pedido: os outros atacadistas aqui da região já giraram ${fomoData} ${fomoMetricText} de [PRODUTO]. Você tá deixando essa margem na mesa para a concorrência.`
        : `Aproveitando o pedido: os mercadinhos aqui da região já giraram ${fomoData} ${fomoMetricText} de [PRODUTO]. Você tá perdendo esse ticket médio.`;

    const passo3 = isAtacado
        ? `Vamos botar ${espacoPallet} disso no pedido de hoje pra você testar essa rentabilidade?`
        : `Vamos botar ${espacoPallet} no pedido de hoje pra testar essa saída ${espacoGondola}?`;

    return `REGRA ABSOLUTA 1 (ZERO MENTIRAS E ZERO CONDIÇÕES): NUNCA, SOB NENHUMA HIPÓTESE, invente ou sugira "condições especiais", descontos, bonificações, amostras grátis, prazos estendidos ou promoções. O representante não pode queimar margem. A recomendação deve ser puramente ESTRATÉGICA focada no giro do produto.

REGRA ABSOLUTA 2 (FIM DO LERO-LERO): PROIBIDO usar adjetivos vagos e genéricos como "redução significativa", "queda abrupta", "sazonalidade do setor" ou "insatisfação". Você DEVE citar os números exatos e motivos matemáticos reais fornecidos abaixo.

REGRA ABSOLUTA 3 (ANÁLISE CIRÚRGICA DE DADOS): Aja como um Analista de Dados Sênior direcionando o Vendedor. Se a queda aconteceu, mas o cliente comprou outros itens, aponte isso: "Como ele comprou produto X normalmente, o problema não é limite, mas sim perda de espaço na gôndola para o produto Y".

ESTRUTURA OBRIGATÓRIA DA RECOMENDAÇÃO (Gere EXATAMENTE estes 3 tópicos, sem saudações):

1. Raio-X da Queda:
(Analise os números reais de faturamento fornecidos abaixo. Liste a % de queda e o valor exato. Destaque qual Produto/Marca focada foi o responsável pelo buraco.)

2. Ponto de Atenção:
(Qual a provável causa matemática? Ex: Perdeu espaço na gôndola para a concorrência no produto específico? Deixou o ticket médio na mesa?)

3. Ação Recomendada para o Representante:
(O que o vendedor deve fazer fisicamente ou por telefone amanhã? Ex: "Ligar perguntando especificamente como está o estoque do produto X e se alguma marca entrou rasgando o preço".)

DADOS REAIS PARA ANÁLISE:
- Produto/Marca Foco da Queda/Lacuna: ${nomeComercial}
- Indicador Financeiro Atual: ${metricText}
- Motivo Técnico Extraído: ${motivoGancho}

=== DADOS HISTÓRICOS REAIS DO CLIENTE (ÚLTIMOS 6 MESES) ===
${dadosHistoricosFormatados}
===========================================================
${vocabControle}

ATENÇÃO: Baseie a sua análise e recomendação ESTRITAMENTE nos dados reais fornecidos acima. Cite os números e os nomes/marcas dos produtos no seu texto.

Gere o Insight Analítico AGORA, seguindo rigorosamente a estrutura de 3 tópicos acima.`;
}

export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        // Get all clients with order statistics
        const dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - 90);

        const clients = await prisma.cliente.findMany({
            where: {
                pedidos: {
                    some: {
                        data: { gte: dataCorte },
                        status: { in: ['FATURADO', 'CONCLUIDO', 'Faturado', 'Concluido'] }
                    }
                }
            },
            include: {
                pedidos: {
                    where: {
                        tipo: 'Venda',
                        status: {
                            in: ['Novo', 'Pendente', 'Processando', 'Concluido', 'Faturado', 'Importado']
                        }
                    },
                    orderBy: { data: 'desc' },
                    include: {
                        itens: true
                    }
                }
            }
        })

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Segment mapping for Top Product discovery
        const segmentBuyerMap = new Map<string, Set<string>>()
        const clientProductMap = new Map<string, Map<string, number>>()

        for (const client of clients) {
            const prodQtdMap = new Map<string, number>()
            for (const pedido of client.pedidos) {
                for (const item of pedido.itens) {
                    prodQtdMap.set(item.produtoId, (prodQtdMap.get(item.produtoId) || 0) + item.quantidade)
                }
            }
            if (prodQtdMap.size > 0) {
                clientProductMap.set(client.id, prodQtdMap)
            }
            const segment = client.tabelaPreco || '50a199'
            if (!segmentBuyerMap.has(segment)) {
                segmentBuyerMap.set(segment, new Set())
            }
            segmentBuyerMap.get(segment)!.add(client.id)
        }

        const segmentLabels: Record<string, string> = {
            '50a199': 'pequeno porte (50-199)',
            '200a699': 'médio porte (200-699)',
            'atacado': 'atacado',
            'avista': 'atacado à vista',
            'redes': 'redes'
        }

        // Global stats to determine Best Seller fallback
        const globalStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 30
        })

        const products = await prisma.produto.findMany()
        const productMap = new Map(products.map(p => [p.id, p]))

        // Calculate global average ticket
        const allOrders = await prisma.pedido.findMany()
        const globalAvgTicket = allOrders.length > 0
            ? allOrders.reduce((acc, o) => acc + Number(o.valorTotal), 0) / allOrders.length
            : 0

        const insights: Array<{
            type: 'lowTicket' | 'decliningVolume' | 'untappedPotential'
            clienteId: string
            clienteNome: string
            description: string
            metric: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
            contextoParaIA: string
        }> = []

        const hoje = new Date()
        const seisMesesAtras = new Date()
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

        for (const client of clients) {
            if (client.pedidos.length < 2) continue

            // Nova Regra de Limite (45 Dias):
            const diasDesdeUltimaCompra = client.pedidos[0] ? Math.floor((hoje.getTime() - new Date(client.pedidos[0].data).getTime()) / (1000 * 60 * 60 * 24)) : 999;
            const isAtivo = diasDesdeUltimaCompra <= 45;

            // Extrair o histórico detalhado de compras dos últimos 6 meses para este cliente
            let dadosHistoricosFormatados = '';
            const produtosCompradosRecentes = new Map<string, { nome: string, qtdTotal: number, comprasAnteriores: number, comprasRecentes: number }>();

            // Separar os últimos 6 meses em dois blocos: 3 meses mais antigos vs 3 meses mais recentes pra mostrar a queda
            const tresMesesAtras = new Date()
            tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)

            for (const pedido of client.pedidos) {
                const dataPedido = new Date(pedido.data)
                if (dataPedido < seisMesesAtras) continue;

                const isRecente = dataPedido >= tresMesesAtras;

                for (const item of pedido.itens) {
                    const prod = productMap.get(item.produtoId);
                    if (!prod) continue;

                    const nomeStr = formatarNomeComercial(prod.nome);
                    const curr = produtosCompradosRecentes.get(item.produtoId) || { nome: nomeStr, qtdTotal: 0, comprasAnteriores: 0, comprasRecentes: 0 };

                    curr.qtdTotal += item.quantidade;
                    if (isRecente) {
                        curr.comprasRecentes += item.quantidade;
                    } else {
                        curr.comprasAnteriores += item.quantidade;
                    }
                    produtosCompradosRecentes.set(item.produtoId, curr);
                }
            }

            // Formatar os Top 8 produtos para o LLM
            const topProdutosHistorico = Array.from(produtosCompradosRecentes.values())
                .sort((a, b) => b.qtdTotal - a.qtdTotal)
                .slice(0, 8);

            if (topProdutosHistorico.length > 0) {
                dadosHistoricosFormatados = topProdutosHistorico.map(p =>
                    `- ${p.nome}: Total (6 meses): ${p.qtdTotal}cx | Média Trimestre Antigo: ${p.comprasAnteriores}cx -> Trimestre Atual (Últimos 3m): ${p.comprasRecentes}cx`
                ).join('\n');
            } else {
                dadosHistoricosFormatados = 'Sem histórico de produtos nos últimos 6 meses.';
            }

            const clientSegment = client.tabelaPreco || '50a199'
            const segmentLabel = segmentLabels[clientSegment] || clientSegment

            // Determinar o "Best Seller" que o cliente NÃO comprou (Gap de Curva A)
            let topMissingProductId = ''
            let topMissingProductScore = 0

            const myProducts = clientProductMap.get(client.id)
            const allBoughtProductIds = myProducts ? new Set(Array.from(myProducts.keys())) : new Set<string>()

            const segmentBuyers = segmentBuyerMap.get(clientSegment)
            if (segmentBuyers && segmentBuyers.size > 1) {
                const segmentProductScores = new Map<string, number>()
                segmentBuyers.forEach(buyerId => {
                    if (buyerId === client.id) return
                    const buyerProducts = clientProductMap.get(buyerId)
                    if (!buyerProducts) return
                    buyerProducts.forEach((qtd, prodId) => {
                        segmentProductScores.set(prodId, (segmentProductScores.get(prodId) || 0) + qtd)
                    })
                })
                const rankedSegmentProducts = Array.from(segmentProductScores.entries()).sort((a, b) => b[1] - a[1])
                for (const [prodId, score] of rankedSegmentProducts) {
                    if (!allBoughtProductIds.has(prodId)) {
                        topMissingProductId = prodId
                        topMissingProductScore = score
                        break
                    }
                }
            }

            // Fallback Global
            if (!topMissingProductId) {
                for (const stat of globalStats) {
                    if (!allBoughtProductIds.has(stat.produtoId)) {
                        topMissingProductId = stat.produtoId
                        topMissingProductScore = stat._sum.quantidade || 0
                        break
                    }
                }
            }

            let nomeComercialFoco = 'um dos nossos produtos líderes'
            if (topMissingProductId) {
                const prod = productMap.get(topMissingProductId)
                if (prod) nomeComercialFoco = formatarNomeComercial(prod.nome)
            }

            // Determine physical buyer name (Strip corporate prefixes)
            let greetingName = 'parceiro'
            if (client.comprador && client.comprador.trim() !== '') {
                greetingName = client.comprador.split(' ')[0]
            } else {
                const cleanedName = cleanCompanyName(client.nomeFantasia)
                greetingName = `equipe do ${cleanedName}`
            }

            // Calculate client's average ticket
            const clientAvgTicket = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0) / client.pedidos.length

            // --- LOW TICKET INSIGHT ---
            if (clientAvgTicket < globalAvgTicket * 0.6) {
                const percentBelow = Math.round((1 - clientAvgTicket / globalAvgTicket) * 100)
                insights.push({
                    type: 'lowTicket',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Ticket médio ${percentBelow}% abaixo da média geral.`,
                    metric: `R$ ${clientAvgTicket.toFixed(2)} vs R$ ${globalAvgTicket.toFixed(2)}`,
                    priority: 'media',
                    actionLabel: 'Aumentar Volume',
                    contextoParaIA: getContextoAlavancagem({
                        segmento: clientSegment,
                        comprador: greetingName,
                        nomeComercial: nomeComercialFoco,
                        segmentLabel,
                        motivoGancho: 'Ticket médio abaixo do potencial do seu porte',
                        metricText: `R$ ${clientAvgTicket.toFixed(2)} vs R$ ${globalAvgTicket.toFixed(2)} (Média local)`,
                        isAtivo,
                        score: topMissingProductScore,
                        diasDesdeUltimaCompra,
                        dadosHistoricosFormatados
                    })
                })
            }

            // --- DECLINING VOLUME INSIGHT ---
            // Compare last 3 orders vs previous 3 orders
            if (client.pedidos.length >= 6) {
                const recent3 = client.pedidos.slice(0, 3)
                const previous3 = client.pedidos.slice(3, 6)

                const recent3Total = recent3.reduce((acc, o) => acc + Number(o.valorTotal), 0)
                const previous3Total = previous3.reduce((acc, o) => acc + Number(o.valorTotal), 0)

                if (previous3Total > 0 && recent3Total < previous3Total * 0.7) {
                    const percentDrop = Math.round((1 - recent3Total / previous3Total) * 100)
                    insights.push({
                        type: 'decliningVolume',
                        clienteId: client.id,
                        clienteNome: client.nomeFantasia,
                        description: `Volume de compras caiu ${percentDrop}% nos últimos pedidos.`,
                        metric: `R$ ${recent3Total.toFixed(2)} vs R$ ${previous3Total.toFixed(2)}`,
                        priority: 'alta',
                        actionLabel: 'Investigar Motivo',
                        contextoParaIA: getContextoAlavancagem({
                            segmento: clientSegment,
                            comprador: greetingName,
                            nomeComercial: nomeComercialFoco,
                            segmentLabel,
                            motivoGancho: 'Houve uma queda abrupta no volume de compras recente',
                            metricText: `R$ ${recent3Total.toFixed(2)} vs R$ ${previous3Total.toFixed(2)} nos 3 pedidos anteriores`,
                            isAtivo,
                            score: topMissingProductScore,
                            diasDesdeUltimaCompra,
                            dadosHistoricosFormatados
                        })
                    })
                }
            }

            // --- UNTAPPED POTENTIAL ---
            // High historical value but recent low activity
            const totalHistorico = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0)
            const avgMonthly = totalHistorico / Math.max(1,
                Math.ceil((Date.now() - new Date(client.pedidos[client.pedidos.length - 1]?.data || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30))
            )

            const last3Months = client.pedidos.filter(o => {
                const orderDate = new Date(o.data)
                const threeMonthsAgo = new Date()
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
                return orderDate > threeMonthsAgo
            })

            const last3MonthsTotal = last3Months.reduce((acc, o) => acc + Number(o.valorTotal), 0)

            if (avgMonthly > 1000 && last3MonthsTotal < avgMonthly * 2) {
                const dynamicHook = 'Cliente com histórico altíssimo mas comprando consideravelmente abaixo do seu potencial histórico trimestral.';

                insights.push({
                    type: 'untappedPotential',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Cliente historicamente forte com atividade reduzida neste trimestre.`,
                    metric: `Potencial: R$ ${(avgMonthly * 3).toFixed(2)}/trim. atual: R$ ${last3MonthsTotal.toFixed(2)}`,
                    priority: 'alta',
                    actionLabel: 'Aumento de Ticket',
                    contextoParaIA: getContextoAlavancagem({
                        segmento: clientSegment,
                        comprador: greetingName,
                        nomeComercial: nomeComercialFoco,
                        segmentLabel,
                        motivoGancho: dynamicHook,
                        metricText: `Ritmo antigo: R$ ${(avgMonthly * 3).toFixed(2)}/trimestre. Atual: R$ ${last3MonthsTotal.toFixed(2)}`,
                        isAtivo,
                        score: topMissingProductScore,
                        diasDesdeUltimaCompra,
                        dadosHistoricosFormatados
                    })
                })
            }
        }

        // Sort by priority
        const priorityOrder = { alta: 0, media: 1, baixa: 2 }
        insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

        return NextResponse.json({
            insights: insights.slice(0, 20),
            summary: {
                total: insights.length,
                lowTicket: insights.filter(i => i.type === 'lowTicket').length,
                decliningVolume: insights.filter(i => i.type === 'decliningVolume').length,
                untappedPotential: insights.filter(i => i.type === 'untappedPotential').length
            },
            globalMetrics: {
                avgTicket: globalAvgTicket,
                totalClients: clients.length,
                totalOrders: allOrders.length
            }
        })
    } catch (error) {
        console.error('Error fetching sales insights:', error)
        return NextResponse.json({ error: 'Failed to fetch sales insights' }, { status: 500 })
    }
}
