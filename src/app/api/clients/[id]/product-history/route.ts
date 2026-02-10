import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const clientOrders = await prisma.pedido.findMany({
            where: { clienteId: params.id },
            orderBy: { data: 'desc' },
            include: {
                itens: true
            }
        })

        // Map product ID to last price paid
        const priceHistory: Record<string, number> = {}

        // Traverse orders from newest to oldest
        for (const order of clientOrders) {
            for (const item of order.itens) {
                // If we haven't seen this product yet, this is the most recent price
                if (!priceHistory[item.produtoId]) {
                    priceHistory[item.produtoId] = Number(item.precoUnitario)
                }
            }
        }

        return NextResponse.json(priceHistory)
    } catch (error) {
        console.error('Error fetching client product history:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
