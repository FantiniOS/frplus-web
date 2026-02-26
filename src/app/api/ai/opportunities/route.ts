import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/opportunities - Get sales opportunities
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // 1. Get all clients with their order history
        const clients = await prisma.cliente.findMany({
            include: {
                pedidos: {
                    include: {
                        itens: true
                    },
                    orderBy: { data: 'desc' }
                }
            }
        })

        // 2. Get all products for cross-sell analysis
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })

        // 3. Calculate Global Product Popularity (Best Sellers)
        // Group by product and sum quantities to find what sells most
        const productStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: {
                quantidade: true
            }
        })

        // Create a Map: ProductID -> Total Sold
        const popularityMap = new Map<string, number>()
        productStats.forEach(stat => {
            if (stat._sum.quantidade) {
                popularityMap.set(stat.produtoId, stat._sum.quantidade)
            }
        })

        const opportunities: Array<{
            type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation'
            clienteId: string
            clienteNome: string
            clienteTelefone?: string
            description: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
            messageSuggestion: string // Persuasive text for WhatsApp
        }> = []

        const now = new Date()
        const currentMonth = now.getMonth()

        for (const client of clients) {
            // Skip clients with no orders
            if (client.pedidos.length === 0) continue

            const phone = client.celular || client.telefone || '' // Get phone
            // @ts-ignore
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

            const recentOrders = client.pedidos.slice(0, 10)
            const thisMonthOrders = recentOrders.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )

            // --- UPGRADE OPPORTUNITY ---
            // Client using 50-199 table but ordering frequently
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
                    messageSuggestion: `Olá ${greetingName}, tudo bem? Estava analisando seu volume de compras recente e vi que você já está num ritmo excelente! 🚀 Se ajustarmos um pouco o próximo pedido, consigo te encaixar na Tabela de Atacado (200+) para melhorar sua margem. Vamos simular sem compromisso?`
                })
            }

            // --- CROSS-SELL OPPORTUNITY ---
            // Products the client never bought from factories they already buy from
            const boughtProductIds = new Set(
                recentOrders.flatMap(o => o.itens.map(i => i.produtoId))
            )
            const productFabricaMap = new Map(products.map(p => [p.id, p.fabricaId]))
            const boughtFabricaIds = new Set(
                recentOrders.flatMap(o =>
                    o.itens.map(i => productFabricaMap.get(i.produtoId)).filter(Boolean)
                )
            )

            const crossSellProducts = products
                .filter(p => boughtFabricaIds.has(p.fabricaId) && !boughtProductIds.has(p.id))
                .sort((a, b) => {
                    // Sort by Global Popularity (Desc)
                    const scoreA = popularityMap.get(a.id) || 0
                    const scoreB = popularityMap.get(b.id) || 0
                    return scoreB - scoreA
                })

            if (crossSellProducts.length > 0) {
                const topProduct = crossSellProducts[0]
                opportunities.push({
                    type: 'crossSell',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,

                    description: `Oportunidade de incluir "${topProduct.nome}" no mix.`,
                    priority: 'media',
                    actionLabel: 'Oferecer Produto',
                    messageSuggestion: `Olá ${greetingName}! Vi que você já trabalha muito bem com a linha da ${topProduct.fabrica?.nome || 'fábrica'}, mas notei que o item "${topProduct.nome}" ainda não está no seu mix. Esse produto tem tido uma saída excelente em lojas do seu perfil. Vamos incluir uma caixa no próximo pedido para testar?`
                })
            }

            // --- SEASONAL OPPORTUNITY ---
            // Check if client typically buys more in this month historically
            const ordersThisMonth = client.pedidos.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )
            const avgOrdersPerMonth = client.pedidos.length / 12

            // Seasonal only for clients older than 1 year
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            if (client.createdAt < sixMonthsAgo && ordersThisMonth.length > avgOrdersPerMonth * 1.3 && ordersThisMonth.length < avgOrdersPerMonth * 2.5) {
                opportunities.push({
                    type: 'seasonal',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,
                    description: `Historicamente compra mais neste mês. Momento ideal para contato.`,
                    priority: 'media',
                    actionLabel: 'Contatar Cliente',
                    messageSuggestion: `Olá ${greetingName}, tudo bem? O mercado está aquecendo e, pelo seu histórico do ano passado, esse é um mês forte de vendas aí na sua região. 📈 Que tal já garantirmos o estoque para não perder nenhuma venda?`
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
