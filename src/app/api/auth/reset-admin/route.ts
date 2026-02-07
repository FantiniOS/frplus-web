import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST /api/auth/reset-admin - Reset admin password (emergency use only)
export async function POST() {
    try {
        // Find or create admin user
        const existingAdmin = await prisma.usuario.findFirst({
            where: { username: 'admin' }
        })

        const senhaHash = await bcrypt.hash('admin123', 10)

        if (existingAdmin) {
            // Update existing admin password
            await prisma.usuario.update({
                where: { id: existingAdmin.id },
                data: {
                    senha: senhaHash,
                    ativo: true,
                    role: 'admin'
                }
            })

            return NextResponse.json({
                message: 'Senha do admin resetada com sucesso!',
                credenciais: {
                    usuario: 'admin',
                    senha: 'admin123'
                }
            })
        } else {
            // Create admin user
            const admin = await prisma.usuario.create({
                data: {
                    nome: 'Administrador',
                    username: 'admin',
                    email: 'admin@frplus.com',
                    senha: senhaHash,
                    role: 'admin',
                    ativo: true
                }
            })

            return NextResponse.json({
                message: 'Usuário admin criado com sucesso!',
                usuario: { id: admin.id, nome: admin.nome, username: admin.username },
                credenciais: {
                    usuario: 'admin',
                    senha: 'admin123'
                }
            })
        }
    } catch (error) {
        console.error('Reset admin error:', error)
        return NextResponse.json({ error: 'Erro ao resetar admin' }, { status: 500 })
    }
}
