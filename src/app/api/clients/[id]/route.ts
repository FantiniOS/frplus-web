import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
    params: { id: string }
}

// GET /api/clients/[id] - Get single client
export async function GET(request: Request, { params }: Params) {
    try {
        const client = await prisma.cliente.findUnique({
            where: { id: params.id },
            include: {
                pedidos: {
                    orderBy: { data: 'desc' },
                    take: 1,
                    select: { data: true }
                }
            }
        })

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...client,
            ultima_compra: client.pedidos[0]?.data || null,
            pedidos: undefined
        })
    } catch (error) {
        console.error('Error fetching client:', error)
        return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
    }
}

// PUT /api/clients/[id] - Update client
export async function PUT(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        const client = await prisma.cliente.update({
            where: { id: params.id },
            data: {
                razaoSocial: body.razaoSocial,
                nomeFantasia: body.nomeFantasia,
                cnpj: body.cnpj,
                inscricaoEstadual: body.inscricaoEstadual,
                email: body.email,
                telefone: body.telefone,
                celular: body.celular,
                endereco: body.endereco,
                bairro: body.bairro,
                cidade: body.cidade,
                estado: body.estado,
                cep: body.cep
            },
            include: {
                pedidos: {
                    orderBy: { data: 'desc' },
                    take: 1,
                    select: { data: true }
                }
            }
        })

        return NextResponse.json({
            ...client,
            ultima_compra: client.pedidos[0]?.data || null,
            pedidos: undefined
        })
    } catch (error) {
        console.error('Error updating client:', error)
        return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
    }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(request: Request, { params }: Params) {
    try {
        await prisma.cliente.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting client:', error)
        return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
    }
}
