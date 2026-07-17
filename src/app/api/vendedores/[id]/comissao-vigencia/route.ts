import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
    params: { id: string }
}

export const dynamic = 'force-dynamic'

// GET /api/vendedores/[id]/comissao-vigencia — List all vigências for a vendedor
export async function GET(request: Request, { params }: Params) {
    try {
        const vigencias = await prisma.comissaoVigencia.findMany({
            where: { vendedorId: params.id },
            orderBy: { dataInicio: 'desc' },
        })

        return NextResponse.json(vigencias)
    } catch (error) {
        console.error('Error fetching vigencias:', error)
        return NextResponse.json({ error: 'Failed to fetch vigencias' }, { status: 500 })
    }
}

// POST /api/vendedores/[id]/comissao-vigencia — Create a new vigência
export async function POST(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        const { percentual, dataInicio } = body

        if (percentual === undefined || percentual === null || isNaN(Number(percentual))) {
            return NextResponse.json(
                { error: 'Percentual é obrigatório e deve ser um número' },
                { status: 400 }
            )
        }

        if (!dataInicio) {
            return NextResponse.json(
                { error: 'Data de início é obrigatória' },
                { status: 400 }
            )
        }

        // Check vendedor exists
        const vendedor = await prisma.vendedor.findUnique({
            where: { id: params.id },
        })

        if (!vendedor) {
            return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 })
        }

        const parsedDate = new Date(dataInicio)
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: 'Data de início inválida' }, { status: 400 })
        }

        // Create the vigência
        const vigencia = await prisma.comissaoVigencia.create({
            data: {
                vendedorId: params.id,
                percentual: Number(percentual),
                dataInicio: parsedDate,
            },
        })



        return NextResponse.json(vigencia, { status: 201 })
    } catch (error) {
        console.error('Error creating vigencia:', error)
        return NextResponse.json({ error: 'Failed to create vigencia' }, { status: 500 })
    }
}

// DELETE /api/vendedores/[id]/comissao-vigencia?vigenciaId=xxx — Delete a vigência
export async function DELETE(request: Request, { params }: Params) {
    try {
        const { searchParams } = new URL(request.url)
        const vigenciaId = searchParams.get('vigenciaId')

        if (!vigenciaId) {
            return NextResponse.json(
                { error: 'vigenciaId é obrigatório' },
                { status: 400 }
            )
        }

        // Verify the vigência belongs to this vendedor
        const vigencia = await prisma.comissaoVigencia.findFirst({
            where: {
                id: vigenciaId,
                vendedorId: params.id,
            },
        })

        if (!vigencia) {
            return NextResponse.json(
                { error: 'Vigência não encontrada para este vendedor' },
                { status: 404 }
            )
        }

        await prisma.comissaoVigencia.delete({
            where: { id: vigenciaId },
        })



        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting vigencia:', error)
        return NextResponse.json({ error: 'Failed to delete vigencia' }, { status: 500 })
    }
}
