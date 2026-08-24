'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export interface HitListClient {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    comprador: string | null;
    cidade: string;
    telefone: string;
    celular: string;
    statusCampanha: 'Pendente' | 'Aproveitou';
    receitaGerada: number;
    ultimaAcao: string | null;
    pedidosDaCampanha: any[];
    metaAlcancada: boolean;
    // VARIÁVEIS ARQUITETURAIS ISOLADAS
    volumeBase: number;       
    meta: number;
    volumeRealizado: number;
    //
    dataUltimaCompra: string | null; 
    precoTabela: number;          
}

export interface ApuracaoDashboardData {
    clientesAtacadistasBase: number;
    clientesConvertidos: number;
    taxaConversao: number;
    volumeTotalBase: number;      // NOVO: Soma de todo o histórico congelado
    metaGlobal: number;           // NOVO: Soma de todas as metas projetadas
    volumeTotalEscoado: number;   // EVOLUÇÃO (volumeRealizado global)
    receitaTotalGerada: number;
    hitList: HitListClient[];
    campanhaAtiva: boolean;
}

// Helper: verifica se o código do produto corresponde a "Vinagre de Álcool 750ml"
function isVinagre750ml(codigoProduto: string | null | undefined): boolean {
    if (!codigoProduto) return false;
    return codigoProduto === '10.01.03.10';
}

function safeToISOString(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    try {
        if (date instanceof Date) return date.toISOString();
        return new Date(date).toISOString();
    } catch {
        return null;
    }
}

