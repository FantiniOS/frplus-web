import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

// Helper to verify admin role
async function verifyAdmin(): Promise<{ isAdmin: boolean; userId?: string }> {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) return { isAdmin: false }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string }
        return { isAdmin: decoded.role === 'admin', userId: decoded.id }
    } catch {
        return { isAdmin: false }
    }
}

// GET /api/usuarios - List all users (admin only)
export async function GET() {
    const { isAdmin } = await verifyAdmin()

    if (!isAdmin) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
        const usuarios = await prisma.usuario.findMany({
            select: {
                id: true,
                nome: true,
                username: true,
                email: true,
                role: true,
                ativo: true,
                createdAt: true
            },
            orderBy: { nome: 'asc' }
        })

        return NextResponse.json(usuarios)
    } catch (error) {
        console.error('Error fetching users:', error)
        return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }
}

// POST /api/usuarios - Create user (admin only)
export async function POST(request: Request) {
    const { isAdmin } = await verifyAdmin()

    if (!isAdmin) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
        const { nome, username, email, senha, role } = await request.json()

        if (!nome || !username || !senha) {
            return NextResponse.json(
                { error: 'Nome, usuário e senha são obrigatórios' },
                { status: 400 }
            )
        }

        // Check if username already exists
        const existingUser = await prisma.usuario.findUnique({
            where: { username }
        })

        if (existingUser) {
            return NextResponse.json({ error: 'Nome de usuário já cadastrado' }, { status: 400 })
        }

        // Hash password
        const senhaHash = await bcrypt.hash(senha, 10)

        const usuario = await prisma.usuario.create({
            data: {
                nome,
                username,
                email: email ? email.toLowerCase() : null,
                senha: senhaHash,
                role: role || 'vendedor'
            },
            select: {
                id: true,
                nome: true,
                username: true,
                email: true,
                role: true,
                ativo: true,
                createdAt: true
            }
        })

        return NextResponse.json(usuario, { status: 201 })
    } catch (error) {
        console.error('Error creating user:', error)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }
}
