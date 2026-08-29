import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

// GET /api/auth/me - Get current user
export async function GET() {
    try {
        const cookieStore = cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // Verificar token
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: string
            email: string
            nome: string
            role: string
            fabricaId: string | null
        }

        // Se for vendedor, busca na tabela de vendedores
        if (decoded.role === 'VENDEDOR' || decoded.role === 'vendedor') {
            const vendedor = await prisma.vendedor.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    nome: true,
                    codigoAcesso: true,
                    email: true,
                    role: true,
                    ativo: true
                }
            })

            if (!vendedor || !vendedor.ativo) {
                return NextResponse.json({ error: 'Vendedor não encontrado ou desativado' }, { status: 401 })
            }

            return NextResponse.json({ 
                usuario: {
                    id: vendedor.id,
                    nome: vendedor.nome,
                    username: vendedor.codigoAcesso,
                    email: vendedor.email,
                    empresa: null,
                    role: vendedor.role || 'VENDEDOR',
                    fabricaId: null
                }
            })
        }

        // Buscar usuário atualizado (Admin, etc)
        const usuario = await prisma.usuario.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                nome: true,
                username: true,
                email: true,
                empresa: true,
                role: true,
                ativo: true,
                fabricaId: true
            }
        })

        if (!usuario || !usuario.ativo) {
            return NextResponse.json({ error: 'Usuário não encontrado ou desativado' }, { status: 401 })
        }

        return NextResponse.json({ usuario })
    } catch (error) {
        console.error('Auth error:', error)
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
}

// DELETE /api/auth/me - Logout
export async function DELETE() {
    const response = NextResponse.json({ message: 'Logout realizado' })
    response.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0
    })
    return response
}
