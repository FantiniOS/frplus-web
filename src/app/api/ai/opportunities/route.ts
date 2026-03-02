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

        // 4. Build factory-buyer and client-product indexes
        const factoryBuyerMap = new Map<string, Set<string>>() // fabricaId -> Set<clienteId>
        const clientProductMap = new Map<string, Map<string, number>>() // clienteId -> Map<produtoId, totalQtd>

        for (const client of clients) {
            const prodQtdMap = new Map<string, number>()
            for (const pedido of client.pedidos) {
                for (const item of pedido.itens) {
                    prodQtdMap.set(item.produtoId, (prodQtdMap.get(item.produtoId) || 0) + item.quantidade)

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

                const allBoughtProductIds = new Set(Array.from(myProducts.keys()))
                let crossSellFound = false

                // Try each core factory for affinity match
                for (let fIdx = 0; fIdx < sortedFactories.length && !crossSellFound; fIdx++) {
                    const coreFactoryId = sortedFactories[fIdx][0]

                    // STEP 2: Find OTHER clients who also buy from this core factory
                    const coreFactoryBuyers = factoryBuyerMap.get(coreFactoryId)
                    if (!coreFactoryBuyers || coreFactoryBuyers.size <= 1) continue

                    // Aggregate what those other clients buy (collaborative filtering)
                    const affinityScores = new Map<string, number>()

                    coreFactoryBuyers.forEach(buyerId => {
                        if (buyerId === client.id) return
                        const buyerProducts = clientProductMap.get(buyerId)
                        if (!buyerProducts) return

                        buyerProducts.forEach((qtd, prodId) => {
                            affinityScores.set(prodId, (affinityScores.get(prodId) || 0) + qtd)
                        })
                    })

                    // Sort by affinity score desc
                    const rankedAffinity = Array.from(affinityScores.entries())
                        .sort((a, b) => b[1] - a[1])

                    // STEP 3: Gap Filter — find top affinity product NOT bought in 6 months
                    for (let aIdx = 0; aIdx < rankedAffinity.length && !crossSellFound; aIdx++) {
                        const prodId = rankedAffinity[aIdx][0]
                        const score = rankedAffinity[aIdx][1]

                        if (recentProductIds.has(prodId)) continue
                        if (globalSuggestedProducts.has(prodId) && score < 50) continue

                        const prod = productMap.get(prodId)
                        if (!prod) continue

                        // Get core factory name from productMap
                        const coreFactoryProd = products.find(p => p.fabricaId === coreFactoryId)
                        const coreFactoryName = coreFactoryProd?.fabrica?.nome || 'a fábrica principal'
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
                    }
                }

                // STEP 4 (FALLBACK): Diversified high-volume product (pre-computed)
                if (!crossSellFound) {
                    for (const stat of globalStats) {
                        if (recentProductIds.has(stat.produtoId)) continue
                        if (globalSuggestedProducts.has(stat.produtoId)) continue

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
