const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const importFactory = await prisma.fabrica.findFirst({ where: { nome: 'Importação' } });
    console.log("IMPORT FACTORY ID:", importFactory ? importFactory.id : 'None');

    const orders = await prisma.pedido.findMany({
        orderBy: { data: 'desc' },
        take: 5,
        include: { itens: true }
    });

    console.log("\nORDERS:");
    for (const o of orders) {
        console.log(`Order ID: ${o.id} | FabricaId: ${o.fabricaId} | Valor: ${o.valorTotal}`);
    }
}
main().finally(() => prisma.$disconnect());
