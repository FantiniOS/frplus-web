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
}): string {
    const { segmento, comprador, nomeComercial, score, diasDesdeUltimaCompra } = params;
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    const vocabControle = getControleVocabulario(segmento);

    const fomoData = score > 0 ? score : (isAtacado ? 350 : 45); // Fallback numérico se não houver score exato.
    const fomoMetricText = isAtacado ? 'unidades' : 'caixas';

    // REGRA 1: Sanidade Física de Display (Produtos volumosos não vão no caixa)
    const isVolumeGrande = /5\s*l|5\s*litros|2\s*l|2\s*litros|fardo|galão/i.test(nomeComercial);
    const espacoPallet = isVolumeGrande ? 'um pallet' : (isAtacado ? 'um pallet' : 'um display');
    const espacoGondola = isVolumeGrande ? 'na base da gôndola ou ponto extra' : (isAtacado ? 'no ponto extra' : 'na frente de caixa');

    // REGRA 2: Hierarquia de Resgate (Churn > 90 dias)
    let passo1 = '';
    let passo2 = '';
    let passo3 = '';

    if (diasDesdeUltimaCompra > 90) {
        // MODO RESGATE (Cliente Perdido/Inativo)
        passo1 = `Fala ${comprador}, faz um tempão que não rodamos um pedido. O que houve? A concorrência tomou o espaço por aí?`;
        passo2 = `Inclusive, tô com a linha de [PRODUTO] aqui que a rede inteira tá girando (${fomoData} ${fomoMetricText} na região) e você tá ficando de fora.`;
        passo3 = `Vamos bater um papo pra eu te colocar de volta no jogo e testar essa rentabilidade com ${espacoPallet}?`;
    } else {
        // MODO REPOSIÇÃO (Giro Normal)
        passo1 = isAtacado
            ? `Fala ${comprador}, teu estoque da linha de ${nomeComercial} deve estar no limite pelos meus cálculos. Como a semana tá virando e teu giro costuma dobrar, vamos antecipar essa reposição?`
            : `Fala ${comprador}, tua gôndola da linha de ${nomeComercial} deve estar baixando rápido. Como o movimento aumenta no final de semana, vamos antecipar a reposição?`;

        passo2 = isAtacado
            ? `Aproveitando o pedido: os outros atacadistas aqui da região já giraram ${fomoData} ${fomoMetricText} de [PRODUTO]. Você tá deixando essa margem na mesa para a concorrência.`
            : `Aproveitando o pedido: os mercadinhos aqui da região já giraram ${fomoData} ${fomoMetricText} de [PRODUTO]. Você tá perdendo esse ticket médio.`;

        passo3 = isAtacado
            ? `Vamos botar ${espacoPallet} disso no pedido de hoje pra você testar essa rentabilidade?`
            : `Vamos botar ${espacoPallet} no pedido de hoje pra testar essa saída ${espacoGondola}?`;
    }

    return `REGRA ABSOLUTA 1 (ZERO ALUCINAÇÃO): NUNCA, SOB NENHUMA HIPÓTESE, invente ou sugira descontos, bonificações, amostras grátis, "condições especiais obscuras", prazos estendidos ou promoções. Você NÃO TEM autorização para negociar valores ou dar produtos de graça. Foco APENAS na venda do produto pelo giro dele.

REGRA ABSOLUTA 2 (PERSPECTIVA): Você escreve DIRETAMENTE para o comprador no WhatsApp. NUNCA use a terceira pessoa (ex: "este cliente não compra", "o cliente tem giro"). Use SEMPRE "você", "teu estoque", "sua operação".

REGRA ABSOLUTA 3 (TOM WHATSAPP RAIZ): Proibido jargões corporativos (ex: "nossos principais clientes", "valoriza a eficiência", "soluções inovadoras"). Escreva como um vendedor mandando um áudio transcrito: seco, rápido, comercial e focado no dinheiro.

REGRA ABSOLUTA 4 (LIMPEZA TEXTUAL): NUNCA repita o nome do produto exatamente como está no banco de dados se for muito longo. Adapte. Ex: Se o produto é "Vinho Fino Seco Tinto 750ml", chame de "Vinho Tinto" ou "a linha de Vinhos".

${vocabControle}
Produto Alvo para o Cross-Sell/Up-Sell: ${nomeComercial}

INSTRUÇÃO FINAL: 
Escreva a mensagem seguindo EXATAMENTE este roteiro de 3 passos em um único bloco ou parágrafos curtos:

Passo 1 (Abordagem): Adapte esta frase mantendo o sentido e o tom: "${passo1}"
Passo 2 (Bote/Cross-sell): Substitua [PRODUTO] por '${nomeComercial}' e use esta exata estrutura e dados: "${passo2}"
Passo 3 (Fechamento): Use EXATAMENTE esta frase sem mudar a formatação estrutural do pedido: "${passo3}"

Escreva AGORA a mensagem final seguindo estritamente as amarras acima.`;
}

export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        // Get all clients with order statistics
        const clients = await prisma.cliente.findMany({
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

        for (const client of clients) {
            if (client.pedidos.length < 2) continue

            // Nova Regra de Limite (45 Dias):
            const diasDesdeUltimaCompra = client.pedidos[0] ? Math.floor((hoje.getTime() - new Date(client.pedidos[0].data).getTime()) / (1000 * 60 * 60 * 24)) : 999;
            const isAtivo = diasDesdeUltimaCompra <= 45;

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
                        diasDesdeUltimaCompra
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
                            diasDesdeUltimaCompra
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
                const isCurrentlyActive = isAtivo;
                const dynamicActionLabel = isCurrentlyActive ? 'Aumento de Ticket' : 'Reativar Cliente';
                const dynamicHook = isCurrentlyActive
                    ? 'Cliente recentemente ativo, mas comprando consideravelmente abaixo do seu potencial histórico trimestral.'
                    : 'Cliente com histórico altíssimo mas atividade muito fraca nos últimos 3 meses.';

                insights.push({
                    type: 'untappedPotential',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Cliente historicamente forte com atividade reduzida neste trimestre.`,
                    metric: `Potencial: R$ ${(avgMonthly * 3).toFixed(2)}/trim. atual: R$ ${last3MonthsTotal.toFixed(2)}`,
                    priority: 'alta',
                    actionLabel: dynamicActionLabel,
                    contextoParaIA: getContextoAlavancagem({
                        segmento: clientSegment,
                        comprador: greetingName,
                        nomeComercial: nomeComercialFoco,
                        segmentLabel,
                        motivoGancho: dynamicHook,
                        metricText: `Ritmo antigo: R$ ${(avgMonthly * 3).toFixed(2)}/trimestre. Atual: R$ ${last3MonthsTotal.toFixed(2)}`,
                        isAtivo,
                        score: topMissingProductScore,
                        diasDesdeUltimaCompra
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
