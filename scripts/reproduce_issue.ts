
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Fetch the first order
        const order = await prisma.pedido.findFirst({
            include: { itens: true }
        });

        if (!order) {
            console.log('No orders found to test.');
            return;
        }

        console.log(`Testing with Order ID: ${order.id}`);
        console.log(`Current Tipo: ${order.tipo}`);

        // 2. Prepare update payload (simulating what the frontend sends)
        // We must re-send items because the PUT route replaces them
        const updatePayload = {
            clienteId: order.clienteId,
            tipo: 'Bonificacao', // The change we want
            status: order.status,
            observacoes: order.observacoes,
            valorTotal: order.valorTotal,
            tabelaPreco: order.tabelaPreco,
            condicaoPagamento: order.condicaoPagamento,
            itens: {
                create: order.itens.map(i => ({
                    produtoId: i.produtoId,
                    quantidade: i.quantidade,
                    precoUnitario: i.precoUnitario,
                    total: i.total
                }))
            }
        };

        console.log('Attempting update via Prisma directly...');

        // 3. Execute Transaction (mimicking the API route)
        await prisma.$transaction([
            prisma.itemPedido.deleteMany({ where: { pedidoId: order.id } }),
            prisma.pedido.update({
                where: { id: order.id },
                data: updatePayload
            })
        ]);

        // 4. Verify
        const updatedOrder = await prisma.pedido.findUnique({ where: { id: order.id } });
        console.log(`Updated Tipo: ${updatedOrder?.tipo}`);

        if (updatedOrder?.tipo === 'Bonificacao') {
            console.log('SUCCESS: Backend update worked.');
        } else {
            console.log('FAILURE: Backend update did not persist change.');
        }

    } catch (error) {
        console.error('ERROR during test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
