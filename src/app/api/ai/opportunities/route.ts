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
                        itens: {
                            include: { produto: true }
                        }
                    },
                    orderBy: { data: 'desc' }
                }
            }
        })

        // 2. Get all products for cross-sell analysis
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })

        const opportunities: Array<{
            type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation'
            clienteId: string
            clienteNome: string
            description: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
        }> = []

        const now = new Date()
        const currentMonth = now.getMonth()

        for (const client of clients) {
            // Skip clients with no orders
            if (client.pedidos.length === 0) continue

            const recentOrders = client.pedidos.slice(0, 10)
            const thisMonthOrders = recentOrders.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )

            // --- UPGRADE OPPORTUNITY ---
            // Client using 50-199 table but ordering frequently
            const using50a199 = recentOrders.some(o => o.tabelaPreco === '50a199')
            if (using50a199 && thisMonthOrders.length >= 3) {
                opportunities.push({
                    type: 'upgrade',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `${thisMonthOrders.length} pedidos este mês na tabela 50-199. Sugerir migração para 200-699.`,
                    priority: 'alta',
                    actionLabel: 'Propor Upgrade'
                })
            }

            // --- CROSS-SELL OPPORTUNITY ---
            // Products the client never bought from factories they already buy from
            const boughtProductIds = new Set(
                recentOrders.flatMap(o => o.itens.map(i => i.produtoId))
            )
            const boughtFabricaIds = new Set(
                recentOrders.flatMap(o =>
                    o.itens.map(i => i.produto.fabricaId)
                )
            )

            const crossSellProducts = products.filter(p =>
                boughtFabricaIds.has(p.fabricaId) && !boughtProductIds.has(p.id)
            )

            if (crossSellProducts.length > 0) {
                const topProduct = crossSellProducts[0]
                opportunities.push({
                    type: 'crossSell',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Nunca comprou "${topProduct.nome}" da ${topProduct.fabrica.nome}. ${crossSellProducts.length} produtos disponíveis.`,
                    priority: 'media',
                    actionLabel: 'Oferecer Produto'
                })
            }

            // --- SEASONAL OPPORTUNITY ---
            // Check if client typically buys more in this month historically
            const ordersThisMonth = client.pedidos.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )
            const avgOrdersPerMonth = client.pedidos.length / 12

            if (ordersThisMonth.length > avgOrdersPerMonth * 1.5 && ordersThisMonth.length < avgOrdersPerMonth * 2) {
                opportunities.push({
                    type: 'seasonal',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    description: `Historicamente compra mais neste mês. Momento ideal para contato.`,
                    priority: 'media',
                    actionLabel: 'Contatar Cliente'
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
