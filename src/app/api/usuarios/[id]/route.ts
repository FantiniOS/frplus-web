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

interface RouteParams {
    params: { id: string }
}

// GET /api/usuarios/[id] - Get single user
export async function GET(_request: Request, { params }: RouteParams) {
    const { isAdmin } = await verifyAdmin()

    if (!isAdmin) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: params.id },
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

        if (!usuario) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        return NextResponse.json(usuario)
    } catch (error) {
        console.error('Error fetching user:', error)
        return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }
}

// PUT /api/usuarios/[id] - Update user
export async function PUT(request: Request, { params }: RouteParams) {
    const { isAdmin, userId } = await verifyAdmin()

    if (!isAdmin) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
        const { nome, username, email, senha, role, ativo } = await request.json()

        // Prevent admin from deactivating themselves
        if (params.id === userId && ativo === false) {
            return NextResponse.json(
                { error: 'Você não pode desativar sua própria conta' },
                { status: 400 }
            )
        }

        const updateData: Record<string, unknown> = {}

        if (nome) updateData.nome = nome
        if (email !== undefined) updateData.email = email ? email.toLowerCase() : null
        if (role) updateData.role = role
        if (typeof ativo === 'boolean') updateData.ativo = ativo

        // Handle username update
        if (username) {
            // Check uniqueness if changed
            const existingUser = await prisma.usuario.findUnique({
                where: { username }
            })

            if (existingUser && existingUser.id !== params.id) {
                return NextResponse.json(
                    { error: 'Nome de usuário já está em uso' },
                    { status: 400 }
                )
            }
            updateData.username = username
        }

        // Hash new password if provided
        if (senha) {
            updateData.senha = await bcrypt.hash(senha, 10)
        }

        const usuario = await prisma.usuario.update({
            where: { id: params.id },
            data: updateData,
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

        return NextResponse.json(usuario)
    } catch (error) {
        console.error('Error updating user:', error)
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }
}

// DELETE /api/usuarios/[id] - Delete user
export async function DELETE(_request: Request, { params }: RouteParams) {
    const { isAdmin, userId } = await verifyAdmin()

    if (!isAdmin) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Prevent admin from deleting themselves
    if (params.id === userId) {
        return NextResponse.json(
            { error: 'Você não pode excluir sua própria conta' },
            { status: 400 }
        )
    }

    try {
        await prisma.usuario.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ message: 'Usuário excluído' })
    } catch (error) {
        console.error('Error deleting user:', error)
        return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
    }
}
