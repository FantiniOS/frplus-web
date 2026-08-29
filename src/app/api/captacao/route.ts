import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

// Função para extrair o usuário do token
async function getAuthUser() {
    const token = cookies().get('auth_token')?.value
    if (!token) return null
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any
        return payload
    } catch {
        return null
    }
}

// GET: Buscar clientes e produtos
export async function GET() {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        // Buscar clientes do vendedor (se ele não tiver clientes vinculados, talvez seja interessante trazer todos ou deixar vazio dependendo da regra, mas a prompt sugere filtrar)
        let clientesQuery: any = {}
        if (user.role === 'VENDEDOR') {
            clientesQuery = { vendedorId: user.id }
        }

        const clientes = await prisma.cliente.findMany({
            where: {
                ...clientesQuery,
                status: 'Ativo'
            },
            select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                cnpj: true
            },
            orderBy: { razaoSocial: 'asc' }
        })

        // Se for vendedor e não tiver clientes, podemos buscar todos apenas para evitar tela vazia em testes, mas vamos seguir a regra de carteira.
        // Se a regra estrita é só a carteira, mantemos `clientesQuery`.

        const produtos = await prisma.produto.findMany({
            where: { ativo: true },
            select: {
                id: true,
                codigo: true,
                nome: true,
                preco50a199: true,
                imagem: true,
                unidade: true,
            },
            orderBy: { nome: 'asc' }
        })

        return NextResponse.json({ clientes, produtos })
    } catch (error) {
        console.error('Erro ao buscar dados para captação:', error)
        return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
    }
}

// POST: Receber pedido e salvar no banco isolado (PrePedido)
export async function POST(request: Request) {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { clienteId, itens, valorTotal } = body

        if (!clienteId || !itens || itens.length === 0) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
        }

        // Criar PrePedido usando Transaction
        const prePedido = await prisma.$transaction(async (tx) => {
            const pedido = await tx.prePedido.create({
                data: {
                    clienteId,
                    vendedorId: user.id,
                    valorTotal,
                    status: 'PENDENTE',
                    itens: {
                        create: itens.map((item: any) => ({
                            produtoId: item.produtoId,
                            quantidade: item.quantidade,
                            precoUnitario: item.precoUnitario,
                        }))
                    }
                },
                include: {
                    itens: true
                }
            })
            return pedido
        })

        return NextResponse.json({ success: true, prePedido })
    } catch (error) {
        console.error('Erro ao salvar pré-pedido:', error)
        return NextResponse.json({ error: 'Erro interno ao salvar pedido' }, { status: 500 })
    }
}
