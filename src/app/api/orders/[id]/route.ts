import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
    params: { id: string }
}

// GET /api/orders/[id] - Get single order with details
export async function GET(request: Request, { params }: Params) {
    try {
        const order = await prisma.pedido.findUnique({
            where: { id: params.id },
            include: {
                cliente: true,
                itens: { include: { produto: true } }
            }
        })

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        return NextResponse.json({
            id: order.id,
            clienteId: order.clienteId,
            nomeCliente: order.cliente.nomeFantasia,
            data: order.data.toISOString(),
            status: order.status,
            valorTotal: Number(order.valorTotal),
            tabelaPreco: order.tabelaPreco,
            condicaoPagamento: order.condicaoPagamento,
            observacoes: order.observacoes,
            itens: order.itens.map(item => ({
                id: item.id,
                produtoId: item.produtoId,
                nomeProduto: item.produto.nome,
                quantidade: item.quantidade,
                precoUnitario: Number(item.precoUnitario),
                total: Number(item.total)
            }))
        })
    } catch (error) {
        console.error('Error fetching order:', error)
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }
}

// PUT /api/orders/[id] - Update order status
export async function PUT(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        const order = await prisma.pedido.update({
            where: { id: params.id },
            data: {
                status: body.status,
                observacoes: body.observacoes
            }
        })

        return NextResponse.json(order)
    } catch (error) {
        console.error('Error updating order:', error)
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }
}

// DELETE /api/orders/[id] - Delete order (cascades to items)
export async function DELETE(request: Request, { params }: Params) {
    try {
        await prisma.pedido.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting order:', error)
        return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
    }
}
