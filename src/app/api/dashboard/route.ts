import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/dashboard - Get dashboard statistics
export async function GET() {
    try {
        // Count totals
        const [clientsCount, productsCount, ordersCount] = await Promise.all([
            prisma.cliente.count(),
            prisma.produto.count(),
            prisma.pedido.count()
        ])

        // Calculate total revenue
        const revenueResult = await prisma.pedido.aggregate({
            _sum: { valorTotal: true }
        })
        const totalRevenue = Number(revenueResult._sum.valorTotal) || 0

        // Get recent orders (last 5)
        const recentOrders = await prisma.pedido.findMany({
            take: 5,
            orderBy: { data: 'desc' },
            include: { cliente: true }
        })

        // Get top products by sales
        const topProducts = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true, total: true },
            orderBy: { _sum: { total: 'desc' } },
            take: 5
        })

        // Fetch product names for top products
        const productIds = topProducts.map(p => p.produtoId)
        const products = await prisma.produto.findMany({
            where: { id: { in: productIds } }
        })
        const productMap = new Map(products.map(p => [p.id, p.nome]))

        // Sales by day (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const salesByDay = await prisma.pedido.findMany({
            where: { data: { gte: thirtyDaysAgo } },
            select: { data: true, valorTotal: true }
        })

        // Group sales by date
        const salesMap = new Map<string, number>()
        salesByDay.forEach(order => {
            const dateKey = order.data.toISOString().split('T')[0]
            salesMap.set(dateKey, (salesMap.get(dateKey) || 0) + Number(order.valorTotal))
        })

        return NextResponse.json({
            stats: {
                clients: clientsCount,
                products: productsCount,
                orders: ordersCount,
                revenue: totalRevenue
            },
            recentOrders: recentOrders.map(o => ({
                id: o.id,
                nomeCliente: o.cliente.nomeFantasia,
                data: o.data.toISOString(),
                valorTotal: Number(o.valorTotal),
                status: o.status
            })),
            topProducts: topProducts.map(p => ({
                produtoId: p.produtoId,
                nome: productMap.get(p.produtoId) || 'Unknown',
                quantidade: p._sum.quantidade || 0,
                valor: Number(p._sum.total) || 0
            })),
            salesByDay: Array.from(salesMap.entries()).map(([date, value]) => ({
                date,
                value
            }))
        })
    } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
    }
}
