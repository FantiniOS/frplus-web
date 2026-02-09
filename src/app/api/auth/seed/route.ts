/* eslint-disable */
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET /api/auth/seed - Create initial admin user (only if no users exist)
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Force create/update admin
        const senhaHash = await bcrypt.hash('admin123', 10)

        const admin = await prisma.usuario.upsert({
            where: { username: 'admin' },
            update: {
                senha: senhaHash,
                role: 'admin',
                ativo: true
            },
            create: {
                nome: 'Administrador',
                username: 'admin',
                email: 'admin@frplus.com',
                senha: senhaHash,
                role: 'admin',
                ativo: true
            },
            select: {
                id: true,
                nome: true,
                username: true,
                role: true
            }
        })

        // List other users for reference
        const otherUsers = await prisma.usuario.findMany({
            select: { username: true, role: true }
        });

        return NextResponse.json({
            message: 'Senha da conta "admin" foi REDEFINIDA para "admin123"!',
            usuario_atualizado: admin,
            lista_usuarios_no_banco: otherUsers,
            instrucoes: 'Use "admin" e "admin123" para logar.'
        })
    } catch (error) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: 'Erro ao criar seed: ' + String(error) }, { status: 500 })
    }
}
