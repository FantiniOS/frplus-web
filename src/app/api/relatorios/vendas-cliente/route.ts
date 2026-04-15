import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/relatorios/vendas-cliente?clienteId=...&dataInicial=...&dataFinal=...
export async function GET(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const url = new URL(request.url)
        const clienteId = url.searchParams.get('clienteId')
        const dataInicial = url.searchParams.get('dataInicial')
        const dataFinal = url.searchParams.get('dataFinal')

        if (!clienteId || !dataInicial || !dataFinal) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios: clienteId, dataInicial, dataFinal' },
                { status: 400 }
            )
        }

        // Parse dates — adjust dataFinal to include until 23:59:59.999
        const startDate = new Date(dataInicial)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(dataFinal)
        endDate.setHours(23, 59, 59, 999)

        // Fetch client info
        const cliente = await prisma.cliente.findUnique({
            where: { id: clienteId },
            select: {
                id: true,
                nomeFantasia: true,
                razaoSocial: true,
                cnpj: true,
                cidade: true,
                estado: true,
            }
        })

        if (!cliente) {
            return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
        }

        // Query orders: status Faturado or Concluido within date range
        const pedidos = await prisma.pedido.findMany({
            where: {
                clienteId,
                status: { in: ['Faturado', 'Concluido'] },
                data: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                itens: true,
            },
            orderBy: { data: 'asc' },
        })

        // Calculate aggregates — EXCLUDING bonificação from totals
        let volumeRealCaixas = 0
        let valorRealFaturado = 0
        let totalPedidosReais = 0

        const pedidosFormatados = pedidos.map(p => {
            const volCaixas = p.itens.reduce((acc, item) => acc + item.quantidade, 0)
            const valor = Number(p.valorTotal)
            const isBonificacao = p.tipo === 'Bonificacao' || valor === 0

            // Only count real sales in totals
            if (!isBonificacao) {
                volumeRealCaixas += volCaixas
                valorRealFaturado += valor
                totalPedidosReais++
            }

            return {
                id: p.id,
                data: p.data.toISOString(),
                numeroPedido: p.notaFiscal || p.id.slice(-6).toUpperCase(),
                volumeCaixas: volCaixas,
                valorFaturado: valor,
                isBonificacao,
            }
        })

        return NextResponse.json({
            cliente: {
                id: cliente.id,
                nome: cliente.nomeFantasia || cliente.razaoSocial || 'Cliente',
                cnpj: cliente.cnpj,
                cidade: cliente.cidade,
                estado: cliente.estado,
            },
            pedidos: pedidosFormatados,
            totais: {
                totalPedidos: totalPedidosReais,
                volumeTotalCaixas: volumeRealCaixas,
                valorTotalFaturado: valorRealFaturado,
            },
            periodo: {
                inicio: startDate.toISOString(),
                fim: endDate.toISOString(),
            },
        })
    } catch (error) {
        console.error('[API vendas-cliente] Erro:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}
