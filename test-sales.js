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

    currMonthOrders.forEach(o => {
        total += Number(o.valorTotal);
        if (o.tipo === 'Bonificacao' || o.tipo === 'B' || o.tipo === 'Bonificação') {
            boni += Number(o.valorTotal);
        } else {
            vendas += Number(o.valorTotal);
        }
    });

    console.log({
        total_mes: total.toLocaleString('pt-BR'),
        vendas_mes: vendas.toLocaleString('pt-BR'),
        boni_mes: boni.toLocaleString('pt-BR')
    });
}

run().finally(() => prisma.$disconnect());
