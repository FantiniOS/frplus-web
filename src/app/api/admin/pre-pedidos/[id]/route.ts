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

// DELETE: Excluir pré-pedido
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const admin = await getAuthAdmin()
        if (!admin) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const { id } = params
        if (!id) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        const existing = await prisma.prePedido.findUnique({
            where: { id }
        })

        if (!existing) {
            return NextResponse.json({ error: 'Pré-pedido não encontrado' }, { status: 404 })
        }

        // Itens são deletados automaticamente pelo onDelete: Cascade do Prisma
        await prisma.prePedido.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: 'Pré-pedido excluído com sucesso' })
    } catch (error) {
        console.error('Erro ao excluir pré-pedido:', error)
        return NextResponse.json({ error: 'Erro ao excluir pré-pedido' }, { status: 500 })
    }
}

// PUT: Editar pré-pedido (itens, quantidades, preços e recalcular total)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const admin = await getAuthAdmin()
        if (!admin) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const { id } = params
        if (!id) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        const body = await request.json()
        const { itens, status, motivoRejeicao } = body

        if (!Array.isArray(itens) || itens.length === 0) {
            return NextResponse.json({ error: 'O pedido deve conter pelo menos um item' }, { status: 400 })
        }

        // Validar e sanitizar itens
        for (const item of itens) {
            if (!item.produtoId || Number(item.quantidade) <= 0 || Number(item.precoUnitario) < 0) {
                return NextResponse.json({ error: 'Itens com dados inválidos (produto, quantidade ou preço)' }, { status: 400 })
            }
        }

        const valorTotal = itens.reduce((acc: number, item: any) => {
            return acc + (Number(item.quantidade) * Number(item.precoUnitario))
        }, 0)

        const prePedidoAtualizado = await prisma.$transaction(async (tx) => {
            // Remover itens antigos
            await tx.itemPrePedido.deleteMany({
                where: { prePedidoId: id }
            })

            // Atualizar cabeçalho do pré-pedido e recriar itens
            return await tx.prePedido.update({
                where: { id },
                data: {
                    valorTotal,
                    ...(status ? { status } : {}),
                    ...(motivoRejeicao !== undefined ? { motivoRejeicao } : {}),
                    itens: {
                        create: itens.map((item: any) => ({
                            produtoId: item.produtoId,
                            quantidade: Number(item.quantidade),
                            precoUnitario: Number(item.precoUnitario)
                        }))
                    }
                },
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
                            produto: {
                                select: { id: true, codigo: true, nome: true, unidade: true }
                            }
                        }
                    }
                }
            })
        })

        return NextResponse.json({ success: true, prePedido: prePedidoAtualizado })
    } catch (error) {
        console.error('Erro ao atualizar pré-pedido:', error)
        return NextResponse.json({ error: 'Erro ao atualizar pré-pedido' }, { status: 500 })
    }
}
