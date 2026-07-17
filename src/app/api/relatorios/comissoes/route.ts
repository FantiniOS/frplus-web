import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Given a list of vigências for a vendedor (sorted by dataInicio DESC)
 * and a pedido date, returns the applicable commission percentage.
 * Falls back to the vendedor's default percentualComissao if no vigência applies.
 */
function getPercentualVigente(
    vigencias: { dataInicio: Date; percentual: number }[],
    dataPedido: Date,
    percentualPadrao: number
): number {
    // vigencias are already sorted DESC by dataInicio
    for (const v of vigencias) {
        if (v.dataInicio <= dataPedido) {
            return v.percentual
        }
    }
    // No vigência applies — use fallback
    return percentualPadrao
}

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

        // Pre-fetch all vendedores with their vigências for commission lookup
        const allVendedores = await prisma.vendedor.findMany({
            select: {
                id: true,
                nome: true,
                percentualComissao: true,
                taxaRetencaoIR: true,
                taxaRetencaoISSQN: true,
                comissaoVigencias: {
                    orderBy: { dataInicio: 'desc' },
                    select: { dataInicio: true, percentual: true },
                },
            }
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
        let totalDescontoIR = 0
        let totalDescontoISSQN = 0

        const detalhamento = pedidos.map(p => {
            const valorVenda = Number(p.valorTotal) || 0
            const dataPedido = new Date(p.data)

            // Dynamic commission calculation using vigência (rate history)
            let comissao = 0
            let vendedorNome = 'N/A'
            let percentualAplicado = 0

            // Resolve the vendedor (prefer client's current vendedor, then order's vendedor, then imported name)
            let resolvedVendedor: typeof allVendedores[0] | undefined = undefined

            if (p.cliente?.vendedor) {
                resolvedVendedor = vendedorById.get(p.cliente.vendedor.id)
                vendedorNome = p.cliente.vendedor.nome
            } else if (p.vendedor) {
                resolvedVendedor = vendedorById.get(p.vendedor.id)
                vendedorNome = p.vendedor.nome
            } else if (p.nomeVendedorImport) {
                resolvedVendedor = vendedorByName.get(p.nomeVendedorImport.trim().toLowerCase())
                vendedorNome = p.nomeVendedorImport
            }

            if (resolvedVendedor) {
                // Use vigência-based lookup: find the rate active at the pedido's date
                percentualAplicado = getPercentualVigente(
                    resolvedVendedor.comissaoVigencias,
                    dataPedido,
                    Number(resolvedVendedor.percentualComissao) || 0
                )
                comissao = valorVenda * (percentualAplicado / 100)
                
                const ir = comissao * (Number(resolvedVendedor.taxaRetencaoIR) / 100)
                const issqn = comissao * (Number(resolvedVendedor.taxaRetencaoISSQN) / 100)
                
                totalDescontoIR += ir
                totalDescontoISSQN += issqn
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
                percentualAplicado,
                notaFiscal: p.notaFiscal,
            }
        })

        console.log(`[Comissoes API] totalVendido: ${totalVendido}, totalComissoes: ${totalComissoes}`)

        const totalLiquido = totalComissoes - totalDescontoIR - totalDescontoISSQN

        return NextResponse.json({
            totalVendido,
            totalComissoes,
            totalDescontoIR,
            totalDescontoISSQN,
            totalLiquido,
            totalPedidos: detalhamento.length,
            detalhamento,
        })
    } catch (error) {
        console.error('Error fetching commission report:', error)
        return NextResponse.json({ error: 'Failed to fetch commission report' }, { status: 500 })
    }
}
