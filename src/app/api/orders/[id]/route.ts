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

// PUT /api/orders/[id] - Update order (Full update: Header + Items replacement)
export async function PUT(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        // Use transaction to ensure consistency: 
        // 1. Delete all existing items
        // 2. Update order details and create new items
        // This is safer than upserting individual items for this use case
        await prisma.$transaction([
            prisma.itemPedido.deleteMany({
                where: { pedidoId: params.id }
            }),
            prisma.pedido.update({
                where: { id: params.id },
                data: {
                    tipo: body.tipo, // Essential for Bonificacao
                    status: body.status,
                    observacoes: body.observacoes,
                    valorTotal: body.valorTotal,
                    tabelaPreco: body.tabelaPreco,
                    condicaoPagamento: body.condicaoPagamento,
                    // Re-create items
                    itens: {
                        create: body.itens.map((item: any) => ({
                            produtoId: item.produtoId,
                            quantidade: item.quantidade,
                            precoUnitario: item.precoUnitario,
                            total: item.total
                        }))
                    }
                }
            })
        ])

        // Fetch the updated order to return
        const updatedOrder = await prisma.pedido.findUnique({
            where: { id: params.id },
            include: {
                cliente: true,
                itens: { include: { produto: true } }
            }
        })

        return NextResponse.json(updatedOrder)
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
