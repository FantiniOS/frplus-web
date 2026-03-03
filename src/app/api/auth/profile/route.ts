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
        const { nomeEmpresa, taxaComissao } = body

        const data: Record<string, any> = {}

        if (nomeEmpresa !== undefined) {
            if (typeof nomeEmpresa !== 'string' || nomeEmpresa.trim() === '') {
                return NextResponse.json({ error: 'Nome da empresa inválido' }, { status: 400 })
            }
            data.empresa = nomeEmpresa.trim()
        }

        if (taxaComissao !== undefined) {
            const parsed = parseFloat(taxaComissao)
            if (isNaN(parsed) || parsed < 0 || parsed > 100) {
                return NextResponse.json({ error: 'Taxa de comissão inválida (0-100)' }, { status: 400 })
            }
            data.taxaComissao = parsed
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
        }

        const updatedUser = await prisma.usuario.update({
            where: { id: user.id },
            data
        })

        return NextResponse.json({
            success: true,
            empresa: updatedUser.empresa,
            taxaComissao: updatedUser.taxaComissao
        })
    } catch (error) {
        console.error('Error updating profile:', error)
        return NextResponse.json({ error: 'Erro ao atualizar o perfil' }, { status: 500 })
    }
}
