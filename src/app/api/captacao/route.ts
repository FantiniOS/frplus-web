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

// GET: Buscar clientes ou produtos (baseado no clienteId)
export async function GET(request: Request) {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const url = new URL(request.url)
        const clienteId = url.searchParams.get('clienteId')

        // Se não tem clienteId, retorna apenas a lista de clientes para popular o Select
        if (!clienteId) {
            let clientesQuery: any = {}
            if (user.role === 'VENDEDOR' || user.role === 'vendedor') {
                clientesQuery = { vendedorId: user.id }
            }

            const clientes = await prisma.cliente.findMany({
                where: { ...clientesQuery, status: 'Ativo' },
                select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
                orderBy: { razaoSocial: 'asc' }
            })
            return NextResponse.json({ clientes })
        }

        // Se tem clienteId, busca o cliente para descobrir a tabela de preços dele
        const cliente = await prisma.cliente.findUnique({
            where: { id: clienteId },
            select: { tabelaPreco: true }
        })

        if (!cliente) {
            return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
        }

        const tabela = cliente.tabelaPreco || '50a199'

        // Busca produtos e mapeia o precoUnitario de acordo com a tabela do cliente
        const produtosRaw = await prisma.produto.findMany({
            where: { ativo: true },
            select: {
                id: true,
                codigo: true,
                nome: true,
                imagem: true,
                unidade: true,
                preco50a199: true,
                preco200a699: true,
                precoAtacado: true,
                precoAtacadoAVista: true,
                precoRedes: true,
            },
            orderBy: { nome: 'asc' }
        })

        const produtos = produtosRaw.map(prod => {
            let precoUnitario = prod.preco50a199
            switch (tabela.toLowerCase()) {
                case '200a699': precoUnitario = prod.preco200a699; break;
                case 'atacado': precoUnitario = prod.precoAtacado; break;
                case 'atacadoavista':
                case 'atacado a vista':
                case 'avista':
                    precoUnitario = prod.precoAtacadoAVista; break;
                case 'redes': precoUnitario = prod.precoRedes; break;
                default: precoUnitario = prod.preco50a199; break;
            }

            return {
                id: prod.id,
                codigo: prod.codigo,
                nome: prod.nome,
                imagem: prod.imagem,
                unidade: prod.unidade,
                precoUnitario
            }
        })

        return NextResponse.json({ produtos, tabela })
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
