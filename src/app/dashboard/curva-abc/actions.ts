'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export async function buscarClientesParaSelect() {
    try {
        const user = await getServerUser();
        if (!user) return [];

        const clientes = await prisma.cliente.findMany({
            where: {
                status: 'Ativo'
            },
            select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                cnpj: true
            },
            orderBy: {
                nomeFantasia: 'asc'
            }
        });

        return clientes;
    } catch (error) {
        console.error("Erro ao buscar clientes para select:", error);
        return [];
    }
}

export async function buscarFabricasParaSelect() {
    try {
        const user = await getServerUser();
        if (!user) return [];

        const fabricas = await prisma.fabrica.findMany({
            select: {
                id: true,
                nome: true
            },
            orderBy: {
                nome: 'asc'
            }
        });

        return fabricas;
    } catch (error) {
        console.error("Erro ao buscar fábricas para select:", error);
        return [];
    }
}
