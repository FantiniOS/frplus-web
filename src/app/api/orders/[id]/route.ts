import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

interface Params {
    params: { id: string }
}

export const dynamic = 'force-dynamic';

// GET /api/orders/[id] - Get single order with details
export async function GET(request: Request, { params }: Params) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        // Se for indústria de uma fábrica específica, só pode ver o pedido se for dessa fábrica
        const whereClause: any = { id: params.id }
        if (user.role === 'industria' && user.fabricaId) {
            whereClause.fabricaId = user.fabricaId
        }

        const order = await prisma.pedido.findUnique({
            where: whereClause,
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
            tipo: order.tipo, // Fixed: Was missing, causing UI to default to 'Venda'
            valorTotal: Number(order.valorTotal),
            tabelaPreco: order.tabelaPreco,
            condicaoPagamento: order.condicaoPagamento,
            observacoes: order.observacoes,
            dataEntregaProgramada: (order as any).dataEntregaProgramada?.toISOString() || null,
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
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()

        console.log(`[API] PUT /api/orders/${params.id} - Received Payload:`, JSON.stringify(body, null, 2));

        // Determine if status indicates billing (faturamento)
        const statusFaturado = ['faturado', 'concluido'].includes((body.status || '').toLowerCase())

        // Auto-set dataFaturamento when status changes to billed
        // Clear it when reverting to non-billed status
        let dataFaturamentoUpdate: Date | null | undefined = undefined
        if (statusFaturado) {
            // Check if already has dataFaturamento — if not, set it now
            const existing = await prisma.pedido.findUnique({
                where: { id: params.id },
                select: { dataFaturamento: true, status: true }
            })
            const wasAlreadyFaturado = existing && ['faturado', 'concluido'].includes(existing.status.toLowerCase())
            if (!wasAlreadyFaturado || !existing?.dataFaturamento) {
                dataFaturamentoUpdate = new Date()
            }
        } else if (body.status) {
            // Status is being changed to something non-billed — clear dataFaturamento
            dataFaturamentoUpdate = null
        }

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
                    clienteId: body.clienteId, // Allow changing client
                    tipo: body.tipo, // Essential for Bonificacao
                    status: body.status,
                    observacoes: body.observacoes,
                    valorTotal: body.valorTotal,
                    tabelaPreco: body.tabelaPreco,
                    condicaoPagamento: body.condicaoPagamento,
                    // Entrega Programada (opcional, apenas data)
                    ...(body.dataEntregaProgramada !== undefined && { dataEntregaProgramada: body.dataEntregaProgramada ? new Date(body.dataEntregaProgramada) : null }),
                    // Auto-manage dataFaturamento based on status
                    ...(dataFaturamentoUpdate !== undefined && { dataFaturamento: dataFaturamentoUpdate }),
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
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        await prisma.pedido.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting order:', error)
        return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
    }
}
