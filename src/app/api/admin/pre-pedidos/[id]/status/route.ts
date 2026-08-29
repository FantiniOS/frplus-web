import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

async function getAuthAdmin() {
    const token = cookies().get('auth_token')?.value
    if (!token) return null
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any
        if (payload.role !== 'admin' && payload.role !== 'ADMIN') {
            return null
        }
        return payload
    } catch {
        return null
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const admin = await getAuthAdmin()
        if (!admin) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const { status } = await request.json()
        if (!status) {
            return NextResponse.json({ error: 'Status obrigatório' }, { status: 400 })
        }

        const prePedidoAtualizado = await prisma.prePedido.update({
            where: { id: params.id },
            data: { status }
        })

        return NextResponse.json({ success: true, prePedido: prePedidoAtualizado })
    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error)
        return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
    }
}
