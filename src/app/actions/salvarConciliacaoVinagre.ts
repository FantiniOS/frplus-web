'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export async function salvarConciliacaoVinagre(vincular: string[], desvincular: string[]) {
    const user = await getServerUser();
    if (!user) throw new Error('Não autorizado');

    await prisma.$transaction(async (tx) => {
        if (vincular && vincular.length > 0) {
            await tx.pedido.updateMany({
                where: { id: { in: vincular } },
                data: { campanha10OffAplicada: true }
            });
        }

        if (desvincular && desvincular.length > 0) {
            await tx.pedido.updateMany({
                where: { id: { in: desvincular } },
                data: { campanha10OffAplicada: false }
            });
        }
    });

    return { success: true };
}
