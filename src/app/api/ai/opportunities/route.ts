import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/opportunities - Get sales opportunities
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // ============================================================
        // DATA LOADING
        // ============================================================

        // 1. Get all clients with their order history
        const clients = await prisma.cliente.findMany({
            include: {
                pedidos: {
                    include: {
                        itens: {
                            select: { produtoId: true, quantidade: true }
                        }
                    },
                    orderBy: { data: 'desc' }
                }
            }
        })

        // 2. Get all products with factory info (single query, used as lookup)
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })

        // Product lookup map
        const productMap = new Map(products.map(p => [p.id, p]))

        // 3. Pre-compute global product popularity (for fallback)
        const globalStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 50
        })

        // 4. Build segment-buyer and client-product indexes
        // Segment = tabelaPreco (proxy for client size/porte)
        const segmentBuyerMap = new Map<string, Set<string>>() // segment -> Set<clienteId>
        const clientProductMap = new Map<string, Map<string, number>>() // clienteId -> Map<produtoId, totalQtd>

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

            // Determine client segment from tabelaPreco field or most frequent order table
            const segment = client.tabelaPreco || '50a199'
            if (!segmentBuyerMap.has(segment)) {
                segmentBuyerMap.set(segment, new Set())
            }
            segmentBuyerMap.get(segment)!.add(client.id)
        }

        // Build a human-readable label for each segment
        const segmentLabels: Record<string, string> = {
            '50a199': 'pequeno porte (50-199)',
            '200a699': 'médio porte (200-699)',
            'atacado': 'atacado',
            'avista': 'atacado à vista',
            'redes': 'redes'
        }

        // ============================================================
        // OPPORTUNITY GENERATION
        // ============================================================

        const opportunities: Array<{
            type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation'
            clienteId: string
            clienteNome: string
            clienteTelefone?: string
            description: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
            contextoParaIA: string
        }> = []

        const now = new Date()
        const currentMonth = now.getMonth()
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

        // Track suggested products to diversify cross-sell across clients
        const globalSuggestedProducts = new Set<string>()

        for (const client of clients) {
            if (client.pedidos.length === 0) continue

            const phone = client.celular || client.telefone || ''
            // @ts-ignore
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia

            const recentOrders = client.pedidos.slice(0, 10)
            const thisMonthOrders = recentOrders.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )

            // --- UPGRADE OPPORTUNITY ---
            const using50a199 = recentOrders.some(o => o.tabelaPreco === '50a199')
            if (using50a199 && thisMonthOrders.length >= 2) {
                opportunities.push({
                    type: 'upgrade',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,
                    description: `${thisMonthOrders.length} pedidos este mês na tabela 50-199. Sugerir migração para 200-669.`,
                    priority: 'alta',
                    actionLabel: 'Propor Upgrade',
                    contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Proponha a mudança para a tabela de atacado (200+) porque o cliente fez vários pedidos este mês na tabela 50-199.`
                })
            }

            // Determine if client has a history of receiving bonifications
            const recebeBonificacao = client.pedidos.some(p => p.tipo === 'Bonificacao')
            const taticasCrossSell = recebeBonificacao
                ? "Use a ESTRATÉGIA DE RISCO FINANCIADO: você quer introduzir este produto, mas o comprador resiste a itens novos. A TÁTICA: ofereça caixas bonificadas de Vinagre de Álcool 750ml (giro garantido, 100% de lucro) como financiador do risco. Proponha que o lucro do Vinagre 750ml bonificado cubra a entrada de um lote teste, assim o cliente testa com risco financeiro ZERO. Seja direto, comercial e fale de rentabilidade."
                : "Use a ESTRATÉGIA DE OTIMIZAÇÃO DE CENTÍMETRO QUADRADO: o cliente NÃO tem verba/bonificação e não tem espaço físico na gôndola. A TÁTICA: peça para ele substituir o espaço de um produto da concorrência que gira mal. Não peça cadastro novo. Peça para ele reduzir 1 frente do concorrente de baixo giro e colocar o seu produto no lugar para um teste de margem/rentabilidade de 30 dias. Seja incisivo, diga que quer ajudar a rentabilizar aquele espaço morto na prateleira."

            // ==========================================================
            // --- CROSS-SELL: Perfil do Cliente / Segmentação ---
            // ==========================================================
            const myProducts = clientProductMap.get(client.id)
            if (myProducts && myProducts.size > 0) {

                // STEP 1: Determine this client's segment
                const clientSegment = client.tabelaPreco || '50a199'
                const segmentLabel = segmentLabels[clientSegment] || clientSegment

                // STEP 2: Find OTHER clients in the same segment
                const segmentBuyers = segmentBuyerMap.get(clientSegment)
                if (segmentBuyers && segmentBuyers.size > 1) {

                    // Aggregate what similar-profile clients buy (Curva A do segmento)
                    const segmentProductScores = new Map<string, number>()

                    segmentBuyers.forEach(buyerId => {
                        if (buyerId === client.id) return
                        const buyerProducts = clientProductMap.get(buyerId)
                        if (!buyerProducts) return

                        buyerProducts.forEach((qtd, prodId) => {
                            segmentProductScores.set(prodId, (segmentProductScores.get(prodId) || 0) + qtd)
                        })
                    })

                    // Sort by score desc → Curva A products for this segment
                    const rankedSegmentProducts = Array.from(segmentProductScores.entries())
                        .sort((a, b) => b[1] - a[1])

                    // All products this client has EVER bought
                    const allBoughtProductIds = new Set(Array.from(myProducts.keys()))

                    // Products bought in last 6 months
                    const recentProductIds = new Set<string>()
                    for (const pedido of client.pedidos) {
                        if (new Date(pedido.data) >= sixMonthsAgo) {
                            for (const item of pedido.itens) {
                                recentProductIds.add(item.produtoId)
                            }
                        }
                    }

                    let crossSellFound = false

                    // STEP 3: Gap Filter — find top product this client NEVER bought (absolute gap)
                    for (let aIdx = 0; aIdx < rankedSegmentProducts.length && !crossSellFound; aIdx++) {
                        const prodId = rankedSegmentProducts[aIdx][0]
                        const score = rankedSegmentProducts[aIdx][1]

                        // Priority: products NEVER bought by this client
                        if (allBoughtProductIds.has(prodId)) continue
                        if (globalSuggestedProducts.has(prodId) && score < 50) continue

                        const prod = productMap.get(prodId)
                        if (!prod) continue

                        opportunities.push({
                            type: 'crossSell',
                            clienteId: client.id,
                            clienteNome: client.nomeFantasia,
                            clienteTelefone: phone,
                            description: `Oportunidade Estratégica: Introduzir "${prod.nome}" para elevar o ticket médio. Foco em rentabilidade para o cliente através da substituição de concorrentes de baixo giro na gôndola.`,
                            priority: 'alta',
                            actionLabel: 'Oferecer Produto',
                            contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer introduzir "${prod.nome}" (alta saída entre clientes de ${segmentLabel}). ${taticasCrossSell}`
                        })

                        globalSuggestedProducts.add(prodId)
                        crossSellFound = true
                    }

                    // STEP 3b (FALLBACK): product not bought in 6+ months
                    if (!crossSellFound) {
                        for (let aIdx = 0; aIdx < rankedSegmentProducts.length && !crossSellFound; aIdx++) {
                            const prodId = rankedSegmentProducts[aIdx][0]
                            const score = rankedSegmentProducts[aIdx][1]

                            if (recentProductIds.has(prodId)) continue
                            if (globalSuggestedProducts.has(prodId) && score < 50) continue

                            const prod = productMap.get(prodId)
                            if (!prod) continue

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: `Oportunidade Estratégica: Introduzir "${prod.nome}" para elevar o ticket médio. Foco em rentabilidade para o cliente através da substituição de concorrentes de baixo giro na gôndola.`,
                                priority: 'media',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer reintroduzir "${prod.nome}" (popular entre clientes de ${segmentLabel}, faz +6 meses que este não compra). ${taticasCrossSell}`
                            })

                            globalSuggestedProducts.add(prodId)
                            crossSellFound = true
                        }
                    }

                    // STEP 4 (FALLBACK): Diversified high-volume product (pre-computed global stats)
                    if (!crossSellFound) {
                        for (const stat of globalStats) {
                            if (allBoughtProductIds.has(stat.produtoId)) continue
                            if (globalSuggestedProducts.has(stat.produtoId)) continue

                            const prod = productMap.get(stat.produtoId)
                            if (!prod) continue

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: `Oportunidade Estratégica: Introduzir "${prod.nome}" para elevar o ticket médio. Foco em rentabilidade para o cliente através da substituição de concorrentes de baixo giro na gôndola.`,
                                priority: 'baixa',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer introduzir "${prod.nome}" (um dos itens de maior giro no mercado, cliente nunca experimentou). ${taticasCrossSell}`
                            })

                            globalSuggestedProducts.add(stat.produtoId)
                            break
                        }
                    }
                }
            }

            // --- SEASONAL OPPORTUNITY ---
            const ordersThisMonth = client.pedidos.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )
            const avgOrdersPerMonth = client.pedidos.length / 12

            if (client.createdAt < sixMonthsAgo && ordersThisMonth.length > avgOrdersPerMonth * 1.3 && ordersThisMonth.length < avgOrdersPerMonth * 2.5) {
                opportunities.push({
                    type: 'seasonal',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,
                    description: `Historicamente compra mais neste mês. Momento ideal para contato.`,
                    priority: 'media',
                    actionLabel: 'Contatar Cliente',
                    contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Sugira a reposição de stock, pois os dados históricos mostram que este é um mês de fortes vendas na região dele.`
                })
            }
        }

        // Sort by priority
        const priorityOrder = { alta: 0, media: 1, baixa: 2 }
        opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

        return NextResponse.json({
            opportunities: opportunities.slice(0, 20),
            summary: {
                total: opportunities.length,
                upgrade: opportunities.filter(o => o.type === 'upgrade').length,
                crossSell: opportunities.filter(o => o.type === 'crossSell').length,
                seasonal: opportunities.filter(o => o.type === 'seasonal').length
            }
        })
    } catch (error) {
        console.error('Error fetching opportunities:', error)
        return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
    }
}
