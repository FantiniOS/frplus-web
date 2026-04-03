'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

/**
 * ============================================================
 * SERVER ACTION 100% ISOLADA — Consultoria de 1º Pedido
 * ============================================================
 * 
 * REGRA DE OURO: Este arquivo é exclusivo da tela de 1º Pedido.
 * Nenhuma outra tela do ERP usa ou importa esta função.
 * 
 * Lógica:
 * 1. Busca TODO o histórico de vendas (sem limite de data)
 *    para uma fábrica + perfil de tabela de preço.
 * 2. Usa pedido.tabelaPreco (contains/insensitive) paraMatch flexível.
 * 3. Calculo de Giro Diário:
 *    -> totalQtdVendida / diasHistorico / clientesUnicos
 *    -> diasHistorico = diferença entre o pedido mais antigo e hoje
 * 4. Retorna TOP 5 produtos (Curva A) com giro e preços.
 * ============================================================
 */

interface CurvaAResult {
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
    clientesUnicos: number
    giroDiarioCliente: number
    diasHistorico: number
}

interface ConsultoriaResponse {
    curvaA: CurvaAResult[]
    fonte: 'historico' | 'fallback_empty'
    alerta?: string
    diasHistoricoTotal?: number
}

export async function calcularGiroConsultoria(
    fabricaId: string,
    tabelaPreco: string
): Promise<ConsultoriaResponse> {
    // Auth guard
    const user = await getServerUser()
    if (!user) {
        return { curvaA: [], fonte: 'fallback_empty', alerta: 'Não autorizado.' }
    }

    if (!fabricaId || !tabelaPreco) {
        return { curvaA: [], fonte: 'fallback_empty', alerta: 'Fábrica e Perfil são obrigatórios.' }
    }

    try {
        // =========================================================
        // 1. Buscar TODOS os itens de pedidos de VENDA — SEM filtro de data
        //    Filtro flexível no pedido.tabelaPreco (contains/insensitive)
        // =========================================================
        const items = await prisma.itemPedido.findMany({
            where: {
                produto: { fabricaId },
                pedido: {
                    tipo: { contains: 'Venda', mode: 'insensitive' },
                    tabelaPreco: {
                        contains: tabelaPreco,
                        mode: 'insensitive'
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
                        data: true,
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

        // Se não houver dados, retorna cedo sem erro duro
        if (items.length === 0) {
            return {
                curvaA: [],
                fonte: 'fallback_empty',
                alerta: `Nenhuma venda encontrada para esta fábrica com o perfil "${tabelaPreco}". Verifique se existem pedidos de Venda cadastrados com essa tabela de preço.`
            }
        }

        // =========================================================
        // 2. Descobrir o SPAN real do histórico (pedido mais antigo → hoje)
        // =========================================================
        let dataMaisAntiga: Date = new Date()
        for (const item of items) {
            const d = new Date(item.pedido.data)
            if (d < dataMaisAntiga) dataMaisAntiga = d
        }
        const hoje = new Date()
        const diffMs = hoje.getTime() - dataMaisAntiga.getTime()
        const diasHistoricoTotal = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

        // =========================================================
        // 3. Agrupar por produto
        // =========================================================
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

        // =========================================================
        // 4. Calcular giro e montar TOP 5
        //    Giro Diário por Cliente = totalQtdVendida / diasHistorico / clientesUnicos
        // =========================================================
        const topProducts: CurvaAResult[] = Object.values(grouped)
            .filter(p => p.ativo && p.totalQtdVendida > 0)
            .sort((a, b) => b.totalQtdVendida - a.totalQtdVendida)
            .slice(0, 5)
            .map(p => {
                const numClientes = p.clientesUnicosSet.size || 1
                const giroDiarioPorCliente = p.totalQtdVendida / diasHistoricoTotal / Math.max(1, numClientes)

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
                    diasHistorico: diasHistoricoTotal,
                }
            })

        // Sem mínimo de 3 produtos — mostra o que tiver
        return {
            curvaA: topProducts,
            fonte: topProducts.length > 0 ? 'historico' : 'fallback_empty',
            diasHistoricoTotal,
            ...(topProducts.length === 0 ? {
                alerta: `Nenhum produto ativo com vendas encontrado para fábrica + perfil "${tabelaPreco}".`
            } : {})
        }

    } catch (error: any) {
        console.error('[Consultoria 1º Pedido] Erro:', error?.message || error)
        return {
            curvaA: [],
            fonte: 'fallback_empty',
            alerta: `Erro interno: ${error?.message || 'desconhecido'}`
        }
    }
}
