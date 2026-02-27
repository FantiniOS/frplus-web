const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const all = await prisma.pedido.findMany();

    const now = new Date();
    const currMonthOrders = all.filter(o => {
        const d = new Date(o.data);
        return d.getUTCMonth() === now.getMonth() && d.getUTCFullYear() === now.getFullYear();
    });

    const tipagens = {};

    currMonthOrders.forEach(o => {
        const t = o.tipo || "NULL";
        tipagens[t] = (tipagens[t] || 0) + Number(o.valorTotal);
    });

    console.log({ por_tipo: tipagens });
}

run().finally(() => prisma.$disconnect());
