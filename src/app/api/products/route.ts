import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/products - List all products
export async function GET() {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const whereClause: any = {}
        if (user.role === 'industria' && user.fabricaId) {
            whereClause.fabricaId = user.fabricaId
        }

        const products = await prisma.produto.findMany({
            where: whereClause,
            include: { fabrica: true },
            orderBy: { nome: 'asc' }
        })

        // Transform to match frontend expected format
        const formattedProducts = products.map(p => ({
            id: p.id,
            codigo: p.codigo,
            nome: p.nome,
            preco50a199: Number(p.preco50a199),
            preco200a699: Number(p.preco200a699),
            precoAtacado: Number(p.precoAtacado),
            precoAtacadoAVista: Number(p.precoAtacadoAVista),
            precoRedes: Number(p.precoRedes),
            imagem: p.imagem,
            fabricaId: p.fabricaId,
            fabricaNome: p.fabrica.nome,
            categoria: p.categoria || 'Geral'
        }))

        return NextResponse.json(formattedProducts)
    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}

// POST /api/products - Create a new product
export async function POST(request: Request) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()

        const product = await prisma.produto.create({
            data: {
                codigo: body.codigo,
                nome: body.nome,
                preco50a199: body.preco50a199,
                preco200a699: body.preco200a699,
                precoAtacado: body.precoAtacado,
                precoAtacadoAVista: body.precoAtacadoAVista,
                precoRedes: body.precoRedes,
                imagem: body.imagem,
                fabricaId: body.fabricaId,
                categoria: body.categoria
            }
        })

        return NextResponse.json(product, { status: 201 })
    } catch (error) {
        console.error('Error creating product:', error)
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }
}
