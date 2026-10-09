import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

async function getAuthUser() {
    const token = cookies().get('auth_token')?.value
    if (!token) return null
    try {
        return jwt.verify(token, JWT_SECRET) as any
    } catch {
        return null
    }
}

// GET /api/marcas-concorrentes - Lista fechada de concorrentes (Admin + Vendedor)
export async function GET() {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const marcas = await prisma.marcaConcorrente.findMany({
            orderBy: { nome: 'asc' },
            include: { _count: { select: { centralPrecos: true } } }
        })

        return NextResponse.json({ marcas })
    } catch (error) {
        console.error('Erro ao buscar marcas concorrentes:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}

// POST /api/marcas-concorrentes - Cadastro de concorrente (somente Admin)
export async function POST(request: Request) {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }
        if (String(user.role || '').toUpperCase() === 'VENDEDOR') {
            return NextResponse.json({ error: 'Apenas administradores podem cadastrar marcas' }, { status: 403 })
        }

        const body = await request.json()
        const nome = String(body?.nome || '').trim().replace(/\s+/g, ' ')

        if (!nome) {
            return NextResponse.json({ error: 'Nome da marca é obrigatório' }, { status: 400 })
        }

        // Evita duplicidade ignorando maiúsculas/minúsculas
        const existente = await prisma.marcaConcorrente.findFirst({
            where: { nome: { equals: nome, mode: 'insensitive' } }
        })
        if (existente) {
            return NextResponse.json({ error: `A marca "${existente.nome}" já está cadastrada` }, { status: 409 })
        }

        const marca = await prisma.marcaConcorrente.create({ data: { nome } })
        return NextResponse.json({ marca }, { status: 201 })
    } catch (error) {
        console.error('Erro ao cadastrar marca concorrente:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
