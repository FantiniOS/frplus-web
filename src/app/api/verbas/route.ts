import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/verbas - List all verbas with client info and consumed totals
export async function GET() {
    try {
        const verbas = await prisma.verba.findMany({
            include: {
                cliente: {
                    select: { id: true, nomeFantasia: true, razaoSocial: true }
                },
                pedidos: {
                    select: { valorTotal: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        const result = verbas.map(v => {
            const consumido = v.pedidos.reduce((acc, p) => acc + Number(p.valorTotal), 0)
            const saldo = Number(v.valorTotal) - consumido
            return {
                id: v.id,
                clienteId: v.clienteId,
                clienteNome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
                titulo: v.titulo,
                valorTotal: Number(v.valorTotal),
                consumido,
                saldo,
                status: v.status,
                createdAt: v.createdAt.toISOString(),
                totalPedidos: v.pedidos.length
            }
        })

        const summary = {
            total: result.length,
            ativas: result.filter(v => v.status === 'ATIVA').length,
            esgotadas: result.filter(v => v.status === 'ESGOTADA').length,
            canceladas: result.filter(v => v.status === 'CANCELADA').length,
            valorTotalLiberado: result.reduce((acc, v) => acc + v.valorTotal, 0),
            valorTotalConsumido: result.reduce((acc, v) => acc + v.consumido, 0)
        }

        return NextResponse.json({ verbas: result, summary })
    } catch (error) {
        console.error('Error fetching verbas:', error)
        return NextResponse.json({ error: 'Failed to fetch verbas' }, { status: 500 })
    }
}

// POST /api/verbas - Create a new verba
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { clienteId, titulo, valorTotal } = body

        if (!clienteId || !titulo || !valorTotal) {
            return NextResponse.json({ error: 'clienteId, titulo e valorTotal são obrigatórios' }, { status: 400 })
        }

        const verba = await prisma.verba.create({
            data: {
                clienteId,
                titulo,
                valorTotal: Number(valorTotal),
                status: 'ATIVA'
            }
        })

        return NextResponse.json(verba, { status: 201 })
    } catch (error) {
        console.error('Error creating verba:', error)
        return NextResponse.json({ error: 'Failed to create verba' }, { status: 500 })
    }
}
