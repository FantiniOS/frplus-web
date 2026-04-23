import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/vendedores/backfill - Retroactively link vendedores to orders and calculate commissions
// Strategy: For each cliente that has a vendedorId, propagate it to all their orders
export async function POST() {
    try {
        // 1. Fetch all vendedores with their percentual
        const vendedores = await prisma.vendedor.findMany({
            select: { id: true, nome: true, percentualComissao: true }
        })

        if (vendedores.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum vendedor cadastrado. Cadastre vendedores primeiro.'
            }, { status: 400 })
        }

        const vendedorById = new Map(
            vendedores.map(v => [v.id, v])
        )

        console.log(`[Backfill] ${vendedores.length} vendedores:`, vendedores.map(v => `${v.nome} (${v.percentualComissao}%)`))

        // 2. Find all clients that have a vendedorId assigned
        const clientesComVendedor = await prisma.cliente.findMany({
            where: { vendedorId: { not: null } },
            select: { id: true, vendedorId: true, nomeFantasia: true }
        })

        console.log(`[Backfill] ${clientesComVendedor.length} clientes com vendedor vinculado`)

        let linkedByCliente = 0
        let commissionCalculated = 0
        let alreadyLinked = 0
        const errors: string[] = []

        // 3. For each client with vendedor, update ALL their orders
        for (const cliente of clientesComVendedor) {
            const vendedor = vendedorById.get(cliente.vendedorId!)
            if (!vendedor) continue

            const percentual = Number(vendedor.percentualComissao) || 0

            // Get orders for this client that don't have vendedorId yet
            const pedidos = await prisma.pedido.findMany({
                where: {
                    clienteId: cliente.id,
                    vendedorId: null,
                    tipo: 'Venda',
                },
                select: { id: true, valorTotal: true }
            })

            for (const pedido of pedidos) {
                const valorTotal = Number(pedido.valorTotal) || 0
                const comissao = valorTotal * (percentual / 100)

                try {
                    await prisma.pedido.update({
                        where: { id: pedido.id },
                        data: {
                            vendedorId: vendedor.id,
                            valorComissao: comissao,
                            nomeVendedorImport: vendedor.nome,
                        }
                    })
                    linkedByCliente++
                } catch (e) {
                    errors.push(`Pedido ${pedido.id}: ${(e as Error).message}`)
                }
            }

            console.log(`[Backfill] Cliente "${cliente.nomeFantasia}": ${pedidos.length} pedidos vinculados ao vendedor "${vendedor.nome}"`)
        }

        // 4. Also fill commission for orders that already have vendedorId but no valorComissao
        const pedidosSemComissao = await prisma.pedido.findMany({
            where: {
                vendedorId: { not: null },
                valorComissao: null,
                tipo: 'Venda',
            },
            select: {
                id: true,
                valorTotal: true,
                vendedorId: true,
            }
        })

        for (const pedido of pedidosSemComissao) {
            const vendedor = vendedorById.get(pedido.vendedorId!)
            if (!vendedor) continue

            const valorTotal = Number(pedido.valorTotal) || 0
            const percentual = Number(vendedor.percentualComissao) || 0
            const comissao = valorTotal * (percentual / 100)

            try {
                await prisma.pedido.update({
                    where: { id: pedido.id },
                    data: { valorComissao: comissao }
                })
                commissionCalculated++
            } catch (e) {
                errors.push(`Comissão pedido ${pedido.id}: ${(e as Error).message}`)
            }
        }

        // 5. Count how many orders already had vendedorId
        alreadyLinked = await prisma.pedido.count({
            where: { vendedorId: { not: null } }
        })

        // 6. Count total orders without vendedor
        const totalSemVendedor = await prisma.pedido.count({
            where: { vendedorId: null, tipo: 'Venda' }
        })

        const result = {
            success: true,
            stats: {
                vendedoresCadastrados: vendedores.length,
                clientesComVendedor: clientesComVendedor.length,
                pedidosVinculadosAgora: linkedByCliente,
                comissoesCalculadas: commissionCalculated,
                totalPedidosComVendedor: alreadyLinked,
                totalPedidosSemVendedor: totalSemVendedor,
                erros: errors,
            },
            instrucao: totalSemVendedor > 0
                ? `Ainda existem ${totalSemVendedor} pedidos sem vendedor. Vincule o vendedor responsável nos cadastros dos clientes e rode o backfill novamente.`
                : 'Todos os pedidos de venda estão com vendedor vinculado!'
        }

        console.log('[Backfill] Resultado:', JSON.stringify(result, null, 2))
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Backfill] Error:', error)
        return NextResponse.json({ error: 'Backfill failed', details: (error as Error).message }, { status: 500 })
    }
}
