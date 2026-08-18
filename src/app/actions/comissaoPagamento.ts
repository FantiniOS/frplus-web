'use server'

import { prisma } from '@/lib/prisma'

export async function togglePagamentoComissao(pedidoId: string) {
    const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { pagoAoVendedor: true },
    })

    if (!pedido) {
        throw new Error('Pedido não encontrado')
    }

    const novoStatus = !pedido.pagoAoVendedor

    const updated = await prisma.pedido.update({
        where: { id: pedidoId },
        data: {
            pagoAoVendedor: novoStatus,
            dataPagamentoAoVendedor: novoStatus ? new Date() : null,
        },
        select: {
            pagoAoVendedor: true,
            dataPagamentoAoVendedor: true,
        },
    })

    return updated
}
