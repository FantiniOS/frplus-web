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
}

export interface ApuracaoDashboardData {
    clientesAtacadistasBase: number;
    clientesConvertidos: number;
    taxaConversao: number;
    volumeTotalEscoado: number;
    receitaTotalGerada: number;
    hitList: HitListClient[];
}

export async function getHitListVinagre(dataInicio: string, dataFim: string): Promise<ApuracaoDashboardData> {
    const user = await getServerUser();
    if (!user) {
        throw new Error("Não autorizado");
    }

    const start = new Date(dataInicio);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dataFim);
    end.setHours(23, 59, 59, 999);

    // PASSO 1: A LÓGICA DE DADOS (PRISMA QUERY)
    // Busque TODOS os clientes ativos onde o canal/segmento seja "ATACADO".
    // Aqui usamos a tabela de preço para definir o canal, já que não temos um campo 'canal' explícito.
    const clientesAtacado = await prisma.cliente.findMany({
        where: {
            status: 'Ativo',
            tabelaPreco: {
                in: ['atacado', 'atacadoAVista', 'avista', 'atacado a vista', 'Atacado a Vista', 'Atacado A Vista']
            }
        },
        // Faça um "Left Join" para trazer os pedidos desse cliente ONDE campanha10OffAplicada === true
        include: {
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

    let volumeTotalEscoado = 0;
    let receitaTotalGerada = 0;
    let clientesConvertidos = 0;

    const hitList: HitListClient[] = clientesAtacado.map(cliente => {
        let volumeComprado = 0;
        let receitaGerada = 0;

        cliente.pedidos.forEach(pedido => {
            receitaGerada += Number(pedido.valorTotal);
            pedido.itens.forEach(item => {
                // Check if product is Vinagre de Alcool 750ml
                const nomeProduto = item.produto?.nome || '';
                if (nomeProduto.toLowerCase().includes('vinagre') && 
                    nomeProduto.toLowerCase().includes('álcool') && 
                    nomeProduto.includes('750')) {
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
            pedidosDaCampanha: cliente.pedidos
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
}
