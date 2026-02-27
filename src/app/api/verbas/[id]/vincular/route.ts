import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/verbas/[id]/vincular - Fetch eligible pedidos for linking
export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const verba = await prisma.verba.findUnique({
            where: { id: params.id },
            select: { clienteId: true }
        })

        if (!verba) {
            return NextResponse.json({ error: 'Verba não encontrada' }, { status: 404 })
        }

        // Only pedidos: same client, type Bonificacao, verbaId is null
        const whereClause: any = {
            clienteId: verba.clienteId,
            tipo: 'Bonificacao',
            verbaId: null
        }
        if (user.role === 'industria' && user.fabricaId) {
            whereClause.fabricaId = user.fabricaId
        }

        const pedidosDisponiveis = await prisma.pedido.findMany({
            where: whereClause,
            select: {
                id: true,
                data: true,
                valorTotal: true,
                condicaoPagamento: true,
                observacoes: true,
                notaFiscal: true
            },
            orderBy: { data: 'desc' }
        })

        return NextResponse.json({
            pedidos: pedidosDisponiveis.map(p => ({
                id: p.id,
                data: new Date(p.data).toISOString(),
                valorTotal: Number(p.valorTotal),
                condicaoPagamento: p.condicaoPagamento,
                observacoes: p.observacoes,
                notaFiscal: p.notaFiscal
            }))
        })
    } catch (error) {
        console.error('Error fetching pedidos disponíveis:', error)
        return NextResponse.json({ error: 'Failed to fetch pedidos' }, { status: 500 })
    }
}

// POST /api/verbas/[id]/vincular - Link pedidos to verba (the isolated server action)
export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()
        const { pedidoIds } = body

        if (!Array.isArray(pedidoIds) || pedidoIds.length === 0) {
            return NextResponse.json({ error: 'pedidoIds é obrigatório e deve ser um array' }, { status: 400 })
        }

        // Verify verba exists
        const verba = await prisma.verba.findUnique({
            where: { id: params.id },
            select: { clienteId: true, status: true }
        })

        if (!verba) {
            return NextResponse.json({ error: 'Verba não encontrada' }, { status: 404 })
        }

        if (verba.status === 'CANCELADA') {
            return NextResponse.json({ error: 'Não é possível vincular pedidos a uma verba cancelada' }, { status: 400 })
        }

        // UPDATE pedidos setting verbaId — the isolated action
        const result = await prisma.pedido.updateMany({
            where: {
                id: { in: pedidoIds },
                clienteId: verba.clienteId,
                tipo: 'Bonificacao',
                verbaId: null
            },
            data: { verbaId: params.id }
        })

        return NextResponse.json({ vinculados: result.count })
    } catch (error) {
        console.error('Error linking pedidos to verba:', error)
        return NextResponse.json({ error: 'Failed to link pedidos' }, { status: 500 })
    }
}
