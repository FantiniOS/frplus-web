'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export interface PedidoConciliacaoVinagre {
    id: string;
    data: string;
    status: string;
    qtdVinagre: number;
    qtdAlcool: number;    // 10.01.03.10
    qtdColorido: number;  // 10.01.03.11
    numeroPedido: string;
    isLinked: boolean;
    produtosVinculados: string[];
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
        let qtdAlcool = 0;
        let qtdColorido = 0;
        if (Array.isArray(p.itens)) {
            for (const item of p.itens) {
                const codigo = (item as any).produto?.codigo ?? '';
                const qtd = Number(item.quantidade) || 0;
                if (codigo === '10.01.03.10') qtdAlcool += qtd;
                else if (codigo === '10.01.03.11') qtdColorido += qtd;
            }
        }
        
        let produtosVinculados: string[] = [];
        if (p.campanha10OffAplicada) {
            if (p.campanhaVinagreProdutos) {
                produtosVinculados = p.campanhaVinagreProdutos.split(',');
            } else {
                // Retrocompatibilidade: se aplicou antes de ter o campo de granularidade, conta todos que tiverem qtd
                if (qtdAlcool > 0) produtosVinculados.push('10.01.03.10');
                if (qtdColorido > 0) produtosVinculados.push('10.01.03.11');
            }
        }

        return {
            id: p.id,
            data: p.data instanceof Date ? p.data.toISOString() : String(p.data),
            status: p.status || '-',
            qtdVinagre: (produtosVinculados.includes('10.01.03.10') ? qtdAlcool : 0) + (produtosVinculados.includes('10.01.03.11') ? qtdColorido : 0),
            qtdAlcool,
            qtdColorido,
            numeroPedido: p.id.slice(-8).toUpperCase(),
            isLinked: p.campanha10OffAplicada === true,
            produtosVinculados
        };
    });
}
