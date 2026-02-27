const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const orders = await prisma.pedido.findMany({
        include: {
            cliente: true,
            itens: true
        },
        orderBy: { data: 'desc' }
    });

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const selectedMonth = `${year}-${month}`;

    const filterYear = parseInt(year);
    const filterMonth = parseInt(month) - 1;

    const monthlyOrders = orders.filter(o => {
        const orderDate = new Date(o.data.toISOString());
        return orderDate.getUTCMonth() === filterMonth && orderDate.getUTCFullYear() === filterYear;
    });

    const totalSalesDefault = monthlyOrders
        .filter(o => o.tipo !== 'Bonificacao')
        .reduce((acc, o) => acc + Number(o.valorTotal), 0);

    const totalBonificacoes = monthlyOrders
        .filter(o => o.tipo === 'Bonificacao')
        .reduce((acc, o) => acc + Number(o.valorTotal), 0);

    console.log({
        monthlyOrders: monthlyOrders.length,
        totalSalesDefault: totalSalesDefault.toLocaleString('pt-BR'),
        totalBonificacoes: totalBonificacoes.toLocaleString('pt-BR')
    });
}

run().finally(() => prisma.$disconnect());
