import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

// POST /api/auth/login - Login do usuário
export async function POST(request: Request) {
    try {
        const { identifier, senha } = await request.json()

        if (!identifier || !senha) {
            return NextResponse.json(
                { error: 'Usuário e senha são obrigatórios' },
                { status: 400 }
            )
        }

        // Buscar usuário pelo username ou email (case insensitive)
        const usuario = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { username: { equals: identifier, mode: 'insensitive' } },
                    { email: { equals: identifier, mode: 'insensitive' } }
                ]
            }
        })

        if (!usuario) {
            return NextResponse.json(
                { error: 'Credenciais inválidas' },
                { status: 401 }
            )
        }

        // Verificar se está ativo
        if (!usuario.ativo) {
            return NextResponse.json(
                { error: 'Usuário desativado. Contate o administrador.' },
                { status: 401 }
            )
        }

        // Verificar senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha)

        if (!senhaValida) {
            return NextResponse.json(
                { error: 'Credenciais inválidas' },
                { status: 401 }
            )
        }

        // Gerar token JWT
        const token = jwt.sign(
            {
                id: usuario.id,
                username: usuario.username,
                nome: usuario.nome,
                role: usuario.role
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        // Retornar usuário (sem senha) e token
        const response = NextResponse.json({
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                username: usuario.username,
                email: usuario.email,
                role: usuario.role
            },
            token
        })

        // Set cookie
        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 dias
        })

        return response
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
    }
}
