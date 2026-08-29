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

export async function GET() {
    try {
        const admin = await getAuthAdmin()
        if (!admin) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const count = await prisma.prePedido.count({
            where: {
                status: 'PENDENTE'
            }
        })

        return NextResponse.json({ count })
    } catch (error) {
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
