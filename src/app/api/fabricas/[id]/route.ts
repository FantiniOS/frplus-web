import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
    params: { id: string }
}

// GET /api/fabricas/[id] - Get single factory
export async function GET(request: Request, { params }: Params) {
    try {
        const fabrica = await prisma.fabrica.findUnique({
            where: { id: params.id },
            include: { produtos: true }
        })

        if (!fabrica) {
            return NextResponse.json({ error: 'Factory not found' }, { status: 404 })
        }

        return NextResponse.json(fabrica)
    } catch (error) {
        console.error('Error fetching factory:', error)
        return NextResponse.json({ error: 'Failed to fetch factory' }, { status: 500 })
    }
}

// PUT /api/fabricas/[id] - Update factory
export async function PUT(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        const fabrica = await prisma.fabrica.update({
            where: { id: params.id },
            data: { nome: body.nome }
        })

        return NextResponse.json(fabrica)
    } catch (error) {
        console.error('Error updating factory:', error)
        return NextResponse.json({ error: 'Failed to update factory' }, { status: 500 })
    }
}

// DELETE /api/fabricas/[id] - Delete factory
export async function DELETE(request: Request, { params }: Params) {
    try {
        await prisma.fabrica.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting factory:', error)
        return NextResponse.json({ error: 'Failed to delete factory' }, { status: 500 })
    }
}
