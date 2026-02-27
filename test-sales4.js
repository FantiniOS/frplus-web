const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const all = await prisma.pedido.findMany({
        include: {
            fabrica: true
        }
    });

    const now = new Date();
    const currMonthOrders = all.filter(o => {
        const d = new Date(o.data);
        return d.getUTCMonth() === now.getMonth() && d.getUTCFullYear() === now.getFullYear();
    });

    const porFabrica = {};

    currMonthOrders.forEach(o => {
        if (o.tipo === 'Bonificacao') return;
        const fId = o.fabrica?.nome || 'Nenhuma';
        porFabrica[fId] = (porFabrica[fId] || 0) + Number(o.valorTotal);
    });

    console.log({ porFabrica });
}

run().finally(() => prisma.$disconnect());
