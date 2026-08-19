'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export interface HitListClient {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cidade: string;
    telefone: string;
    celular: string;
    statusCampanha: 'Pendente' | 'Aproveitou';
    volumeComprado: number;
    receitaGerada: number;
    ultimaAcao: string | null;
    pedidosDaCampanha: any[];
    metaCaixas: number;
    metaAlcancada: boolean;
    // Novos campos de dados da regra de negócio
    volumeAnterior: number;       // Qtd de Vinagre 750ml no ÚLTIMO pedido do cliente
    dataUltimaCompra: string | null; // Data do último pedido que continha Vinagre 750ml
}

export interface ApuracaoDashboardData {
    clientesAtacadistasBase: number;
    clientesConvertidos: number;
    taxaConversao: number;
    volumeTotalEscoado: number;
    receitaTotalGerada: number;
    hitList: HitListClient[];
}

// Helper: verifica se o código do produto corresponde a "Vinagre de Álcool 750ml"
function isVinagre750ml(codigoProduto: string | null | undefined): boolean {
    if (!codigoProduto) return false;
    return codigoProduto === '10.01.03.10';
}

// Helper: converte Date para ISO string de forma segura
function safeToISOString(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    try {
        if (date instanceof Date) return date.toISOString();
        return new Date(date).toISOString();
    } catch {
        return null;
    }
}

