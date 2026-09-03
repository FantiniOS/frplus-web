'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export async function salvarConciliacaoVinagre(operacoes: { pedidoId: string, produtos: string[] }[]) {
    const user = await getServerUser();
    if (!user) throw new Error('Não autorizado');

    await prisma.$transaction(async (tx) => {
        for (const op of operacoes) {
            const hasProdutos = op.produtos.length > 0;
            await tx.pedido.update({
                where: { id: op.pedidoId },
                data: { 
                    campanha10OffAplicada: hasProdutos,
                    campanhaVinagreProdutos: hasProdutos ? op.produtos.join(',') : null
                }
            });
        }
    });

    return { success: true };
}
