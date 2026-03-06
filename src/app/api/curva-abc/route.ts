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
        const clienteId = searchParams.get('clienteId') // optional now
        const fabricaId = searchParams.get('fabricaId') // NEW: optional
        const dataInicioRaw = searchParams.get('dataInicio')
        const dataFimRaw = searchParams.get('dataFim')

        // ====== SAFE DATE PARSING ======
        let dataInicio: Date | undefined
        let dataFim: Date | undefined

        if (dataInicioRaw) {
            dataInicio = new Date(dataInicioRaw)
            if (isNaN(dataInicio.getTime())) dataInicio = undefined
        }
        if (dataFimRaw) {
            dataFim = new Date(dataFimRaw)
            if (isNaN(dataFim.getTime())) dataFim = undefined
        }

        // ====== BUILD DYNAMIC PEDIDO WHERE ======
        const pedidoWhere: any = {
            status: {
                in: ['Concluido', 'Faturado', 'concluido', 'faturado']
            }
        }

        // Optional client filter
        if (clienteId && clienteId !== 'TODOS') {
            pedidoWhere.clienteId = clienteId
        }

        // Date filter (always recommended)
        if (dataInicio && dataFim) {
            pedidoWhere.data = { gte: dataInicio, lte: dataFim }
        } else if (dataInicio) {
            pedidoWhere.data = { gte: dataInicio }
        } else if (dataFim) {
            pedidoWhere.data = { lte: dataFim }
        }

        // ====== BUILD DYNAMIC ITEM WHERE ======
        const itemWhere: any = {
            pedido: pedidoWhere
        }

        // Optional fábrica filter (filters on the product's fabricaId)
        if (fabricaId && fabricaId !== 'TODAS') {
            itemWhere.produto = { fabricaId }
        }

        // ====== FINDMANY + INCLUDE ======
        const items = await prisma.itemPedido.findMany({
            where: itemWhere,
            include: {
                produto: {
                    select: {
                        id: true,
                        nome: true,
                        fabricaId: true,
                        fabrica: {
                            select: { nome: true }
                        }
                    }
                }
            }
        })

        if (!items || items.length === 0) {
            return NextResponse.json({
                data: [],
                summary: { totalCaixas: 0, totalFaturado: 0 }
            })
        }

        // ====== IN-MEMORY AGGREGATION (.reduce) ======
        const grouped = items.reduce((acc, item) => {
            const pid = item.produtoId
            if (!acc[pid]) {
                acc[pid] = {
                    produtoId: pid,
                    nomeProduto: item.produto?.nome || 'Produto Desconhecido',
                    marca: item.produto?.fabrica?.nome || '',
                    quantidade: 0,
                    valorTotal: 0
                }
            }
            acc[pid].quantidade += item.quantidade
            acc[pid].valorTotal += Number(item.total || 0)
            return acc
        }, {} as Record<string, { produtoId: string; nomeProduto: string; marca: string; quantidade: number; valorTotal: number }>)

        // ====== SORT BY REVENUE DESC (Financial Ranking) ======
        const sorted = Object.values(grouped).sort((a, b) => b.valorTotal - a.valorTotal)

        // ====== TOTALS ======
        let totalCaixas = 0
        let totalFaturado = 0
        sorted.forEach(item => {
            totalCaixas += item.quantidade
            totalFaturado += item.valorTotal
        })

        // ====== ABC CLASSIFICATION — FINANCIAL (80-15-5 on Revenue) ======
        let accumulatedRevenue = 0
        const result = sorted.map((item, index) => {
            accumulatedRevenue += item.valorTotal
            const percent = totalFaturado > 0 ? (accumulatedRevenue / totalFaturado) * 100 : 0

            let curvaTag = 'C'
            if (percent <= 80) curvaTag = 'A'
            else if (percent <= 95) curvaTag = 'B'

            return {
                posicao: index + 1,
                produtoId: item.produtoId,
                nomeProduto: item.nomeProduto,
                marca: item.marca,
                quantidade: item.quantidade,
                valorTotal: item.valorTotal,
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
        console.error('Curva ABC Error:', error?.message || error)
        console.error('Curva ABC Stack:', error?.stack)
        return NextResponse.json({ error: 'Erro ao gerar Curva ABC', details: error?.message }, { status: 500 })
    }
}
