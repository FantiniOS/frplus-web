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

// GET /api/central-precos - Histórico de preços coletados (fonte única: PC + App)
// Query params opcionais: clienteId, vendedorId, marcaId, produto, limit
export async function GET(request: Request) {
    try {
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const url = new URL(request.url)
        const clienteId = url.searchParams.get('clienteId')
        const vendedorId = url.searchParams.get('vendedorId')
        const marcaId = url.searchParams.get('marcaId')
        const produto = url.searchParams.get('produto')?.trim()
        const limitParam = parseInt(url.searchParams.get('limit') || '500', 10)
        const limit = Math.min(Math.max(isNaN(limitParam) ? 500 : limitParam, 1), 2000)

        const where: any = {}
        if (clienteId) where.clienteId = clienteId
        if (vendedorId === 'admin') where.vendedorId = null
        else if (vendedorId) where.vendedorId = vendedorId
        if (marcaId) where.marcaConcorrenteId = marcaId
        if (produto) where.produtoBase = { contains: produto, mode: 'insensitive' }

        const registros = await prisma.centralPrecos.findMany({
            where,
            include: {
                cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true, cidade: true } },
                vendedor: { select: { id: true, nome: true } },
                marcaConcorrente: { select: { id: true, nome: true } }
            },
            orderBy: { dataColeta: 'desc' },
            take: limit
        })

        return NextResponse.json({ registros })
    } catch (error) {
        console.error('Erro ao buscar central de preços:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}

// POST /api/central-precos - Registrar preço coletado (Admin ou Vendedor)
export async function POST(request: Request) {
    try {
        const user = await getAuthUser()
        if (!user || !user.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const produtoBase = String(body?.produtoBase || '').trim()
        const marcaConcorrenteId = String(body?.marcaConcorrenteId || '').trim()
        const clienteId = body?.clienteId ? String(body.clienteId) : null
        const precoPrateleira = Number(String(body?.precoPrateleira ?? '').replace(',', '.'))

        if (!produtoBase) {
            return NextResponse.json({ error: 'Produto base é obrigatório' }, { status: 400 })
        }
        if (!marcaConcorrenteId) {
            return NextResponse.json({ error: 'Marca concorrente é obrigatória' }, { status: 400 })
        }
        if (!isFinite(precoPrateleira) || precoPrateleira <= 0) {
            return NextResponse.json({ error: 'Preço de prateleira inválido' }, { status: 400 })
        }

        const marca = await prisma.marcaConcorrente.findUnique({ where: { id: marcaConcorrenteId } })
        if (!marca) {
            return NextResponse.json({ error: 'Marca concorrente não encontrada' }, { status: 404 })
        }

        if (clienteId) {
            const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
            if (!cliente) {
                return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
            }
        }

        // Admins vivem na tabela Usuario e Vendedores na tabela Vendedor.
        // Só vinculamos vendedorId se o usuário logado for de fato um Vendedor;
        // caso contrário (Admin no PC), vendedorId fica NULL = "coletado pelo Administrador".
        const vendedor = await prisma.vendedor.findUnique({ where: { id: user.id }, select: { id: true } })

        let dataColeta: Date | undefined
        if (body?.dataColeta) {
            const d = new Date(body.dataColeta)
            if (!isNaN(d.getTime())) dataColeta = d
        }

        const registro = await prisma.centralPrecos.create({
            data: {
                produtoBase,
                marcaConcorrenteId,
                precoPrateleira: Math.round(precoPrateleira * 100) / 100,
                clienteId,
                vendedorId: vendedor ? vendedor.id : null,
                ...(dataColeta ? { dataColeta } : {})
            },
            include: {
                cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true, cidade: true } },
                vendedor: { select: { id: true, nome: true } },
                marcaConcorrente: { select: { id: true, nome: true } }
            }
        })

        return NextResponse.json({ registro }, { status: 201 })
    } catch (error) {
        console.error('Erro ao registrar preço coletado:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
