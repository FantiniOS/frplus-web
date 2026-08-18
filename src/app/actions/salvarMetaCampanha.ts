'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';
import { revalidatePath } from 'next/cache';

export async function salvarMetaCampanha(clienteId: string, slug: string, metaCaixas: number) {
    const user = await getServerUser();
    if (!user) {
        throw new Error("Não autorizado");
    }

    // Upsert the Campanha to ensure it exists
    const campanha = await prisma.campanha.upsert({
        where: { slug },
        update: {},
        create: {
            slug,
            nome: slug === 'vinagre-10-off' ? 'Vinagre 10% OFF' : slug,
        }
    });

    // Upsert the MetaCampanha for this client and campaign
    await prisma.metaCampanha.upsert({
        where: {
            clienteId_campanhaId: {
                clienteId,
                campanhaId: campanha.id
            }
        },
        update: {
            metaCaixas
        },
        create: {
            clienteId,
            campanhaId: campanha.id,
            metaCaixas
        }
    });

    // Revalidate the page
    revalidatePath(`/dashboard/campanhas/${slug}`);
    
    return { success: true };
}
