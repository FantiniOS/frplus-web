import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/sales-insights - Get sales leverage insights
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
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
        }> = []

        for (const client of clients) {
            if (client.pedidos.length < 2) continue

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
                    actionLabel: 'Aumentar Volume'
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
                        actionLabel: 'Investigar Motivo'
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
                    actionLabel: 'Reativar Cliente'
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
