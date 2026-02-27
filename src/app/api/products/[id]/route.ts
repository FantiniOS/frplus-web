import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

interface Params {
    params: { id: string }
}

// GET /api/products/[id] - Get single product
export async function GET(request: Request, { params }: Params) {
    try {
        const user = await getServerUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const whereClause: any = { id: params.id }
        if (user.role === 'industria' && user.fabricaId) {
            whereClause.fabricaId = user.fabricaId
        }

        const product = await prisma.produto.findUnique({
            where: whereClause,
            include: { fabrica: true }
        })

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({
            id: product.id,
            codigo: product.codigo,
            nome: product.nome,
            preco50a199: Number(product.preco50a199),
            preco200a699: Number(product.preco200a699),
            precoAtacado: Number(product.precoAtacado),
            precoAtacadoAVista: Number(product.precoAtacadoAVista),
            precoRedes: Number(product.precoRedes),
            imagem: product.imagem,
            fabricaId: product.fabricaId,
            fabricaNome: product.fabrica.nome,
            categoria: product.categoria || 'Geral'
        })
    } catch (error) {
        console.error('Error fetching product:', error)
        return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
    }
}

// PUT /api/products/[id] - Update product
export async function PUT(request: Request, { params }: Params) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()

        const product = await prisma.produto.update({
            where: { id: params.id },
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

        return NextResponse.json(product)
    } catch (error) {
        console.error('Error updating product:', error)
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(request: Request, { params }: Params) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        await prisma.produto.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting product:', error)
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }
}
