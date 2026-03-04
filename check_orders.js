const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const orders = await p.pedido.findMany({
        take: 10,
        select: { id: true, fabricaId: true, valorTotal: true, tipo: true },
        orderBy: { data: 'desc' }
    });
    console.log('=== ORDERS (first 10) ===');
    orders.forEach(o => console.log(`  id=${o.id.slice(0, 8)}  fabricaId=${o.fabricaId}  valor=${o.valorTotal}  tipo=${o.tipo}`));

    const nullCount = await p.pedido.count({ where: { fabricaId: null } });
    const totalCount = await p.pedido.count();
    console.log(`\n=== STATS ===`);
    console.log(`Total orders: ${totalCount}`);
    console.log(`Orders with fabricaId=null: ${nullCount}`);
    console.log(`Orders with fabricaId set: ${totalCount - nullCount}`);

    await p.$disconnect();
}
main();
