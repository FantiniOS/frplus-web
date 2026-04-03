export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

/**
 * GET /api/inteligencia/curva-a?fabricaId=xxx&tabelaPreco=xxx
 * 
 * Retorna os TOP 5 produtos de uma fábrica para uma Tabela de Preço EXATA.
 * Cálculo Preditivo Rigoroso (Últimos 180 dias):
 * -> Giro Diário/Cliente = Quantidade Total Vendida / 180 dias / Clientes Únicos Ativos
 */
export async function GET(request: Request) {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const fabricaId = searchParams.get('fabricaId')
        const tabelaPreco = searchParams.get('tabelaPreco')

        if (!fabricaId || !tabelaPreco) {
            return NextResponse.json({ error: 'fabricaId e tabelaPreco são obrigatórios' }, { status: 400 })
        }

        // Janela de 180 dias para trás
        const historicoDias = 180
        const dataInicio = new Date()
        dataInicio.setDate(dataInicio.getDate() - historicoDias)

        // 1. Console.log Obrigatório (Diagnóstico sem filtro de data)
        const totalItemsInFabrica = await prisma.itemPedido.count({
            where: {
                produto: { fabricaId },
                pedido: {
                    tipo: { contains: 'Venda', mode: 'insensitive' },
                    cliente: {
                        tabelaPreco: { contains: tabelaPreco, mode: 'insensitive' }
                    }
                }
            }
        });
        console.log(`[DEBUG CURVA-A] Itens de Venda encontrados para Fábrica ${fabricaId} e Tabela ${tabelaPreco} (ANTES DO FILTRO DE 180 DIAS): ${totalItemsInFabrica}`);

        // 2. Buscar todos os itens de pedidos de VENDA com Junção (Join) em Cliente
        // e usando contains(insensitive) em vez de equals.
        // Status restritivo removido conforme solicitado para testar amplitude.
        const items = await prisma.itemPedido.findMany({
            where: {
                produto: { fabricaId },
                pedido: {
                    tipo: { contains: 'Venda', mode: 'insensitive' },
                    data: {
                        gte: dataInicio
                    },
                    cliente: {
                        tabelaPreco: {
                            contains: tabelaPreco,
                            mode: 'insensitive'
                        }
                    }
                }
            },
            select: {
                produtoId: true,
                quantidade: true,
                total: true,
                pedido: {
                    select: {
                        clienteId: true,
                        cliente: {
                            select: {
                                tabelaPreco: true
                            }
                        }
                    }
                },
                produto: {
                    select: {
                        id: true,
                        nome: true,
                        codigo: true,
                        unidade: true,
                        ativo: true,
                        preco50a199: true,
                        preco200a699: true,
                        precoAtacado: true,
                        precoAtacadoAVista: true,
                        precoRedes: true,
                    }
                }
            }
        })

        // Agrupar inteligência real
        const grouped: Record<string, {
            produtoId: string
            nome: string
            codigo: string
            unidade: string
            ativo: boolean
            preco50a199: number
            preco200a699: number
            precoAtacado: number
            precoAtacadoAVista: number
            precoRedes: number
            totalQtdVendida: number
            totalFaturado: number
            clientesUnicosSet: Set<string>
        }> = {}

        for (const item of items) {
            const pid = item.produtoId
            if (!grouped[pid]) {
                grouped[pid] = {
                    produtoId: pid,
                    nome: item.produto.nome,
                    codigo: item.produto.codigo,
                    unidade: item.produto.unidade || 'CX',
                    ativo: item.produto.ativo,
                    preco50a199: Number(item.produto.preco50a199),
                    preco200a699: Number(item.produto.preco200a699),
                    precoAtacado: Number(item.produto.precoAtacado),
                    precoAtacadoAVista: Number(item.produto.precoAtacadoAVista),
                    precoRedes: Number(item.produto.precoRedes),
                    totalQtdVendida: 0,
                    totalFaturado: 0,
                    clientesUnicosSet: new Set()
                }
            }
            grouped[pid].totalQtdVendida += item.quantidade
            grouped[pid].totalFaturado += Number(item.total || 0)
            if (item.pedido.clienteId) {
                grouped[pid].clientesUnicosSet.add(item.pedido.clienteId)
            }
        }

        // Finalizar motor matematico
        let topProducts = Object.values(grouped)
            .filter(p => p.ativo && p.totalQtdVendida > 0)
            .sort((a, b) => b.totalQtdVendida - a.totalQtdVendida)
            .slice(0, 5)
            .map(p => {
                const numClientes = p.clientesUnicosSet.size || 1;
                // Calculo Real: Qtd Vendida / 180 dias / Numero de clientes unicos deste perfil
                const giroDiarioPorCliente = p.totalQtdVendida / historicoDias / Math.max(1, numClientes);
                
                return {
                    produtoId: p.produtoId,
                    nome: p.nome,
                    codigo: p.codigo,
                    unidade: p.unidade,
                    ativo: p.ativo,
                    preco50a199: p.preco50a199,
                    preco200a699: p.preco200a699,
                    precoAtacado: p.precoAtacado,
                    precoAtacadoAVista: p.precoAtacadoAVista,
                    precoRedes: p.precoRedes,
                    totalQtdVendida: p.totalQtdVendida,
                    totalFaturado: p.totalFaturado,
                    clientesUnicos: numClientes,
                    giroDiarioCliente: giroDiarioPorCliente,
                    historicoDias: historicoDias
                }
            })

        // Fallback apenas de segurança extrema de interface
        if (topProducts.length < 3) {
            return NextResponse.json({
                curvaA: topProducts, // Mantem vazio ou incompleto para forçar a visibilidade da falta de histórico real
                fonte: topProducts.length > 0 ? 'historico' : 'fallback_empty',
                alerta: 'Base de dados não possui vendas suficientes desse Perfil nos últimos 180 dias.'
            })
        }

        return NextResponse.json({
            curvaA: topProducts,
            fonte: 'historico',
        })

    } catch (error: any) {
        console.error('Inteligência Curva A Preditiva Error:', error?.message || error)
        return NextResponse.json({ error: 'Erro ao extrair motor preditivo', details: error?.message }, { status: 500 })
    }
}
