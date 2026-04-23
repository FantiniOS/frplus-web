import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/relatorios/comissoes - Commission report with filters
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const vendedorId = searchParams.get('vendedorId')
        const dataInicio = searchParams.get('dataInicio')
        const dataFim = searchParams.get('dataFim')

        const whereClause: any = {
            status: { in: ['Concluido', 'Faturado'] },
            tipo: 'Venda',
        }

        if (vendedorId && vendedorId !== 'todos') {
            whereClause.cliente = {
                vendedorId: vendedorId
            }
        } else {
            // Show orders where the client currently has a assigned Vendedor
            whereClause.cliente = {
                vendedorId: { not: null }
            }
        }

        // Date filters
        if (dataInicio || dataFim) {
            whereClause.data = {}
            if (dataInicio) {
                whereClause.data.gte = new Date(dataInicio + 'T00:00:00Z')
            }
            if (dataFim) {
                whereClause.data.lte = new Date(dataFim + 'T23:59:59Z')
            }
        }

        console.log('[Comissoes API] whereClause:', JSON.stringify(whereClause, null, 2))

        // Pre-fetch all vendedores for fallback commission calculation
        const allVendedores = await prisma.vendedor.findMany({
            select: { id: true, nome: true, percentualComissao: true }
        })
        const vendedorByName = new Map(
            allVendedores.map(v => [v.nome.trim().toLowerCase(), v])
        )
        const vendedorById = new Map(
            allVendedores.map(v => [v.id, v])
        )

        const pedidos = await prisma.pedido.findMany({
            where: whereClause,
            orderBy: { data: 'desc' },
            select: {
                id: true,
                data: true,
                valorTotal: true,
                valorComissao: true,
                vendedorId: true,
                nomeVendedorImport: true,
                notaFiscal: true,
                vendedor: {
                    select: {
                        id: true,
                        nome: true,
                        percentualComissao: true,
                    }
                },
                cliente: {
                    select: {
                        id: true,
                        nomeFantasia: true,
                        razaoSocial: true,
                        vendedor: {
                            select: {
                                id: true,
                                nome: true,
                                percentualComissao: true,
                            }
                        }
                    }
                }
            }
        })

        console.log(`[Comissoes API] ${pedidos.length} pedidos encontrados`)

        // Calculate totals
        let totalVendido = 0
        let totalComissoes = 0

        const detalhamento = pedidos.map(p => {
            const valorVenda = Number(p.valorTotal) || 0

            // Dynamic commission calculation (Real-time based on client's current Vendedor)
            // Ignores the frozen p.valorComissao from the database
            let comissao = 0
            let vendedorNome = 'N/A'

            if (p.cliente?.vendedor?.percentualComissao) {
                comissao = valorVenda * (Number(p.cliente.vendedor.percentualComissao) / 100)
            } else if (p.vendedor?.percentualComissao) {
                comissao = valorVenda * (Number(p.vendedor.percentualComissao) / 100)
            } else if (p.nomeVendedorImport) {
                const matched = vendedorByName.get(p.nomeVendedorImport.trim().toLowerCase())
                if (matched) {
                    comissao = valorVenda * (Number(matched.percentualComissao) / 100)
                }
            }

            // Resolve vendedor name based on CURRENT client assignment
            if (p.cliente?.vendedor) {
                vendedorNome = p.cliente.vendedor.nome
            } else if (p.vendedor) {
                vendedorNome = p.vendedor.nome
            } else if (p.nomeVendedorImport) {
                vendedorNome = p.nomeVendedorImport
            }

            totalVendido += valorVenda
            totalComissoes += comissao

            return {
                id: p.id,
                data: p.data,
                clienteNome: p.cliente?.nomeFantasia || p.cliente?.razaoSocial || 'N/A',
                vendedorNome,
                valorVenda,
                valorComissao: comissao,
                notaFiscal: p.notaFiscal,
            }
        })

        console.log(`[Comissoes API] totalVendido: ${totalVendido}, totalComissoes: ${totalComissoes}`)

        return NextResponse.json({
            totalVendido,
            totalComissoes,
            totalPedidos: detalhamento.length,
            detalhamento,
        })
    } catch (error) {
        console.error('Error fetching commission report:', error)
        return NextResponse.json({ error: 'Failed to fetch commission report' }, { status: 500 })
    }
}
