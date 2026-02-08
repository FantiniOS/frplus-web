import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/clients - List all clients
export async function GET() {
    try {
        const clients = await prisma.cliente.findMany({
            orderBy: { nomeFantasia: 'asc' }
        })

        return NextResponse.json(clients)
    } catch (error) {
        console.error('Error fetching clients:', error)
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }
}

// POST /api/clients - Create a new client
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Validate required fields
        if (!body.razaoSocial && !body.nomeFantasia) {
            return NextResponse.json(
                { error: 'Razão Social ou Nome Fantasia é obrigatório' },
                { status: 400 }
            )
        }

        if (!body.cnpj) {
            return NextResponse.json(
                { error: 'CNPJ é obrigatório' },
                { status: 400 }
            )
        }

        const client = await prisma.cliente.create({
            data: {
                razaoSocial: body.razaoSocial || body.nomeFantasia || 'Não informado',
                nomeFantasia: body.nomeFantasia || body.razaoSocial || 'Não informado',
                cnpj: body.cnpj,
                inscricaoEstadual: body.inscricaoEstadual || '',
                email: body.email || '',
                telefone: body.telefone || '',
                celular: body.celular || '',
                endereco: body.endereco || '',
                bairro: body.bairro || '',
                cidade: body.cidade || '',
                estado: body.estado || '',
                cep: body.cep || ''
            }
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error) {
        console.error('Error creating client:', error)
        return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }
}
