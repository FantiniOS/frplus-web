'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export async function toggleCampanhaVinagre(status: 'ATIVA' | 'ENCERRADA') {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') {
        throw new Error("Não autorizado");
    }

    const campanha = await prisma.campanha.upsert({
        where: { slug: 'vinagre-10-off' },
        update: {
            status,
            dataEncerramento: status === 'ENCERRADA' ? new Date() : null
        },
        create: {
            slug: 'vinagre-10-off',
            nome: "10% OFF Vinagre de Álcool",
            status,
            dataInicio: new Date(),
            dataEncerramento: status === 'ENCERRADA' ? new Date() : null
        }
    });

    return campanha;
}
