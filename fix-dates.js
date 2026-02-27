const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const pedidos = await prisma.pedido.findMany();
    let updatedCount = 0;

    for (const pedido of pedidos) {
        const data = new Date(pedido.data);

        // Check if the order time is exactly 00:00:00.000 (Midnight UTC)
        if (data.getUTCHours() === 0 && data.getUTCMinutes() === 0 && data.getUTCSeconds() === 0) {
            // Add 12 hours
            data.setUTCHours(12);

            await prisma.pedido.update({
                where: { id: pedido.id },
                data: { data }
            });
            updatedCount++;
        }
    }

    console.log(`Corrigidos ${updatedCount} pedidos no banco de dados.`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
