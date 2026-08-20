'use server';

import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';
import { revalidatePath } from 'next/cache';

export async function salvarOverrideVolume(
    clienteId: string,
    pedidoBaseId: string,
    volumeAnteriorOverride: number
) {
    const user = await getServerUser();
    if (!user) throw new Error('Não autorizado');

    const campanha = await prisma.campanha.upsert({
        where: { slug: 'vinagre-10-off' },
        update: {},
        create: {
            slug: 'vinagre-10-off',
            nome: 'Vinagre 10% OFF',
        }
    });

    const metaCaixas = volumeAnteriorOverride > 0
        ? Math.ceil(volumeAnteriorOverride * 1.5)
        : 0;

    await prisma.metaCampanha.upsert({
        where: {
            clienteId_campanhaId: {
                clienteId,
                campanhaId: campanha.id
            }
        },
        update: {
            volumeAnteriorOverride,
            pedidoBaseId,
            metaCaixas
        },
        create: {
            clienteId,
            campanhaId: campanha.id,
            volumeAnteriorOverride,
            pedidoBaseId,
            metaCaixas
        }
    });

    revalidatePath('/dashboard/campanhas/vinagre-10-off');

    return { success: true, metaCaixas, volumeAnteriorOverride };
}
