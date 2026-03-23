import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

function calcularMediaCicloDias(datas: Date[]): number | null {
    if (!datas || datas.length < 2) return null

    let totalDias = 0
    let intervalos = 0

    for (let i = 1; i < datas.length; i++) {
        const diffMs = datas[i].getTime() - datas[i - 1].getTime()
        const diffDias = diffMs / (1000 * 60 * 60 * 24)
        totalDias += diffDias
        intervalos++
    }

    if (intervalos === 0) return null

    const media = totalDias / intervalos
    return Math.round(media)
}

// GET /api/clients - List all clients with last purchase date
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const statusParam = searchParams.get('status')

        const whereClause: any = {}
        if (statusParam && statusParam !== 'Todos') {
            whereClause.status = statusParam
        } else if (!statusParam) {
            // Default to 'Ativo' if not specified, to protect other dashboard components
            whereClause.status = 'Ativo'
        }

        const clients = await prisma.cliente.findMany({
            where: whereClause,
            orderBy: { nomeFantasia: 'asc' },
            include: {
                pedidos: {
                    orderBy: { data: 'desc' },
                    take: 1,
                    select: { data: true }
                }
            }
        })

        const activeClientIds = clients
            .filter(client => client.status === 'Ativo')
            .map(client => client.id)

        let mediaCicloPorCliente = new Map<string, number | null>()

        if (activeClientIds.length > 0) {
            const pedidosFaturados = await prisma.pedido.findMany({
                where: {
                    clienteId: { in: activeClientIds },
                    status: 'Concluido'
                },
                select: {
                    clienteId: true,
                    data: true
                },
                orderBy: { data: 'asc' }
            })

            const datasPorCliente = new Map<string, Date[]>()

            for (const pedido of pedidosFaturados) {
                const lista = datasPorCliente.get(pedido.clienteId) || []
                lista.push(pedido.data)
                datasPorCliente.set(pedido.clienteId, lista)
            }

            for (const [clienteId, datas] of Array.from(datasPorCliente.entries())) {
                const media = calcularMediaCicloDias(datas)
                mediaCicloPorCliente.set(clienteId, media)
            }
        }

        const formattedClients = clients.map(client => {
            const ultimaCompra = client.pedidos[0]?.data || null
            const mediaCicloDias =
                client.status === 'Ativo'
                    ? mediaCicloPorCliente.get(client.id) ?? null
                    : null

            return {
                ...client,
                ultima_compra: ultimaCompra,
                mediaCicloDias,
                pedidos: undefined // Remove pedidos array para manter payload enxuto
            }
        })

        return NextResponse.json(formattedClients)
    } catch (error) {
        console.error('Error fetching clients:', error)
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }
}

// POST /api/clients - Create a new client
export async function POST(request: Request) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()

        // Validate required fields
        if (!body.razaoSocial && !body.nomeFantasia) {
            return NextResponse.json(
                { error: 'Razão Social ou Nome Fantasia é obrigatório' },
                { status: 400 }
            )
        }

        if (!body.cnpj) {
            return NextResponse.json(
                { error: 'CNPJ é obrigatório' },
                { status: 400 }
            )
        }

        const client = await prisma.cliente.create({
            data: {
                razaoSocial: body.razaoSocial || body.nomeFantasia || 'Não informado',
                nomeFantasia: body.nomeFantasia || body.razaoSocial || 'Não informado',
                comprador: body.comprador || null,
                cnpj: body.cnpj,
                inscricaoEstadual: body.inscricaoEstadual || '',
                email: body.email || '',
                telefone: body.telefone || '',
                celular: body.celular || '',
                endereco: body.endereco || '',
                numero: body.numero || null,
                bairro: body.bairro || '',
                cidade: body.cidade || '',
                estado: body.estado || '',
                cep: body.cep || '',
                tabelaPreco: body.tabelaPreco || '50a199',
                limiteCredito: body.limiteCredito || 0,
                status: body.status || 'Ativo',
                observacoes: body.observacoes || ''
            }
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error) {
        console.error('Error creating client:', error)
        return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }
}
