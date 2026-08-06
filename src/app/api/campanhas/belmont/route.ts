import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'

// GET /api/campanhas/belmont — Calculadora da Campanha Composto Belmont
export async function GET() {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        // 1. Find all "Composto Tinto" and "Composto Branco" 750ml products
        const produtosComposto = await prisma.produto.findMany({
            where: {
                ativo: true,
                AND: [
                    {
                        OR: [
                            { nome: { contains: 'Composto Tinto', mode: 'insensitive' } },
                            { nome: { contains: 'Composto Branco', mode: 'insensitive' } },
                        ]
                    },
                    { nome: { contains: '750ml', mode: 'insensitive' } }
                ]
            },
            select: { id: true, nome: true, imagem: true }
        })

        const produtoIds = produtosComposto.map(p => p.id)

        if (produtoIds.length === 0) {
            return NextResponse.json([])
        }

        // Get Vinagre products for bonus tracking
        const produtosVinagre = await prisma.produto.findMany({
            where: {
                ativo: true,
                nome: { contains: 'Vinagre', mode: 'insensitive' }
            },
            select: { id: true }
        })
        const vinagreIds = produtosVinagre.map(p => p.id)

        // 2. Get or create the Campaign record to freeze the start date
        let campanha = await prisma.campanha.findUnique({
            where: { slug: 'belmont' }
        })

        if (!campanha) {
            campanha = await prisma.campanha.create({
                data: {
                    slug: 'belmont',
                    nome: 'Composto Belmont',
                    status: 'ATIVA',
                    dataInicio: new Date()
                }
            })
        }

        // Calculate date range fixed to the campaign start date (Snapshot)
        const dataReferencia = campanha.dataInicio
        const sessantaDiasAtras = new Date(dataReferencia)
        sessantaDiasAtras.setDate(sessantaDiasAtras.getDate() - 60)

        // 3. Fetch all active clients (carteira base) without order restriction
        const clientes = await prisma.cliente.findMany({
            where: { status: { in: ['Ativo', 'ATIVO', 'ativo'] } },
            select: {
                id: true,
                nomeFantasia: true,
                razaoSocial: true,
                cidade: true,
                estado: true,
                tabelaPreco: true,
                telefone: true,
                celular: true,
                comprador: true,
            }
        })

        // 4. Aggregate quantities per client in the last 60 days for these products
        // Using raw aggregation via itemPedido -> pedido join
        const consumoData = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            where: {
                produtoId: { in: produtoIds },
                pedido: {
                    data: { gte: sessantaDiasAtras, lte: dataReferencia },
                    status: { not: 'Cancelado' },
                    tipo: 'Venda',
                }
            },
            _sum: { quantidade: true },
        })

        // We need per-client aggregation, so let's use a different approach
        // Fetch all relevant item records with their pedido's clienteId
        const itensRelevantes = await prisma.itemPedido.findMany({
            where: {
                produtoId: { in: produtoIds },
                pedido: {
                    data: { gte: sessantaDiasAtras, lte: dataReferencia },
                    status: { not: 'Cancelado' },
                    tipo: 'Venda',
                }
            },
            select: {
                quantidade: true,
                pedido: {
                    select: { clienteId: true }
                }
            }
        })

        // Build a map: clienteId -> total caixas (Average baseline)
        const consumoPorCliente = new Map<string, number>()
        for (const item of itensRelevantes) {
            const clienteId = item.pedido.clienteId
            const atual = consumoPorCliente.get(clienteId) || 0
            consumoPorCliente.set(clienteId, atual + item.quantidade)
        }

        // 4.1 Fetch "Realizado" (sales manually linked to this campaign)
        const itensRealizados = await prisma.itemPedido.findMany({
            where: {
                produtoId: { in: produtoIds },
                pedido: {
                    campanhaId: campanha.id,
                    status: { not: 'Cancelado' },
                    tipo: 'Venda',
                }
            },
            select: { quantidade: true, pedido: { select: { id: true, clienteId: true } } }
        })

        const pedidosRealizadosPorCliente = new Map<string, Map<string, number>>()
        const realizadoPorCliente = new Map<string, number>()
        
        for (const item of itensRealizados) {
            const clienteId = item.pedido.clienteId
            const pedidoId = item.pedido.id

            const atualRealizado = realizadoPorCliente.get(clienteId) || 0
            realizadoPorCliente.set(clienteId, atualRealizado + item.quantidade)

            if (!pedidosRealizadosPorCliente.has(clienteId)) {
                pedidosRealizadosPorCliente.set(clienteId, new Map<string, number>())
            }
            const clientOrders = pedidosRealizadosPorCliente.get(clienteId)!
            const atualPedido = clientOrders.get(pedidoId) || 0
            clientOrders.set(pedidoId, atualPedido + item.quantidade)
        }

        // 4.2 Fetch "BonificacoesEmitidas" (bonus orders manually linked to this campaign)
        const itensBonificados = await prisma.itemPedido.findMany({
            where: {
                produtoId: { in: vinagreIds },
                pedido: {
                    campanhaId: campanha.id,
                    status: { not: 'Cancelado' },
                    tipo: 'Bonificacao'
                }
            },
            select: { quantidade: true, pedido: { select: { clienteId: true } } }
        })

        const bonificacaoEmitidaPorCliente = new Map<string, number>()
        for (const item of itensBonificados) {
            const clienteId = item.pedido.clienteId
            const atual = bonificacaoEmitidaPorCliente.get(clienteId) || 0
            bonificacaoEmitidaPorCliente.set(clienteId, atual + item.quantidade)
        }

        // 5. Calculate campaign metrics for each client
        const resultado = clientes.map(cliente => {
            const totalCaixas60d = consumoPorCliente.get(cliente.id) || 0
            const mediaAtual = Math.round((totalCaixas60d / 2) * 100) / 100 // média 2 meses

            // Fórmula da campanha
            const mediaBase = mediaAtual < 50 ? 50 : mediaAtual
            const metaCampanha = Math.ceil(mediaBase * 0.25)
            const quantidadeFaturar = Math.ceil(mediaBase + metaCampanha)
            const bonificacaoVinagre = Math.floor((quantidadeFaturar / 63) * 5)

            // Tracking e Conciliação
            const realizado = realizadoPorCliente.get(cliente.id) || 0
            const faltam = Math.max(0, quantidadeFaturar - realizado)
            const progresso = quantidadeFaturar > 0 ? Math.round((realizado / quantidadeFaturar) * 100) : 0

            let bonificacaoConquistada = 0
            const clientOrders = pedidosRealizadosPorCliente.get(cliente.id)
            if (clientOrders && quantidadeFaturar > 0) {
                for (const volumePedido of Array.from(clientOrders.values())) {
                    if (volumePedido >= quantidadeFaturar) {
                        const bonusDoPedido = Math.floor((volumePedido / 63) * 5)
                        bonificacaoConquistada += bonusDoPedido
                    }
                }
            }
            const bonificacaoEmitida = bonificacaoEmitidaPorCliente.get(cliente.id) || 0
            const saldoPendente = bonificacaoConquistada - bonificacaoEmitida

            return {
                clienteId: cliente.id,
                nomeFantasia: cliente.nomeFantasia,
                razaoSocial: cliente.razaoSocial,
                cidade: cliente.cidade,
                estado: cliente.estado,
                tabelaPreco: cliente.tabelaPreco,
                telefone: cliente.telefone,
                celular: cliente.celular,
                comprador: cliente.comprador,
                totalCaixas60d,
                mediaAtual,
                mediaBase,
                metaCampanha,
                quantidadeFaturar,
                bonificacaoVinagre,
                isZerado: mediaAtual < 50,
                realizado,
                faltam,
                progresso,
                bonificacaoConquistada,
                bonificacaoEmitida,
                saldoPendente,
            }
        })

        // Sort descending by quantidadeFaturar (volume)
        resultado.sort((a, b) => b.quantidadeFaturar - a.quantidadeFaturar)

        return NextResponse.json({
            campanha: {
                id: campanha.id,
                status: campanha.status,
                dataInicio: campanha.dataInicio.toISOString(),
            },
            produtosEncontrados: produtosComposto.map(p => p.nome),
            produtosDetalhes: produtosComposto.map(p => ({
                id: p.id,
                nome: p.nome,
                imagemUrl: p.imagem || '/placeholder-bottle.png'
            })),
            periodoInicio: sessantaDiasAtras.toISOString(),
            periodoFim: dataReferencia.toISOString(),
            totalClientes: resultado.length,
            totalZerados: resultado.filter(r => r.isZerado).length,
            volumeProjetado: resultado.reduce((acc, r) => acc + r.quantidadeFaturar, 0),
            totalBonificacoes: resultado.reduce((acc, r) => acc + r.bonificacaoVinagre, 0),
            clientes: resultado,
        })
    } catch (error: any) {
        console.error('Erro na campanha Belmont:', error?.message || error)
        return NextResponse.json(
            { error: 'Falha ao calcular campanha', details: error?.message },
            { status: 500 }
        )
    }
}

// PATCH /api/campanhas/belmont — Atualizar status da campanha
export async function PATCH(req: Request) {
    try {
        const user = await getServerUser()
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const body = await req.json()
        const { status } = body

        if (status !== 'ATIVA' && status !== 'ENCERRADA') {
            return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
        }

        const campanha = await prisma.campanha.update({
            where: { slug: 'belmont' },
            data: { 
                status,
                dataEncerramento: status === 'ENCERRADA' ? new Date() : null
            }
        })

        return NextResponse.json({ success: true, campanha })
    } catch (error: any) {
        console.error('Erro ao atualizar status da campanha:', error?.message || error)
        return NextResponse.json(
            { error: 'Falha ao atualizar campanha' },
            { status: 500 }
        )
    }
}
