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

        // Blindagem de Fuso Horário (UTC-3 Brasil)
        // O JS Date faz parse de "YYYY-MM-DD" como UTC.
        // Precisamos garantir que o Range seja 00:00:00 a 23:59:59 no fuso do Brasil,
        // convertendo para o UTC equivalente (+3 horas).
        const [yearInicio, monthInicio, dayInicio] = dataInicial.split('-').map(Number)
        const [yearFim, monthFim, dayFim] = dataFinal.split('-').map(Number)

        const startDate = new Date(Date.UTC(yearInicio, monthInicio - 1, dayInicio, 3, 0, 0, 0))
        const endDate = new Date(Date.UTC(yearFim, monthFim - 1, dayFim, 26, 59, 59, 999))

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
                itens: {
                    include: {
                        produto: {
                            select: { id: true, nome: true, codigo: true, unidade: true },
                        },
                    },
                },
            },
            orderBy: { data: 'asc' },
        })

        // Calculate aggregates — separate faturado vs bonificado volumes
        let volumeFaturadoCaixas = 0
        let volumeBonificadoCaixas = 0
        let valorRealFaturado = 0
        let valorTotalBonificado = 0

        const pedidosFormatados = pedidos.map(p => {
            const volCaixas = p.itens.reduce((acc, item) => acc + item.quantidade, 0)
            const valor = Number(p.valorTotal)
            const isBonificacao = p.tipo === 'Bonificacao' || valor === 0

            if (isBonificacao) {
                volumeBonificadoCaixas += volCaixas
                // Sum table price from items to capture the real value of bonificação
                const valorTabelaBonif = p.itens.reduce((acc, item) => acc + Number(item.total), 0)
                valorTotalBonificado += valorTabelaBonif
            } else {
                volumeFaturadoCaixas += volCaixas
                valorRealFaturado += valor
            }

            return {
                id: p.id,
                data: p.data.toISOString(),
                numeroPedido: p.notaFiscal || p.id.slice(-6).toUpperCase(),
                notaFiscal: p.notaFiscal || '-',
                volumeCaixas: volCaixas,
                valorFaturado: valor,
                isBonificacao,
                itens: p.itens.map(item => ({
                    id: item.id,
                    produtoNome: item.produto?.nome || 'Produto',
                    produtoCodigo: item.produto?.codigo || '',
                    unidade: item.produto?.unidade || 'CX',
                    quantidade: item.quantidade,
                    precoUnitario: Number(item.precoUnitario),
                    total: Number(item.total),
                })),
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
                totalPedidos: pedidos.length,
                volumeFaturadoCaixas,
                volumeBonificadoCaixas,
                valorTotalFaturado: valorRealFaturado,
                valorTotalBonificado,
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
