import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export async function PUT(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { nomeEmpresa } = body

        if (!nomeEmpresa || typeof nomeEmpresa !== 'string' || nomeEmpresa.trim() === '') {
            return NextResponse.json({ error: 'Nome da empresa inválido' }, { status: 400 })
        }

        const updatedUser = await prisma.usuario.update({
            where: { id: user.id },
            data: { empresa: nomeEmpresa.trim() }
        })

        return NextResponse.json({
            success: true,
            empresa: updatedUser.empresa
        })
    } catch (error) {
        console.error('Error updating profile:', error)
        return NextResponse.json({ error: 'Erro ao atualizar o perfil' }, { status: 500 })
    }
}