export async function getHitListVinagre(): Promise<ApuracaoDashboardData | { error: string, details?: any }> {
    try {
        const user = await getServerUser();
        if (!user) {
            throw new Error("Não autorizado");
        }

        const campanhaDb = await prisma.campanha.findUnique({ where: { slug: 'vinagre-10-off' } });
        if (!campanhaDb) {
            throw new Error("Campanha não encontrada no banco de dados.");
        }
        
        const campanhaAtiva = campanhaDb.status === 'ATIVA';
        const dataCorte = campanhaDb.dataInicio; // O MARCO ZERO DA CAMPANHA

        // ===================================================================
        // PASSO 1: Filtro Exclusivo de Segmento + EVOLUÇÃO (volumeRealizado)
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
                    // Garantimos que a evolução é baseada EXCLUSIVAMENTE na alocação manual.
                    // Nada de soma automática por datas.
                    pedidos: {
                        where: {
                            campanha10OffAplicada: true,
                            tipo: 'Venda',
                            itens: {
                                some: { 
                                    produto: { codigo: '10.01.03.10' },
                                    precoUnitario: { gt: 0 }
                                }
                            }
                        },
                        include: {
                            itens: {
                                where: {
                                    produto: { codigo: '10.01.03.10' },
                                    precoUnitario: { gt: 0 }
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

        if (!clientesAtacado || clientesAtacado.length === 0) {
            return {
                clientesAtacadistasBase: 0,
                clientesConvertidos: 0,
                taxaConversao: 0,
                volumeTotalBase: 0,
                metaGlobal: 0,
                volumeTotalEscoado: 0,
                receitaTotalGerada: 0,
                hitList: [],
                campanhaAtiva
            };
        }

        const clienteIds = clientesAtacado.map(c => c.id);

        // ===================================================================
        // PASSO 2: CONGELAMENTO DO HISTÓRICO (volumeBase)
        // ===================================================================
        let pedidosComVinagre: any[] = [];
        try {
            // Busca pedidos HISTÓRICOS (ANTERIORES à dataCorte)
            pedidosComVinagre = await prisma.pedido.findMany({
                where: {
                    clienteId: { in: clienteIds },
                    status: { notIn: ['Cancelado'] },
                    tipo: 'Venda',
                    data: { lt: dataCorte }, // REQUISITO: ANTES DA DATA DE ATIVAÇÃO
                    campanha10OffAplicada: { not: true },
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

        const mapaUltimaCompra = new Map<string, { volumeBase: number; dataUltimaCompra: string | null }>();

        if (pedidosComVinagre && pedidosComVinagre.length > 0) {
            for (const pedido of pedidosComVinagre) {
                const pedidoClienteId = pedido?.clienteId;
                if (!pedidoClienteId) continue;
                if (mapaUltimaCompra.has(pedidoClienteId)) continue; 

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
                        volumeBase: qtdVinagre,
                        dataUltimaCompra: safeToISOString(pedido?.data)
                    });
                }
            }
        }

        let volumeTotalEscoado = 0; // Evolução Realizada
        let receitaTotalGerada = 0;
        let clientesConvertidos = 0;
        let volumeTotalBase = 0;
        let metaGlobal = 0;

        const produtoVinagre = await prisma.produto.findFirst({
            where: { codigo: '10.01.03.10' }
        });

        const hitList: HitListClient[] = clientesAtacado.map(cliente => {
            let volumeRealizado = 0;
            let receitaGerada = 0;

            let precoTabela = 0;
            if (produtoVinagre) {
                const tabStr = (cliente.tabelaPreco || '').toLowerCase().trim();
                if (tabStr === 'atacado a vista' || tabStr === 'atacadoavista' || tabStr === 'avista') {
                    precoTabela = Number(produtoVinagre.precoAtacadoAVista || 0);
                } else if (tabStr.includes('atacado')) {
                    precoTabela = Number(produtoVinagre.precoAtacado || 0);
                } else if (tabStr.includes('rede')) {
                    precoTabela = Number(produtoVinagre.precoRedes || 0);
                } else if (tabStr.includes('200a699')) {
                    precoTabela = Number(produtoVinagre.preco200a699 || 0);
                } else {
                    precoTabela = Number(produtoVinagre.preco50a199 || 0);
                }
            }

            const pedidosCliente = Array.isArray(cliente?.pedidos) ? cliente.pedidos : [];

            pedidosCliente.forEach((pedido: any) => {
                const itensPedido = Array.isArray(pedido?.itens) ? pedido.itens : [];
                itensPedido.forEach((item: any) => {
                    const codigoProduto = item?.produto?.codigo ?? '';
                    if (isVinagre750ml(codigoProduto)) {
                        const qtd = Number(item?.quantidade) || 0;
                        volumeRealizado += qtd;
                        
                        let valorItem = Number(item?.total) || 0;
                        if (valorItem === 0) {
                            valorItem = qtd * (Number(item?.precoUnitario) || precoTabela);
                        }
                        receitaGerada += valorItem;
                    }
                });
            });

            volumeTotalEscoado += volumeRealizado;
            receitaTotalGerada += receitaGerada;

            const comprou = pedidosCliente.length > 0;
            if (comprou) {
                clientesConvertidos++;
            }

            const dadosUltimaCompra = mapaUltimaCompra.get(cliente.id) ?? null;
            const metasCampanhas = Array.isArray(cliente?.metasCampanhas) ? cliente.metasCampanhas : [];
            const overrideVolume = metasCampanhas?.[0]?.volumeAnteriorOverride;

            const volumeBase = overrideVolume != null
                ? Number(overrideVolume)
                : (dadosUltimaCompra?.volumeBase ?? 0);
            const dataUltimaCompra = dadosUltimaCompra?.dataUltimaCompra ?? null;

            const metaCalculada = volumeBase > 0 ? Math.ceil(volumeBase * 1.5) : 0;
            const metaManual = Number(metasCampanhas?.[0]?.metaCaixas) || 0;
            const meta = metaCalculada > 0 ? metaCalculada : metaManual;

            volumeTotalBase += volumeBase;
            metaGlobal += meta;

            const metaAlcancada = meta > 0 && volumeRealizado >= meta;

            let ultimaAcao: string | null = null;
            if (comprou && pedidosCliente[0]?.data) {
                ultimaAcao = safeToISOString(pedidosCliente[0].data);
            }

            return {
                id: cliente.id ?? '',
                nomeFantasia: cliente.nomeFantasia || 'Sem Nome',
                razaoSocial: cliente.razaoSocial || 'Sem Nome',
                cnpj: cliente.cnpj || '-',
                comprador: cliente.comprador || null,
                cidade: cliente.cidade || '-',
                telefone: cliente.telefone || '',
                celular: cliente.celular || '',
                statusCampanha: comprou ? 'Aproveitou' as const : 'Pendente' as const,
                volumeRealizado,
                receitaGerada,
                ultimaAcao,
                pedidosDaCampanha: pedidosCliente,
                meta,
                metaAlcancada,
                volumeBase,
                dataUltimaCompra,
                precoTabela
            };
        });

        hitList.sort((a, b) => {
            if (a.statusCampanha === 'Pendente' && b.statusCampanha === 'Aproveitou') return -1;
            if (a.statusCampanha === 'Aproveitou' && b.statusCampanha === 'Pendente') return 1;
            
            if (a.statusCampanha === 'Pendente') {
                return (a.nomeFantasia || '').localeCompare(b.nomeFantasia || '');
            } else {
                return (b.volumeRealizado || 0) - (a.volumeRealizado || 0);
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
            volumeTotalBase,
            metaGlobal,
            volumeTotalEscoado,
            receitaTotalGerada,
            hitList,
            campanhaAtiva
        };
    } catch (error: any) {
        console.error("SERVER ACTION ERROR:", error?.message || error);
        return { error: error?.message || "Erro desconhecido" };
    }
}
