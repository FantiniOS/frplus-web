const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const all = await prisma.pedido.findMany();

    const now = new Date();
    const currMonthOrders = all.filter(o => {
        const d = new Date(o.data);
        return d.getUTCMonth() === now.getMonth() && d.getUTCFullYear() === now.getFullYear();
    });

    let total = 0;
    let vendas = 0;
    let boni = 0;

    const tipagens = {};

    currMonthOrders.forEach(o => {
        tipagens[o.tipo] = (tipagens[o.tipo] || 0) + Number(o.valorTotal);
        total += Number(o.valorTotal);
    });

    console.log({
        total_mes: total.toLocaleString('pt-BR'),
        por_tipo: tipagens
    });
}

run().finally(() => prisma.$disconnect());
