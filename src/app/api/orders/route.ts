import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/orders - List all orders
export async function GET() {
    try {
        const orders = await prisma.pedido.findMany({
            include: {
                cliente: true,
                itens: {
                    include: { produto: true }
                }
            },
            orderBy: { data: 'desc' }
        })

        const formattedOrders = orders.map(o => ({
            id: o.id,
            clienteId: o.clienteId,
            nomeCliente: o.cliente?.nomeFantasia || o.cliente?.razaoSocial || 'Cliente Desconhecido',
            data: o.data.toISOString(),
            status: o.status,
            valorTotal: Number(o.valorTotal),
            tabelaPreco: o.tabelaPreco,
            condicaoPagamento: o.condicaoPagamento,
            observacoes: o.observacoes,
            itens: o.itens.map(item => ({
                id: item.id,
                produtoId: item.produtoId,
                nomeProduto: item.produto.nome,
                quantidade: item.quantidade,
                precoUnitario: Number(item.precoUnitario),
                total: Number(item.total)
            }))
        }))

        return NextResponse.json(formattedOrders)
    } catch (error) {
        console.error('Error fetching orders:', error)
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }
}

// POST /api/orders - Create a new order (transactional)
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Calculate total from items
        const valorTotal = body.itens.reduce(
            (acc: number, item: { quantidade: number; precoUnitario: number }) =>
                acc + (item.quantidade * item.precoUnitario),
            0
        )

        const order = await prisma.pedido.create({
            data: {
                clienteId: body.clienteId,
                fabricaId: body.fabricaId,
                status: 'Pendente',
                valorTotal: valorTotal,
                tabelaPreco: body.tabelaPreco,
                condicaoPagamento: body.condicaoPagamento,
                observacoes: body.observacoes,
                itens: {
                    create: body.itens.map((item: { produtoId: string; quantidade: number; precoUnitario: number }) => ({
                        produtoId: item.produtoId,
                        quantidade: item.quantidade,
                        precoUnitario: item.precoUnitario,
                        total: item.quantidade * item.precoUnitario
                    }))
                }
            },
            include: {
                cliente: true,
                itens: { include: { produto: true } }
            }
        })

        return NextResponse.json({
            id: order.id,
            clienteId: order.clienteId,
            nomeCliente: order.cliente.nomeFantasia,
            data: order.data.toISOString(),
            status: order.status,
            valorTotal: Number(order.valorTotal),
            itens: order.itens.map(item => ({
                id: item.id,
                produtoId: item.produtoId,
                nomeProduto: item.produto.nome,
                quantidade: item.quantidade,
                precoUnitario: Number(item.precoUnitario),
                total: Number(item.total)
            }))
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating order:', error)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
