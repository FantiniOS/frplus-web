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

export async function GET() {
    try {
        const user = await getAuthUser()
        if (!user || !user.id || user.role !== 'VENDEDOR') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const pedidos = await prisma.prePedido.findMany({
            where: {
                vendedorId: user.id
            },
            include: {
                cliente: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        nomeFantasia: true,
                        cnpj: true
                    }
                },
                itens: {
                    include: {
                        produto: {
                            select: {
                                id: true,
                                codigo: true,
                                nome: true,
                                unidade: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json({ pedidos })
    } catch (error) {
        console.error('Erro ao buscar histórico de pedidos:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
