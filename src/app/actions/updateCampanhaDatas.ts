'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export async function updateCampanhaDatas(slug: string, dataInicio: string, dataFim: string) {
    const user = await getServerUser();
    if (!user) throw new Error("Não autorizado");

    const start = new Date(dataInicio);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dataFim);
    end.setHours(23, 59, 59, 999);

    const campanha = await prisma.campanha.upsert({
        where: { slug },
        update: {
            dataInicio: start,
            dataEncerramento: end,
        },
        create: {
            slug,
            nome: "10% OFF Vinagre de Álcool",
            dataInicio: start,
            dataEncerramento: end,
            status: "ATIVA"
        }
    });

    return campanha;
}