export async function getHitListVinagre(dataInicio: string, dataFim: string): Promise<ApuracaoDashboardData | { error: string, details?: any }> {
    try {
        const user = await getServerUser();
        if (!user) {
            throw new Error("Não autorizado");
        }

        const start = new Date(dataInicio);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dataFim);
        end.setHours(23, 59, 59, 999);

        // ===================================================================
        // PASSO 1: Filtro Exclusivo de Segmento
        // Busca APENAS clientes ativos com tabelaPreco = ATACADO ou ATACADO A VISTA
        // ===================================================================
        let clientesAtacado: any[] = [];
        try {
            clientesAtacado = await prisma.cliente.findMany({
                where: {
                    status: 'Ativo',
                    tabelaPreco: {
                        in: ['atacado', 'atacadoAVista', 'avista', 'atacado a vista', 'Atacado a Vista', 'Atacado A Vista']
                    }
                },
                include: {
                    metasCampanhas: {
                        where: {
                            campanha: { slug: 'vinagre-10-off' }
                        }
                    },
                    // Pedidos da campanha (com flag campanha10OffAplicada) no período
                    pedidos: {
                        where: {
                            campanha10OffAplicada: true,
                            data: {
                                gte: start,
                                lte: end
                            },
                            itens: {
                                some: { produto: { codigo: '10.01.03.10' } }
                            }
                        },
                        include: {
                            itens: {
                                where: {
                                    produto: { codigo: '10.01.03.10' }
                                },
                                include: {
                                    produto: true
                                }
                            }
                        },
                        orderBy: {
                            data: 'desc'
                        }
                    }
                }
            });
        } catch (dbError: any) {
            console.error("ERRO Prisma (clientes atacado):", dbError?.message || dbError);
            clientesAtacado = [];
        }

        // Se não encontrou clientes, retorna dados zerados sem quebrar
        if (!clientesAtacado || clientesAtacado.length === 0) {
            return {
                clientesAtacadistasBase: 0,
                clientesConvertidos: 0,
                taxaConversao: 0,
                volumeTotalEscoado: 0,
                receitaTotalGerada: 0,
                hitList: []
            };
        }

        // ===================================================================
        // PASSO 2: Para cada cliente, buscar o ÚLTIMO pedido (qualquer pedido,
        // não apenas da campanha) que contenha Vinagre de Álcool 750ml.
        // Isso nos dá o "Volume Anterior" para calcular a meta.
        // ===================================================================
        const clienteIds = clientesAtacado.map(c => c.id);

        let pedidosComVinagre: any[] = [];
        try {
            // Busca TODOS os pedidos desses clientes que contenham Vinagre 750ml,
            // ordenados por data DESC para pegar o mais recente primeiro.
            pedidosComVinagre = await prisma.pedido.findMany({
                where: {
                    clienteId: { in: clienteIds },
                    status: { notIn: ['Cancelado'] },
                    itens: {
                        some: {
                            produto: {
                                codigo: '10.01.03.10'
                            }
                        }
                    }
                },
                include: {
                    itens: {
                        where: {
                            produto: { codigo: '10.01.03.10' }
                        },
                        include: {
                            produto: true
                        }
                    }
                },
                orderBy: {
                    data: 'desc'
                }
            });
        } catch (dbError: any) {
            console.error("ERRO Prisma (pedidos com vinagre):", dbError?.message || dbError);
            pedidosComVinagre = [];
        }

        // Mapa: clienteId -> { volumeAnterior, dataUltimaCompra }
        // Pegamos APENAS o primeiro pedido encontrado (o mais recente) por cliente
        const mapaUltimaCompra = new Map<string, { volumeAnterior: number; dataUltimaCompra: string | null }>();

        if (pedidosComVinagre && pedidosComVinagre.length > 0) {
            for (const pedido of pedidosComVinagre) {
                const pedidoClienteId = pedido?.clienteId;
                if (!pedidoClienteId) continue;
                if (mapaUltimaCompra.has(pedidoClienteId)) continue; // Já encontramos o mais recente

                // Isolar APENAS os itens de Vinagre de Álcool 750ml nesse pedido
                let qtdVinagre = 0;
                const itens = pedido?.itens;
                if (Array.isArray(itens)) {
                    for (const item of itens) {
                        const codigoProduto = item?.produto?.codigo ?? '';
                        if (isVinagre750ml(codigoProduto)) {
                            qtdVinagre += (Number(item?.quantidade) || 0);
                        }
                    }
                }

                if (qtdVinagre > 0) {
                    mapaUltimaCompra.set(pedidoClienteId, {
                        volumeAnterior: qtdVinagre,
                        dataUltimaCompra: safeToISOString(pedido?.data)
                    });
                }
            }
        }

        // ===================================================================
        // PASSO 3 e 4: Montar a hitList com a meta calculada (+50%)
        // ===================================================================
        let volumeTotalEscoado = 0;
        let receitaTotalGerada = 0;
        let clientesConvertidos = 0;

        const hitList: HitListClient[] = clientesAtacado.map(cliente => {
            let volumeComprado = 0;
            let receitaGerada = 0;

            // Calcula volume de vinagre comprado na campanha atual
            const pedidosCliente = Array.isArray(cliente?.pedidos) ? cliente.pedidos : [];

            pedidosCliente.forEach((pedido: any) => {
                receitaGerada += (Number(pedido?.valorTotal) || 0);
                const itensPedido = Array.isArray(pedido?.itens) ? pedido.itens : [];
                itensPedido.forEach((item: any) => {
                    const codigoProduto = item?.produto?.codigo ?? '';
                    if (isVinagre750ml(codigoProduto)) {
                        volumeComprado += (Number(item?.quantidade) || 0);
                    }
                });
            });

            // Add to global totals
            volumeTotalEscoado += volumeComprado;
            receitaTotalGerada += receitaGerada;

            const comprou = pedidosCliente.length > 0;
            if (comprou) {
                clientesConvertidos++;
            }

            // ---- LÓGICA DE META (com proteção de nulos) ----
            const dadosUltimaCompra = mapaUltimaCompra.get(cliente.id) ?? null;
            const volumeAnterior = (dadosUltimaCompra?.volumeAnterior ?? 0);
            const dataUltimaCompra = dadosUltimaCompra?.dataUltimaCompra ?? null;

            // Meta = Volume Anterior * 1.5, arredondado para cima
            // Se volumeAnterior === 0 (cliente nunca comprou), meta = 0
            const metaCalculada = volumeAnterior > 0 ? Math.ceil(volumeAnterior * 1.5) : 0;

            // Usa a meta calculada automaticamente.
            // Se houver meta manual salva no banco (metasCampanhas), prevalece como fallback.
            const metasCampanhas = Array.isArray(cliente?.metasCampanhas) ? cliente.metasCampanhas : [];
            const metaManual = Number(metasCampanhas?.[0]?.metaCaixas) || 0;
            const metaCaixas = metaCalculada > 0 ? metaCalculada : metaManual;

            const metaAlcancada = metaCaixas > 0 && volumeComprado >= metaCaixas;

            // ultimaAcao: data do primeiro pedido (mais recente) da campanha
            let ultimaAcao: string | null = null;
            if (comprou && pedidosCliente[0]?.data) {
                ultimaAcao = safeToISOString(pedidosCliente[0].data);
            }

            return {
                id: cliente.id ?? '',
                nomeFantasia: cliente.nomeFantasia || 'Sem Nome',
                razaoSocial: cliente.razaoSocial || 'Sem Nome',
                cidade: cliente.cidade || '-',
                telefone: cliente.telefone || '',
                celular: cliente.celular || '',
                statusCampanha: comprou ? 'Aproveitou' as const : 'Pendente' as const,
                volumeComprado,
                receitaGerada,
                ultimaAcao,
                pedidosDaCampanha: pedidosCliente,
                metaCaixas,
                metaAlcancada,
                // Novos campos
                volumeAnterior,
                dataUltimaCompra
            };
        });

        // Ordenar: Pendentes no TOPO, e secundariamente por ordem alfabética.
        // Entre os que aproveitaram, quem comprou mais primeiro.
        hitList.sort((a, b) => {
            if (a.statusCampanha === 'Pendente' && b.statusCampanha === 'Aproveitou') return -1;
            if (a.statusCampanha === 'Aproveitou' && b.statusCampanha === 'Pendente') return 1;
            
            if (a.statusCampanha === 'Pendente') {
                return (a.nomeFantasia || '').localeCompare(b.nomeFantasia || '');
            } else {
                return (b.volumeComprado || 0) - (a.volumeComprado || 0);
            }
        });

        const clientesAtacadistasBase = clientesAtacado.length;
        const taxaConversao = clientesAtacadistasBase > 0 
            ? Math.round((clientesConvertidos / clientesAtacadistasBase) * 100) 
            : 0;

        return {
            clientesAtacadistasBase,
            clientesConvertidos,
            taxaConversao,
            volumeTotalEscoado,
            receitaTotalGerada,
            hitList
        };
    } catch (error: any) {
        console.error("SERVER ACTION ERROR:", error?.message || error);
        return { error: error?.message || "Erro desconhecido" };
    }
}
