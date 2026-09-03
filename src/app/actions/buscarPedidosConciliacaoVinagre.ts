'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export interface PedidoConciliacaoVinagre {
    id: string;
    data: string;
    status: string;
    qtdVinagre: number;
    numeroPedido: string;
    isLinked: boolean;
}

const CODIGOS_VINAGRE = ['10.01.03.10', '10.01.03.11'];

export async function buscarPedidosConciliacaoVinagre(clienteId: string): Promise<PedidoConciliacaoVinagre[]> {
    const user = await getServerUser();
    if (!user) throw new Error('Não autorizado');

    const pedidos = await prisma.pedido.findMany({
        where: {
            clienteId,
            status: { not: 'Cancelado' },
            tipo: { notIn: ['Bonificacao', 'Bonificação', 'bonificacao', 'bonificação', 'BONIFICACAO', 'BONIFICAÇÃO'] },
            itens: {
                some: {
                    produto: { codigo: { in: CODIGOS_VINAGRE } }
                }
            }
        },
        include: {
            itens: {
                where: {
                    produto: { codigo: { in: CODIGOS_VINAGRE } }
                },
                include: { produto: true }
            }
        },
        orderBy: { data: 'desc' }
    });

    return pedidos.map(p => {
        let qtdVinagre = 0;
        if (Array.isArray(p.itens)) {
            for (const item of p.itens) {
                qtdVinagre += Number(item.quantidade) || 0;
            }
        }
        return {
            id: p.id,
            data: p.data instanceof Date ? p.data.toISOString() : String(p.data),
            status: p.status || '-',
            qtdVinagre,
            numeroPedido: p.id.slice(-8).toUpperCase(),
            isLinked: p.campanha10OffAplicada === true
        };
    });
}
