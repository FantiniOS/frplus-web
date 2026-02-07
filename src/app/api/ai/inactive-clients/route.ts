import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/inactive-clients - Get clients sorted by inactivity
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const daysThreshold = parseInt(searchParams.get('days') || '15')

        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)

        // Get all clients with their last order date
        const clients = await prisma.cliente.findMany({
            include: {
                pedidos: {
                    orderBy: { data: 'desc' },
                    take: 1,
                    select: { data: true, valorTotal: true }
                },
                _count: { select: { pedidos: true } }
            }
        })

        // Calculate total spent per client
        const clientStats = await prisma.pedido.groupBy({
            by: ['clienteId'],
            _sum: { valorTotal: true },
            _count: true
        })

        const statsMap = new Map(clientStats.map(s => [s.clienteId, {
            totalGasto: Number(s._sum.valorTotal) || 0,
            totalPedidos: s._count
        }]))

        // Map and filter inactive clients
        const inactiveClients = clients
            .map(client => {
                const lastOrder = client.pedidos[0]
                const lastOrderDate = lastOrder?.data || null
                const daysSinceLastOrder = lastOrderDate
                    ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null

                const stats = statsMap.get(client.id) || { totalGasto: 0, totalPedidos: 0 }

                // Determine alert level (15+ amarelo, 30+ laranja, 60+ vermelho)
                let alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde' = 'verde'
                if (daysSinceLastOrder === null || daysSinceLastOrder >= 60) alertLevel = 'vermelho'
                else if (daysSinceLastOrder >= 30) alertLevel = 'laranja'
                else if (daysSinceLastOrder >= 15) alertLevel = 'amarelo'

                return {
                    id: client.id,
                    nomeFantasia: client.nomeFantasia,
                    razaoSocial: client.razaoSocial,
                    cidade: client.cidade,
                    telefone: client.telefone,
                    celular: client.celular,
                    email: client.email,
                    ultimaCompra: lastOrderDate?.toISOString() || null,
                    diasInativo: daysSinceLastOrder,
                    totalGasto: stats.totalGasto,
                    totalPedidos: stats.totalPedidos,
                    alertLevel
                }
            })
            .filter(c => c.diasInativo === null || c.diasInativo >= daysThreshold)
            .sort((a, b) => {
                // Null (never bought) first, then by days inactive descending
                if (a.diasInativo === null && b.diasInativo === null) return 0
                if (a.diasInativo === null) return -1
                if (b.diasInativo === null) return 1
                return b.diasInativo - a.diasInativo
            })

        // Summary stats
        const summary = {
            total: inactiveClients.length,
            vermelho: inactiveClients.filter(c => c.alertLevel === 'vermelho').length,
            laranja: inactiveClients.filter(c => c.alertLevel === 'laranja').length,
            amarelo: inactiveClients.filter(c => c.alertLevel === 'amarelo').length
        }

        return NextResponse.json({ clients: inactiveClients, summary })
    } catch (error) {
        console.error('Error fetching inactive clients:', error)
        return NextResponse.json({ error: 'Failed to fetch inactive clients' }, { status: 500 })
    }
}
