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

        const pedidos = await prisma.prePedido.findMany({
            include: {
                cliente: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        nomeFantasia: true,
                        cnpj: true,
                        endereco: true,
                        numero: true,
                        bairro: true,
                        cidade: true,
                        estado: true,
                        cep: true,
                        telefone: true,
                        celular: true,
                        tabelaPreco: true
                    }
                },
                vendedor: {
                    select: { id: true, nome: true }
                },
                itens: {
                    include: {
                        produto: { select: { id: true, codigo: true, nome: true, unidade: true } }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json({ pedidos })
    } catch (error) {
        console.error('Erro ao buscar pre-pedidos admin:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
