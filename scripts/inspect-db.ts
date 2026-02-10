
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Inspecting Database Data ---');

    // 1. Check Total Counts
    const clientCount = await prisma.cliente.count();
    const orderCount = await prisma.pedido.count();
    const productCount = await prisma.produto.count();

    console.log(`Clientes: ${clientCount}`);
    console.log(`Pedidos: ${orderCount}`);
    console.log(`Produtos: ${productCount}`);

    if (orderCount === 0) {
        console.log('WARNING: No orders found. Import might have failed or reset was done without import.');
        return;
    }

    // 2. Check 5 Most Recent Orders
    console.log('\n--- Top 5 Recent Orders ---');
    const recentOrders = await prisma.pedido.findMany({
        take: 5,
        orderBy: { data: 'desc' },
        include: { cliente: true }
    });

    recentOrders.forEach(o => {
        console.log(`Order ${o.id} | Date: ${o.data.toISOString()} | Client: ${o.cliente?.nomeFantasia} (${o.cliente?.cnpj}) | Total: ${o.valorTotal}`);
    });

    // 3. Check specific clients that might be flagged as inactive incorrectly
    // Let's just pick one client from the recent orders and see if the AI API query would find them.
    if (recentOrders.length > 0) {
        const sampleClientId = recentOrders[0].clienteId;
        console.log(`\n--- Analyzing Client ${sampleClientId} (${recentOrders[0].cliente?.nomeFantasia}) ---`);

        const clientWithOrders = await prisma.cliente.findUnique({
            where: { id: sampleClientId },
            include: {
                pedidos: {
                    orderBy: { data: 'desc' },
                    take: 1
                }
            }
        });
        console.log('Last Order seen by Prisma Query:', clientWithOrders?.pedidos[0]?.data);

        // Manual Day Diff Calculation
        if (clientWithOrders?.pedidos[0]) {
            const diff = Math.floor((Date.now() - new Date(clientWithOrders.pedidos[0].data).getTime()) / (1000 * 60 * 60 * 24));
            console.log(`Days since last order: ${diff}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
