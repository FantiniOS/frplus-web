import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/fabricas - List all factories
export async function GET() {
    try {
        const fabricas = await prisma.fabrica.findMany({
            orderBy: { nome: 'asc' },
            include: {
                _count: {
                    select: { produtos: true }
                }
            }
        })

        const formattedFabricas = fabricas.map(f => ({
            id: f.id,
            nome: f.nome,
            produtosCount: f._count.produtos
        }))

        return NextResponse.json(formattedFabricas)
    } catch (error) {
        console.error('Error fetching factories:', error)
        return NextResponse.json({ error: 'Failed to fetch factories' }, { status: 500 })
    }
}

// POST /api/fabricas - Create a new factory
export async function POST(request: Request) {
    try {
        const body = await request.json()

        const fabrica = await prisma.fabrica.create({
            data: {
                nome: body.nome
            }
        })

        return NextResponse.json(fabrica, { status: 201 })
    } catch (error) {
        console.error('Error creating factory:', error)
        return NextResponse.json({ error: 'Failed to create factory' }, { status: 500 })
    }
}
