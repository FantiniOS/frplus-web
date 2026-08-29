import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/vendedores - List all vendedores
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const ativoParam = searchParams.get('ativo')

        const whereClause: any = {}
        if (ativoParam === 'true') {
            whereClause.ativo = true
        } else if (ativoParam === 'false') {
            whereClause.ativo = false
        }

        const vendedores = await prisma.vendedor.findMany({
            where: whereClause,
            orderBy: { nome: 'asc' },
            include: {
                _count: {
                    select: { clientes: true }
                }
            }
        })

        return NextResponse.json(vendedores)
    } catch (error) {
        console.error('Error fetching vendedores:', error)
        return NextResponse.json({ error: 'Failed to fetch vendedores' }, { status: 500 })
    }
}

// POST /api/vendedores - Create a new vendedor
export async function POST(request: Request) {
    try {
        const body = await request.json()

        if (!body.nome || body.nome.trim() === '') {
            return NextResponse.json(
                { error: 'Nome é obrigatório' },
                { status: 400 }
            )
        }

        // Hash da senha se fornecida
        let senhaHashed = null;
        if (body.senha) {
            const bcrypt = require('bcryptjs');
            senhaHashed = await bcrypt.hash(body.senha, 10);
        }

        const vendedor = await prisma.vendedor.create({
            data: {
                nome: body.nome.trim(),
                telefone: body.telefone?.trim() || null,
                codigoAcesso: body.codigoAcesso?.trim() || null,
                senha: senhaHashed,
                percentualComissao: body.percentualComissao ?? 0,
                taxaRetencaoIR: body.taxaRetencaoIR ?? 0,
                taxaRetencaoISSQN: body.taxaRetencaoISSQN ?? 0,
                ativo: body.ativo ?? true,
            },
            include: {
                _count: {
                    select: { clientes: true }
                }
            }
        })

        return NextResponse.json(vendedor, { status: 201 })
    } catch (error) {
        console.error('Error creating vendedor:', error)
        return NextResponse.json({ error: 'Failed to create vendedor' }, { status: 500 })
    }
}
