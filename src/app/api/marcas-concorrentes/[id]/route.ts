import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// PUT /api/marcas-concorrentes/[id] - Editar marca
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin pode editar marcas' }, { status: 403 })

        const id = params.id
        const body = await request.json()
        const { nome } = body

        if (!nome || !nome.trim()) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
        }

        const marca = await prisma.marcaConcorrente.update({
            where: { id },
            data: { nome: nome.trim() }
        })

        return NextResponse.json({ marca })
    } catch (error: any) {
        console.error('Error updating marca:', error)
        return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
    }
}

// DELETE /api/marcas-concorrentes/[id] - Excluir marca
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin pode excluir marcas' }, { status: 403 })

        const id = params.id

        await prisma.marcaConcorrente.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting marca:', error)
        if (error?.code === 'P2003') {
            return NextResponse.json({ error: 'Não é possível excluir esta marca pois existem coletas cadastradas com ela.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Erro ao excluir marca' }, { status: 500 })
    }
}
