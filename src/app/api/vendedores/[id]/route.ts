import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
    params: { id: string }
}

// GET /api/vendedores/[id] - Get single vendedor
export async function GET(request: Request, { params }: Params) {
    try {
        const vendedor = await prisma.vendedor.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { clientes: true }
                }
            }
        })

        if (!vendedor) {
            return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 })
        }

        return NextResponse.json(vendedor)
    } catch (error) {
        console.error('Error fetching vendedor:', error)
        return NextResponse.json({ error: 'Failed to fetch vendedor' }, { status: 500 })
    }
}

// PUT /api/vendedores/[id] - Update vendedor
export async function PUT(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        if (body.nome !== undefined && body.nome.trim() === '') {
            return NextResponse.json(
                { error: 'Nome não pode ser vazio' },
                { status: 400 }
            )
        }

        let senhaHashed = undefined;
        if (body.senha !== undefined && body.senha !== '') {
            const bcrypt = require('bcryptjs');
            senhaHashed = await bcrypt.hash(body.senha, 10);
        }

        const vendedor = await prisma.vendedor.update({
            where: { id: params.id },
            data: {
                ...(body.nome !== undefined && { nome: body.nome.trim() }),
                ...(body.telefone !== undefined && { telefone: body.telefone?.trim() || null }),
                ...(body.codigoAcesso !== undefined && { codigoAcesso: body.codigoAcesso?.trim() || null }),
                ...(senhaHashed !== undefined && { senha: senhaHashed }),
                ...(body.percentualComissao !== undefined && { percentualComissao: body.percentualComissao }),
                ...(body.taxaRetencaoIR !== undefined && { taxaRetencaoIR: body.taxaRetencaoIR }),
                ...(body.taxaRetencaoISSQN !== undefined && { taxaRetencaoISSQN: body.taxaRetencaoISSQN }),
                ...(body.ativo !== undefined && { ativo: body.ativo }),
            },
            include: {
                _count: {
                    select: { clientes: true }
                }
            }
        })

        return NextResponse.json(vendedor)
    } catch (error) {
        console.error('Error updating vendedor:', error)
        return NextResponse.json({ error: 'Failed to update vendedor' }, { status: 500 })
    }
}

// PATCH /api/vendedores/[id] - Toggle ativo status (soft delete/reactivate)
export async function PATCH(request: Request, { params }: Params) {
    try {
        const body = await request.json()

        const vendedor = await prisma.vendedor.update({
            where: { id: params.id },
            data: {
                ativo: body.ativo,
            },
            include: {
                _count: {
                    select: { clientes: true }
                }
            }
        })

        return NextResponse.json(vendedor)
    } catch (error) {
        console.error('Error toggling vendedor status:', error)
        return NextResponse.json({ error: 'Failed to update vendedor status' }, { status: 500 })
    }
}
