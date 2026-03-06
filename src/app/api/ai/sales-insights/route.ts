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
        return `CONTROLE DE CENÁRIO — ATACADISTA/DISTRIBUIDOR:
O cliente é um ATACADISTA/DISTRIBUIDOR. Cenário: GALPÃO LOGÍSTICO.
Use EXCLUSIVAMENTE estas palavras: 'giro de estoque', 'volume', 'pallet', 'margem de revenda', 'abastecer seus clientes'.
PALAVRAS PROIBIDAS: 'gôndola', 'prateleira', 'consumidor final', 'ponto de venda'.`;
    }
    return `CONTROLE DE CENÁRIO — VAREJISTA:
O cliente é um VAREJISTA com loja física.
Use estas palavras: 'ponto de venda', 'gôndola', 'prateleira', 'ticket médio', 'evitar ruptura'.
Argumento: COMPLETAR O MIX e AUMENTAR TICKET MÉDIO.`;
}

function getContextoAlavancagem(params: {
    segmento: string;
    comprador: string;
    nomeComercial: string;
    segmentLabel: string;
    motivoGancho: string; // Ex: Ticket caindo, volume baixo
    metricText: string;
    isAtivo: boolean;
    score: number;
}): string {
    const { segmento, comprador, nomeComercial, segmentLabel, motivoGancho, metricText, isAtivo, score } = params;
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    const vocabControle = getControleVocabulario(segmento);

    const propostaFechamento = isAtacado
        ? 'Vamos botar um pallet no próximo pedido para você testar essa rentabilidade hoje?'
        : 'Vamos fechar um lote teste agora para você não perder mais venda na gôndola?';

    const fomoMath = score > 0
        ? `Temos ${score} unidades vendidas de ${nomeComercial} girando rapidamente em clientes do mesmo perfil (${segmentLabel}). Você está deixando dinheiro na mesa para a concorrência por não ter este produto na operação.`
        : `Este item tem alto giro em clientes do mesmo perfil (${segmentLabel}). Você está deixando dinheiro na mesa por não ter ele na operação.`;

    const statusRule = isAtivo
        ? `REGRA CRÍTICA DE SEPARAÇÃO LÓGICA: O cliente comprou nos últimos 30 dias (CLIENTE ATIVO). Você NUNCA deve usar palavras passivas como "reativar", "sumido", ou "faz tempo". O gancho inicial (${motivoGancho}) serve apenas para validar a necessidade do Cross-Sell/Up-Sell de um produto forte que ele não possui.`
        : `REGRA DE CONTEXTO: O cliente reduziu compras recentemente. Ainda assim, evite postura pedinte. Prove matematicamente o prejuízo de não repor estoque.`;

    return `${vocabControle}

REGRA DE LIMPEZA VISUAL (INEGOCIÁVEL):
Use SEMPRE o termo comercial natural para o produto foco: "${nomeComercial}". NUNCA use strings de sistema.

INVERSÃO DE PROTAGONISMO (LÓGICA PREDADORA):
O objetivo principal, único e absoluto desta mensagem é ALAVANCAR O TICKET VENDENDO O PRODUTO NOVO (${nomeComercial}). A análise prévia ("${motivoGancho}") é só o gancho inicial. Seja agressivo e consultivo focando em rentabilidade e otimização.

${statusRule}

ESTRUTURA OBRIGATÓRIA (4 passos curtos, puramente comerciais):
1. Cumprimento direto usando o nome: ${comprador}.
2. Gancho: Mencione levemente o status atual dele ("${motivoGancho}": ${metricText}).
3. A Oportunidade (Alavancagem e FOMO): Introduza ${nomeComercial}. ${fomoMath} Destaque o ${isAtacado ? 'giro rápido no pallet' : 'aumento do ticket médio na gôndola'}.
4. Fechamento Agressivo: "${propostaFechamento}" Terminando SEMPRE com uma chamada imperativa e focada na venda. NUNCA faça perguntas como "Faz sentido?", "O que acha?".

Escreva a mensagem seguindo esta estrutura. Máximo 3 parágrafos curtos.
NÃO use markdown ou formatação. Apenas o texto puro de WhatsApp.`;
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

        for (const client of clients) {
            if (client.pedidos.length < 2) continue

            const isAtivo = client.pedidos.some(o => new Date(o.data) >= thirtyDaysAgo)
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

            // @ts-ignore
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

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
                        score: topMissingProductScore
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
                            score: topMissingProductScore
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
                insights.push({
                    type: 'untappedPotential',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Cliente historicamente forte com atividade reduzida recente.`,
                    metric: `Potencial: R$ ${(avgMonthly * 3).toFixed(2)}/trimestre`,
                    priority: 'alta',
                    actionLabel: 'Reativar Cliente',
                    contextoParaIA: getContextoAlavancagem({
                        segmento: clientSegment,
                        comprador: greetingName,
                        nomeComercial: nomeComercialFoco,
                        segmentLabel,
                        motivoGancho: 'Cliente com histórico altíssimo mas atividade muito fraca nos últimos 3 meses.',
                        metricText: `Ritmo antigo: R$ ${(avgMonthly * 3).toFixed(2)}/trimestre. Atual: R$ ${last3MonthsTotal.toFixed(2)}`,
                        isAtivo,
                        score: topMissingProductScore
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
