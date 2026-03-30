import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/products/by-fabrica?fabricaId=xxx
export async function GET(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const fabricaId = searchParams.get('fabricaId')

        if (!fabricaId) {
            return NextResponse.json({ error: 'fabricaId é obrigatório' }, { status: 400 })
        }

        const products = await prisma.produto.findMany({
            where: {
                fabricaId,
                ativo: true
            },
            include: { fabrica: true },
            orderBy: [
                { categoria: 'asc' },
                { nome: 'asc' }
            ]
        })

        const formatted = products.map(p => ({
            id: p.id,
            codigo: p.codigo,
            nome: p.nome,
            categoria: p.categoria || 'Geral',
            preco50a199: Number(p.preco50a199),
            preco200a699: Number(p.preco200a699),
            precoAtacado: Number(p.precoAtacado),
            precoAtacadoAVista: Number(p.precoAtacadoAVista),
            precoRedes: Number(p.precoRedes),
        }))

        return NextResponse.json(formatted)
    } catch (error) {
        console.error('Error fetching products by fabrica:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}
