import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/opportunities - Get sales opportunities
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // ============================================================
        // DATA LOADING
        // ============================================================

        // 1. Get all clients with their order history (including item details)
        const clients = await prisma.cliente.findMany({
            include: {
                pedidos: {
                    include: {
                        itens: {
                            include: { produto: true }
                        }
                    },
                    orderBy: { data: 'desc' }
                }
            }
        })

        // 2. Get all products with factory info
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })

        // Product lookup maps
        const productMap = new Map(products.map(p => [p.id, p]))

        // 3. Build a global "Factory Affinity" index:
        //    For each fabricaId, which OTHER products are most bought by
        //    clients who buy from that factory?
        //    Structure: fabricaId -> Map<produtoId, totalQtd> (sorted by qty desc)
        const factoryBuyerMap = new Map<string, Set<string>>() // fabricaId -> Set<clienteId>
        const clientProductMap = new Map<string, Map<string, number>>() // clienteId -> Map<produtoId, totalQtd>

        for (const client of clients) {
            const prodQtdMap = new Map<string, number>()
            for (const pedido of client.pedidos) {
                for (const item of pedido.itens) {
                    prodQtdMap.set(item.produtoId, (prodQtdMap.get(item.produtoId) || 0) + item.quantidade)

                    // Track which clients buy from which factory
                    const prod = productMap.get(item.produtoId)
                    if (prod) {
                        if (!factoryBuyerMap.has(prod.fabricaId)) {
                            factoryBuyerMap.set(prod.fabricaId, new Set())
                        }
                        factoryBuyerMap.get(prod.fabricaId)!.add(client.id)
                    }
                }
            }
            if (prodQtdMap.size > 0) {
                clientProductMap.set(client.id, prodQtdMap)
            }
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

        // Track which products have already been suggested as cross-sell
        // to diversify fallback suggestions across clients
        const globalSuggestedProducts = new Set<string>()

        for (const client of clients) {
            // Skip clients with no orders
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
                    description: `${thisMonthOrders.length} pedidos este mês na tabela 50-199. Sugerir migração para 200-699.`,
                    priority: 'alta',
                    actionLabel: 'Propor Upgrade',
                    contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Proponha a mudança para a tabela de atacado (200+) porque o cliente fez vários pedidos este mês na tabela 50-199.`
                })
            }

            // ==========================================================
            // --- CROSS-SELL: Market Basket / Collaborative Filtering ---
            // ==========================================================
            const myProducts = clientProductMap.get(client.id)
            if (myProducts && myProducts.size > 0) {

                // STEP 1: Identify "Core Factory" — the factory this client buys most from
                const factoryQtdMap = new Map<string, number>()
                myProducts.forEach((qtd, prodId) => {
                    const prod = productMap.get(prodId)
                    if (prod) {
                        factoryQtdMap.set(prod.fabricaId, (factoryQtdMap.get(prod.fabricaId) || 0) + qtd)
                    }
                })

                // Sort factories by quantity desc → get core factory
                const sortedFactories = Array.from(factoryQtdMap.entries())
                    .sort((a, b) => b[1] - a[1])

                // Products this client bought in the last 6 months
                const recentProductIds = new Set<string>()
                for (const pedido of client.pedidos) {
                    if (new Date(pedido.data) >= sixMonthsAgo) {
                        for (const item of pedido.itens) {
                            recentProductIds.add(item.produtoId)
                        }
                    }
                }

                // All products ever bought
                const allBoughtProductIds = new Set(Array.from(myProducts.keys()))

                let crossSellFound = false

                // Try each core factory (primary, then secondary) for affinity match
                for (const [coreFactoryId] of sortedFactories) {
                    if (crossSellFound) break

                    // STEP 2: Find OTHER clients who also buy from this core factory
                    const coreFactoryBuyers = factoryBuyerMap.get(coreFactoryId)
                    if (!coreFactoryBuyers || coreFactoryBuyers.size <= 1) continue

                    // Aggregate what those other clients buy (collaborative filtering)
                    const affinityScores = new Map<string, number>() // produtoId -> aggregate qty from similar clients

                    coreFactoryBuyers.forEach(buyerId => {
                        if (buyerId === client.id) return // exclude self
                        const buyerProducts = clientProductMap.get(buyerId)
                        if (!buyerProducts) return

                        buyerProducts.forEach((qtd, prodId) => {
                            // Only count products from OTHER factories (true cross-sell)
                            // or same factory but different product
                            const prod = productMap.get(prodId)
                            if (!prod) return
                            affinityScores.set(prodId, (affinityScores.get(prodId) || 0) + qtd)
                        })
                    })

                    // Sort by affinity score desc
                    const rankedAffinity = Array.from(affinityScores.entries())
                        .sort((a, b) => b[1] - a[1])

                    // STEP 3: Gap Filter — find the top affinity product this client
                    // has NOT bought in the last 6 months
                    for (const [prodId, score] of rankedAffinity) {
                        if (recentProductIds.has(prodId)) continue // bought recently, skip
                        if (globalSuggestedProducts.has(prodId) && score < 50) continue // diversify

                        const prod = productMap.get(prodId)
                        if (!prod) continue

                        const coreFactory = productMap.get(
                            Array.from(myProducts.keys()).find(pid => productMap.get(pid)?.fabricaId === coreFactoryId) || ''
                        )
                        const coreFactoryName = coreFactory?.fabrica?.nome || 'a fábrica principal'
                        const neverBought = !allBoughtProductIds.has(prodId)

                        opportunities.push({
                            type: 'crossSell',
                            clienteId: client.id,
                            clienteNome: client.nomeFantasia,
                            clienteTelefone: phone,
                            description: neverBought
                                ? `Clientes que compram "${coreFactoryName}" também compram "${prod.nome}" — este cliente nunca comprou.`
                                : `"${prod.nome}" não compra há +6 meses. Clientes similares compram com frequência.`,
                            priority: neverBought ? 'alta' : 'media',
                            actionLabel: 'Oferecer Produto',
                            contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Sugira "${prod.nome}" (da ${prod.fabrica?.nome || 'fábrica'}) porque clientes com perfil de compra parecido (mesmo core de "${coreFactoryName}") compram esse produto com frequência, e ${neverBought ? 'este cliente ainda não experimentou' : 'faz mais de 6 meses que não compra'}.`
                        })

                        globalSuggestedProducts.add(prodId)
                        crossSellFound = true
                        break
                    }
                }

                // STEP 4 (FALLBACK): If no affinity match found,
                // suggest a diversified high-volume product the client never bought
                if (!crossSellFound) {
                    // Get global top products NOT bought by this client
                    // and NOT already over-suggested
                    const globalStats = await prisma.itemPedido.groupBy({
                        by: ['produtoId'],
                        _sum: { quantidade: true },
                        orderBy: { _sum: { quantidade: 'desc' } },
                        take: 30
                    })

                    for (const stat of globalStats) {
                        if (recentProductIds.has(stat.produtoId)) continue
                        if (globalSuggestedProducts.has(stat.produtoId)) continue // DIVERSIFY: skip already suggested

                        const prod = productMap.get(stat.produtoId)
                        if (!prod) continue

                        opportunities.push({
                            type: 'crossSell',
                            clienteId: client.id,
                            clienteNome: client.nomeFantasia,
                            clienteTelefone: phone,
                            description: `"${prod.nome}" é um dos produtos mais vendidos e este cliente não compra há tempo.`,
                            priority: 'baixa',
                            actionLabel: 'Oferecer Produto',
                            contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Sugira "${prod.nome}" (da ${prod.fabrica?.nome || 'fábrica'}) como oportunidade, pois é um dos itens de maior giro no mercado e o cliente não tem comprado recentemente.`
                        })

                        globalSuggestedProducts.add(stat.produtoId)
                        break
                    }
                }
            }

            // --- SEASONAL OPPORTUNITY ---
            const ordersThisMonth = client.pedidos.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )
            const avgOrdersPerMonth = client.pedidos.length / 12

            const sixMonthsAgoSeasonal = new Date()
            sixMonthsAgoSeasonal.setMonth(sixMonthsAgoSeasonal.getMonth() - 6)

            if (client.createdAt < sixMonthsAgoSeasonal && ordersThisMonth.length > avgOrdersPerMonth * 1.3 && ordersThisMonth.length < avgOrdersPerMonth * 2.5) {
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
