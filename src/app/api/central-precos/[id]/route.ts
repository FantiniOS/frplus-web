import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// PUT /api/central-precos/[id] - Editar registro de preço
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin pode editar registros' }, { status: 403 })

        const id = params.id
        const body = await request.json()
        const { precoPrateleira, produtoBase, marcaConcorrenteId, clienteId, localNaoCadastrado } = body

        if (!precoPrateleira) {
            return NextResponse.json({ error: 'Preço é obrigatório' }, { status: 400 })
        }

        const precoFloat = parseFloat(String(precoPrateleira).replace(',', '.'))
        if (isNaN(precoFloat) || precoFloat <= 0) {
            return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })
        }

        const dataUpdate: any = { precoPrateleira: precoFloat };
        if (produtoBase) dataUpdate.produtoBase = produtoBase;
        if (marcaConcorrenteId) dataUpdate.marcaConcorrenteId = marcaConcorrenteId;
        if (clienteId !== undefined) dataUpdate.clienteId = clienteId || null;
        if (localNaoCadastrado !== undefined) dataUpdate.localNaoCadastrado = localNaoCadastrado || null;

        const registro = await prisma.centralPrecos.update({
            where: { id },
            data: dataUpdate
        })

        return NextResponse.json({ registro })
    } catch (error) {
        console.error('Error updating central preco:', error)
        return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
    }
}

// DELETE /api/central-precos/[id] - Excluir registro de preço
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin pode excluir registros' }, { status: 403 })

        const id = params.id

        await prisma.centralPrecos.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting central preco:', error)
        return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 })
    }
}
