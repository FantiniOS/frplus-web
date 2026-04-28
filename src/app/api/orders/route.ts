import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/orders - List all orders
export async function GET(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const url = new URL(request.url)
        const filterFabricaId = url.searchParams.get('fabricaId')

        // Se for indústria atrelada a uma fábrica, filtra pedidos
        const whereClause: any = user.role === 'industria' && user.fabricaId
            ? { fabricaId: user.fabricaId }
            : {}
            
        if (filterFabricaId && filterFabricaId !== 'todas') {
            whereClause.fabricaId = filterFabricaId
        }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            include: {
                cliente: true,
                itens: {
                    include: {
                        produto: true
                    }
                }
            },
            orderBy: [
                { notaFiscal: 'desc' },
                { data: 'desc' }
            ]
        })

        // (We no longer need productMap since we include produto directly)

        const formattedOrders = orders.map(o => ({
            id: o.id,
            clienteId: o.clienteId,
            nomeCliente: o.cliente?.nomeFantasia || o.cliente?.razaoSocial || 'Cliente Desconhecido',
            fabricaId: o.fabricaId,
            data: o.data.toISOString(),
            dataPedido: o.data.toISOString(),
            dataFaturamento: o.dataFaturamento?.toISOString() || null,
            dataNotaFiscal: o.dataFaturamento?.toISOString() || null,
            status: o.status,
            tipo: o.tipo,
            valorTotal: Number(o.valorTotal),
            tabelaPreco: o.tabelaPreco,
            condicaoPagamento: o.condicaoPagamento,
            observacoes: o.observacoes,
            notaFiscal: o.notaFiscal,
            createdAt: o.createdAt.toISOString(),
            itens: o.itens.map(item => ({
                id: item.id,
                produtoId: item.produtoId,
                nomeProduto: item.produto?.nome || 'Produto Removido',
                unidade: item.produto?.unidade || 'UN',
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
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

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
                data: body.data ? new Date(body.data) : undefined,
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
            tipo: order.tipo, // Added: Ensure order type is returned
            valorTotal: Number(order.valorTotal),
            itens: order.itens.map(item => ({
                id: item.id,
                produtoId: item.produtoId,
                nomeProduto: item.produto?.nome || 'Produto Removido',
                unidade: item.produto?.unidade || 'UN',
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
