'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export interface PedidoVinagre {
    id: string;
    data: string;
    status: string;
    tipo: string;
    qtdVinagre: number;
    numeroPedido: string;
}

export async function buscarPedidosVinagre(clienteId: string): Promise<PedidoVinagre[]> {
    const user = await getServerUser();
    if (!user) throw new Error('Não autorizado');

    const pedidos = await prisma.pedido.findMany({
        where: {
            clienteId,
            status: { not: 'Cancelado' },
            itens: {
                some: {
                    produto: { codigo: '10.01.03.10' }
                }
            }
        },
        include: {
            itens: {
                where: {
                    produto: { codigo: '10.01.03.10' }
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
            tipo: p.tipo || 'Venda',
            qtdVinagre,
            numeroPedido: p.id.slice(-8).toUpperCase()
        };
    });
}
