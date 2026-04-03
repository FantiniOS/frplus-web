'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

/**
 * ============================================================
 * SERVER ACTION — Consultoria de 1º Pedido (Motor Preditivo)
 * ============================================================
 * 
 * Modos:
 * 1. SNIPER (clienteEspelhoId): Busca vendas do cliente-espelho.
 *    Calcula ticket médio e escala por numLojasNovo.
 * 2. PERFIL (tabelaPreco): Dupla Checagem Prisma.
 *    Ticket médio do perfil inteiro, escalado por numLojasNovo.
 * 
 * Janela: 180 dias.
 * Ticket Médio = totalQtdVendida / pedidosUnicos.
 * ============================================================
 */

export interface CurvaAResult {
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
    ticketMedioCaixas: number
    sugestaoCaixas: number
    isLimitadoTeto: boolean
    precoSugeridoVenda: number
    diasHistorico: number
    isManual?: boolean
}

export interface ConsultoriaResponse {
    curvaA: CurvaAResult[]
    fonte: 'historico' | 'fallback_empty'
    alerta?: string
    diasHistoricoTotal?: number
    modoEspelho?: boolean
}

export async function calcularGiroConsultoria(
    fabricaId: string,
    tabelaPreco: string,
    clienteEspelhoId?: string,
    numLojasNovo: number = 1,
    palletSize: number = 60
): Promise<ConsultoriaResponse> {
    const user = await getServerUser()
    if (!user) {
        return { curvaA: [], fonte: 'fallback_empty', alerta: 'Não autorizado.' }
    }

    if (!fabricaId || !tabelaPreco) {
        return { curvaA: [], fonte: 'fallback_empty', alerta: 'Fábrica e Perfil são obrigatórios.' }
    }

    try {
        // === Janela de 180 dias ===
        const dataCorte = new Date()
        dataCorte.setDate(dataCorte.getDate() - 180)

        let pedidoWhere: any;

        if (clienteEspelhoId) {
            // MODO SNIPER
            pedidoWhere = {
                clienteId: clienteEspelhoId,
                data: { gte: dataCorte },
                tipo: { contains: 'Venda', mode: 'insensitive' },
            }
            console.log(`[Consultoria SNIPER] Cliente ${clienteEspelhoId} | Fábrica ${fabricaId} | Lojas novo: ${numLojasNovo}`)
        } else {
            // MODO PERFIL (Dupla Checagem)
            const tabelaMap = tabelaPreco.toLowerCase().replace(/\s+/g, '');
            let tabelaFiltros: any[] = [];

            if (tabelaMap === 'atacado') {
                tabelaFiltros = [
                    { tabelaPreco: { equals: 'atacado' } },
                    { tabelaPreco: { equals: 'Atacado' } },
                    { cliente: { tabelaPreco: { equals: 'atacado' } } },
                    { cliente: { tabelaPreco: { equals: 'Atacado' } } },
                ];
            } else if (tabelaMap === 'avista') {
                tabelaFiltros = [
                    { tabelaPreco: { contains: 'vista', mode: 'insensitive' } },
                    { cliente: { tabelaPreco: { contains: 'vista', mode: 'insensitive' } } },
                ];
            } else if (tabelaMap === '50a199') {
                tabelaFiltros = [
                    { tabelaPreco: { contains: '199', mode: 'insensitive' } },
                    { cliente: { tabelaPreco: { contains: '199', mode: 'insensitive' } } },
                ];
            } else if (tabelaMap === '200a699') {
                tabelaFiltros = [
                    { tabelaPreco: { contains: '200', mode: 'insensitive' } },
                    { tabelaPreco: { contains: '699', mode: 'insensitive' } },
                    { cliente: { tabelaPreco: { contains: '200', mode: 'insensitive' } } },
                    { cliente: { tabelaPreco: { contains: '699', mode: 'insensitive' } } },
                ];
            } else if (tabelaMap === 'redes') {
                tabelaFiltros = [
                    { tabelaPreco: { contains: 'rede', mode: 'insensitive' } },
                    { cliente: { tabelaPreco: { contains: 'rede', mode: 'insensitive' } } },
                ];
            } else {
                tabelaFiltros = [
                    { tabelaPreco: { contains: tabelaPreco, mode: 'insensitive' } },
                    { cliente: { tabelaPreco: { contains: tabelaPreco, mode: 'insensitive' } } },
                ];
            }

            pedidoWhere = {
                tipo: { contains: 'Venda', mode: 'insensitive' },
                data: { gte: dataCorte },
                OR: tabelaFiltros,
            };

            console.log(`[Consultoria PERFIL] Tabela: "${tabelaPreco}" | OR: ${tabelaFiltros.length} | Lojas: ${numLojasNovo}`)
        }

        // === Buscar itens ===
        const items = await prisma.itemPedido.findMany({
            where: {
                produto: { fabricaId },
                pedido: pedidoWhere
            },
            select: {
                produtoId: true,
                quantidade: true,
                total: true,
                pedido: {
                    select: {
                        id: true,
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

        console.log(`[Consultoria] Itens encontrados: ${items.length}`)

        if (items.length === 0) {
            return {
                curvaA: [],
                fonte: 'fallback_empty',
                modoEspelho: !!clienteEspelhoId,
                alerta: clienteEspelhoId
                    ? `Nenhuma venda encontrada para o cliente espelho nos últimos 180 dias nesta fábrica.`
                    : `Nenhuma venda encontrada para esta fábrica com o perfil "${tabelaPreco}" nos últimos 180 dias.`
            }
        }

        // === Span do histórico ===
        let dataMaisAntiga: Date = new Date()
        for (const item of items) {
            const d = new Date(item.pedido.data)
            if (d < dataMaisAntiga) dataMaisAntiga = d
        }
        const hoje = new Date()
        const diffMs = hoje.getTime() - dataMaisAntiga.getTime()
        const diasHistoricoTotal = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

        // === Agrupar por produto ===
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
            pedidosUnicosSet: Set<string>
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
                    clientesUnicosSet: new Set(),
                    pedidosUnicosSet: new Set(),
                }
            }
            grouped[pid].totalQtdVendida += item.quantidade
            grouped[pid].totalFaturado += Number(item.total || 0)
            if (item.pedido.clienteId) {
                grouped[pid].clientesUnicosSet.add(item.pedido.clienteId)
            }
            if (item.pedido.id) {
                grouped[pid].pedidosUnicosSet.add(item.pedido.id)
            }
        }

        // === TOP 5 com ticket médio ===
        const topProducts: CurvaAResult[] = Object.values(grouped)
            .filter(p => p.ativo && p.totalQtdVendida > 0)
            .sort((a, b) => b.totalQtdVendida - a.totalQtdVendida)
            .slice(0, 5)
            .map(p => {
                const numClientes = p.clientesUnicosSet.size || 1
                const numPedidos = p.pedidosUnicosSet.size || 1
                const giroDiarioPorCliente = p.totalQtdVendida / diasHistoricoTotal / Math.max(1, numClientes)
                const ticketMedioCaixas = p.totalQtdVendida / Math.max(1, numPedidos)

                // Função de Escala Logística Progressiva
                let multiplicadorEscalado = numLojasNovo
                if (numLojasNovo > 10 && numLojasNovo <= 50) {
                    multiplicadorEscalado = 10 + ((numLojasNovo - 10) * 0.6)
                } else if (numLojasNovo > 50) {
                    multiplicadorEscalado = 34 + ((numLojasNovo - 50) * 0.3)
                }

                let sugestaoBase = ticketMedioCaixas * multiplicadorEscalado

                // Trava 1: Limite Logístico (Max 4 pallets)
                const tetoLogistico = Math.max(1, palletSize) * 4
                let isLimitadoTeto = false
                if (sugestaoBase > tetoLogistico) {
                    sugestaoBase = tetoLogistico
                    isLimitadoTeto = true
                }

                // Trava 2: Controle de Cobertura (Max 40 dias)
                const giroProjetado = giroDiarioPorCliente * multiplicadorEscalado
                const tetoCobertura = giroProjetado * 40 // 40 dias max
                if (giroProjetado > 0 && sugestaoBase > tetoCobertura) {
                    sugestaoBase = Math.max(giroProjetado * 20, tetoCobertura) // Mantém entre 20 e 40
                    isLimitadoTeto = true
                }

                // Prioriza preenchimento do pallet para Atacado/Redes
                let sugestaoCaixas = Math.max(1, Math.round(sugestaoBase))
                const isAtacado = tabelaPreco === 'atacado' || tabelaPreco === 'redes' || tabelaPreco === 'avista';
                if (isAtacado && palletSize > 0 && sugestaoCaixas >= palletSize / 2) {
                    sugestaoCaixas = Math.max(palletSize, Math.round(sugestaoCaixas / palletSize) * palletSize)
                }

                // Preço de gôndola estimado (40% de margem sobre a tabela varejo)
                const precoSugeridoVenda = Number(p.preco50a199) * 1.4

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
                    ticketMedioCaixas: ticketMedioCaixas,
                    sugestaoCaixas,
                    isLimitadoTeto,
                    precoSugeridoVenda,
                    diasHistorico: diasHistoricoTotal,
                }
            })

        return {
            curvaA: topProducts,
            fonte: topProducts.length > 0 ? 'historico' : 'fallback_empty',
            diasHistoricoTotal,
            modoEspelho: !!clienteEspelhoId,
            ...(topProducts.length === 0 ? {
                alerta: `Nenhum produto ativo com vendas para "${tabelaPreco}" nos últimos 180 dias.`
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
