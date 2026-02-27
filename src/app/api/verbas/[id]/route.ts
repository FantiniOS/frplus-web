import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/verbas/[id] - Get verba details with linked pedidos
export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const verba = await prisma.verba.findUnique({
            where: { id: params.id },
            include: {
                cliente: {
                    select: { id: true, nomeFantasia: true, razaoSocial: true }
                },
                pedidos: {
                    select: {
                        id: true,
                        data: true,
                        valorTotal: true,
                        tipo: true,
                        condicaoPagamento: true,
                        observacoes: true,
                        notaFiscal: true
                    },
                    orderBy: { data: 'desc' }
                }
            }
        })

        if (!verba) {
            return NextResponse.json({ error: 'Verba não encontrada' }, { status: 404 })
        }

        const consumido = verba.pedidos.reduce((acc, p) => acc + Number(p.valorTotal), 0)
        const saldo = Number(verba.valorTotal) - consumido

        return NextResponse.json({
            id: verba.id,
            clienteId: verba.clienteId,
            clienteNome: verba.cliente.nomeFantasia || verba.cliente.razaoSocial,
            titulo: verba.titulo,
            valorTotal: Number(verba.valorTotal),
            consumido,
            saldo,
            status: verba.status,
            createdAt: verba.createdAt.toISOString(),
            pedidos: verba.pedidos.map(p => ({
                id: p.id,
                data: new Date(p.data).toISOString(),
                valorTotal: Number(p.valorTotal),
                tipo: p.tipo,
                condicaoPagamento: p.condicaoPagamento,
                observacoes: p.observacoes,
                notaFiscal: p.notaFiscal
            }))
        })
    } catch (error) {
        console.error('Error fetching verba:', error)
        return NextResponse.json({ error: 'Failed to fetch verba' }, { status: 500 })
    }
}

// PATCH /api/verbas/[id] - Update verba (titulo, valorTotal, status)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json()
        const { status, titulo, valorTotal } = body

        const updateData: Record<string, unknown> = {}

        if (status) {
            if (!['ATIVA', 'ESGOTADA', 'CANCELADA'].includes(status)) {
                return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
            }
            updateData.status = status
        }

        if (titulo) updateData.titulo = titulo
        if (valorTotal !== undefined && valorTotal !== null) updateData.valorTotal = Number(valorTotal)

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
        }

        const verba = await prisma.verba.update({
            where: { id: params.id },
            data: updateData
        })

        return NextResponse.json(verba)
    } catch (error) {
        console.error('Error updating verba:', error)
        return NextResponse.json({ error: 'Failed to update verba' }, { status: 500 })
    }
}

// DELETE /api/verbas/[id] - Delete verba (unlink pedidos first)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        // Unlink all pedidos first
        await prisma.pedido.updateMany({
            where: { verbaId: params.id },
            data: { verbaId: null }
        })

        await prisma.verba.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting verba:', error)
        return NextResponse.json({ error: 'Failed to delete verba' }, { status: 500 })
    }
}
