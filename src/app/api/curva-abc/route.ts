export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export async function GET(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const clienteId = searchParams.get('clienteId')
        const dataInicio = searchParams.get('dataInicio')
        const dataFim = searchParams.get('dataFim')

        if (!clienteId) {
            return NextResponse.json({ error: 'Cliente ID é obrigatório' }, { status: 400 })
        }

        // Base where clause for Pedido
        const pedidoWhere: any = {
            clienteId: clienteId,
            status: {
                in: ['Concluido', 'Faturado'] // Only count actual sales
            }
        }

        if (dataInicio && dataFim) {
            pedidoWhere.dataEmissao = { // Adjusted to standard field, but will check schema soon
                gte: new Date(dataInicio),
                lte: new Date(dataFim)
            }
        } else if (dataInicio) {
            pedidoWhere.dataEmissao = { gte: new Date(dataInicio) }
        } else if (dataFim) {
            pedidoWhere.dataEmissao = { lte: new Date(dataFim) }
        }

        // Fetch items and group by product
        const itemsGrouped = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            where: {
                pedido: pedidoWhere
            },
            _sum: {
                quantidade: true,
                total: true
            },
            orderBy: {
                _sum: {
                    quantidade: 'desc'
                }
            }
        })

        // Ensure we have results
        if (!itemsGrouped || itemsGrouped.length === 0) {
            return NextResponse.json({
                data: [],
                summary: { totalCaixas: 0, totalFaturado: 0 }
            })
        }

        // Compute total volume for ABC logic
        let totalCaixas = 0
        let totalFaturado = 0
        itemsGrouped.forEach(item => {
            totalCaixas += item._sum.quantidade || 0
            totalFaturado += Number(item._sum.total || 0)
        })

        // Fetch product names for the grouped list
        const productIds = itemsGrouped.map(item => item.produtoId)
        const products = await prisma.produto.findMany({
            where: { id: { in: productIds } },
            select: { id: true, nome: true }
        })

        const productMap = new Map()
        products.forEach(p => productMap.set(p.id, p))

        // Assign ABC tags based on cumulative volume % (80-15-5 rule standard)
        let accumulatedVolume = 0
        const result = itemsGrouped.map((item, index) => {
            const qty = item._sum.quantidade || 0
            const value = Number(item._sum.total || 0)
            accumulatedVolume += qty
            const percent = (accumulatedVolume / totalCaixas) * 100

            let curvaTag = 'C'
            if (percent <= 80) curvaTag = 'A'
            else if (percent <= 95) curvaTag = 'B'

            const prd = productMap.get(item.produtoId)

            return {
                posicao: index + 1,
                produtoId: item.produtoId,
                nomeProduto: prd ? prd.nome : 'Produto Desconhecido',
                marca: '',
                quantidade: qty,
                valorTotal: value,
                curva: curvaTag
            }
        })

        return NextResponse.json({
            data: result,
            summary: {
                totalCaixas,
                totalFaturado
            }
        })

    } catch (error: any) {
        console.error('Curva ABC Error:', error)
        return NextResponse.json({ error: 'Erro ao gerar Curva ABC' }, { status: 500 })
    }
}
