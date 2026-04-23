import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/vendedores/diagnostico - Debug endpoint to check order data
export async function GET() {
    try {
        // Count total orders
        const totalPedidos = await prisma.pedido.count()

        // Count orders with vendedorId
        const comVendedorId = await prisma.pedido.count({
            where: { vendedorId: { not: null } }
        })

        // Count orders with nomeVendedorImport
        const comNomeVendedor = await prisma.pedido.count({
            where: { nomeVendedorImport: { not: null } }
        })

        // Count orders with valorComissao
        const comValorComissao = await prisma.pedido.count({
            where: { valorComissao: { not: null } }
        })

        // Get distinct vendedor names from orders
        const distinctNames = await prisma.pedido.findMany({
            where: { nomeVendedorImport: { not: null } },
            select: { nomeVendedorImport: true },
            distinct: ['nomeVendedorImport'],
        })

        // Get vendedores cadastrados
        const vendedoresCadastrados = await prisma.vendedor.findMany({
            select: { id: true, nome: true, percentualComissao: true, ativo: true }
        })

        // Sample 5 orders to check field values
        const samplePedidos = await prisma.pedido.findMany({
            take: 5,
            orderBy: { data: 'desc' },
            select: {
                id: true,
                valorTotal: true,
                valorComissao: true,
                vendedorId: true,
                nomeVendedorImport: true,
                tipo: true,
                status: true,
            }
        })

        return NextResponse.json({
            totalPedidos,
            comVendedorId,
            comNomeVendedor,
            comValorComissao,
            semNenhumVendedor: totalPedidos - comNomeVendedor,
            nomesDeVendedoresNosCSVs: distinctNames.map(d => d.nomeVendedorImport),
            vendedoresCadastrados: vendedoresCadastrados.map(v => ({
                nome: v.nome,
                comissao: `${Number(v.percentualComissao)}%`,
                ativo: v.ativo,
            })),
            amostraPedidos: samplePedidos,
        })
    } catch (error) {
        console.error('[Diagnostico] Error:', error)
        return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
}
