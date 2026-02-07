import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST /api/auth/seed - Create initial admin user (only if no users exist)
export async function POST() {
    try {
        // Check if any users exist
        const userCount = await prisma.usuario.count()

        if (userCount > 0) {
            return NextResponse.json(
                { message: 'Usuários já existem. Seed não executado.' },
                { status: 200 }
            )
        }

        // Create admin user
        const senhaHash = await bcrypt.hash('admin123', 10)

        const admin = await prisma.usuario.create({
            data: {
                nome: 'Administrador',
                username: 'admin',
                email: 'admin@frplus.com', // Optional but good to have
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

        return NextResponse.json({
            message: 'Usuário admin criado com sucesso!',
            usuario: admin,
            credenciais: {
                usuario: 'admin',
                senha: 'admin123'
            }
        })
    } catch (error) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: 'Erro ao criar seed' }, { status: 500 })
    }
}
