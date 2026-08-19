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

// Helper: verifica se o nome do produto corresponde a "Vinagre de Álcool 750ml"
function isVinagre750ml(nomeProduto: string): boolean {
    const lower = nomeProduto.toLowerCase();
    return lower.includes('vinagre') &&
           (lower.includes('álcool') || lower.includes('alcool') || lower.includes('lcool')) &&
           nomeProduto.includes('750');
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
        const clientesAtacado = await prisma.cliente.findMany({
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
                        }
                    },
                    include: {
                        itens: {
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

        // ===================================================================
        // PASSO 2: Para cada cliente, buscar o ÚLTIMO pedido (qualquer pedido,
        // não apenas da campanha) que contenha Vinagre de Álcool 750ml.
        // Isso nos dá o "Volume Anterior" para calcular a meta.
        // ===================================================================
        const clienteIds = clientesAtacado.map(c => c.id);

        // Busca TODOS os pedidos desses clientes que contenham Vinagre 750ml,
        // ordenados por data DESC para pegar o mais recente primeiro.
        const pedidosComVinagre = await prisma.pedido.findMany({
            where: {
                clienteId: { in: clienteIds },
                status: { notIn: ['Cancelado'] },
                itens: {
                    some: {
                        produto: {
                            nome: { contains: 'Vinagre', mode: 'insensitive' }
                        }
                    }
                }
            },
            include: {
                itens: {
                    include: {
                        produto: true
                    }
                }
            },
            orderBy: {
                data: 'desc'
            }
        });

        // Mapa: clienteId -> { volumeAnterior, dataUltimaCompra }
        // Pegamos APENAS o primeiro pedido encontrado (o mais recente) por cliente
        const mapaUltimaCompra = new Map<string, { volumeAnterior: number; dataUltimaCompra: string }>();

        for (const pedido of pedidosComVinagre) {
            if (mapaUltimaCompra.has(pedido.clienteId)) {
                continue; // Já encontramos o mais recente desse cliente
            }

            // Isolar APENAS os itens de Vinagre de Álcool 750ml nesse pedido
            let qtdVinagre = 0;
            for (const item of pedido.itens) {
                const nomeProduto = item.produto?.nome || '';
                if (isVinagre750ml(nomeProduto)) {
                    qtdVinagre += item.quantidade;
                }
            }

            if (qtdVinagre > 0) {
                mapaUltimaCompra.set(pedido.clienteId, {
                    volumeAnterior: qtdVinagre,
                    dataUltimaCompra: pedido.data.toISOString()
                });
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
            cliente.pedidos.forEach(pedido => {
                receitaGerada += Number(pedido.valorTotal);
                pedido.itens.forEach(item => {
                    const nomeProduto = item.produto?.nome || '';
                    if (isVinagre750ml(nomeProduto)) {
                        volumeComprado += item.quantidade;
                    }
                });
            });

            // Add to global totals
            volumeTotalEscoado += volumeComprado;
            receitaTotalGerada += receitaGerada;

            const comprou = cliente.pedidos.length > 0;
            if (comprou) {
                clientesConvertidos++;
            }

            // ---- NOVA LÓGICA DE META ----
            // Pega dados da última compra deste cliente
            const dadosUltimaCompra = mapaUltimaCompra.get(cliente.id);
            const volumeAnterior = dadosUltimaCompra?.volumeAnterior || 0;
            const dataUltimaCompra = dadosUltimaCompra?.dataUltimaCompra || null;

            // Meta = Volume Anterior * 1.5, arredondado para cima
            const metaCalculada = volumeAnterior > 0 ? Math.ceil(volumeAnterior * 1.5) : 0;

            // Usa a meta calculada automaticamente.
            // Se houver meta manual salva no banco (metasCampanhas), prevalece a MAIOR entre as duas.
            const metaManual = cliente.metasCampanhas?.[0]?.metaCaixas || 0;
            const metaCaixas = metaCalculada > 0 ? metaCalculada : metaManual;

            const metaAlcancada = metaCaixas > 0 && volumeComprado >= metaCaixas;

            return {
                id: cliente.id,
                nomeFantasia: cliente.nomeFantasia || 'Sem Nome',
                razaoSocial: cliente.razaoSocial || 'Sem Nome',
                cidade: cliente.cidade || '-',
                telefone: cliente.telefone || '',
                celular: cliente.celular || '',
                statusCampanha: comprou ? 'Aproveitou' : 'Pendente',
                volumeComprado,
                receitaGerada,
                ultimaAcao: comprou ? cliente.pedidos[0].data.toISOString() : null,
                pedidosDaCampanha: cliente.pedidos,
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
                return a.nomeFantasia.localeCompare(b.nomeFantasia);
            } else {
                return b.volumeComprado - a.volumeComprado;
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
        console.error("SERVER ACTION ERROR:", error);
        return { error: error.message || "Erro desconhecido", details: error };
    }
}
