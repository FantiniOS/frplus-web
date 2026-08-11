import { prisma } from '../src/lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const orders = await prisma.pedido.findMany({
        where: {
            dataFaturamento: { gte: new Date("2026-08-01") },
            status: { in: ['Faturado', 'Concluido'] }
        },
        select: {
            dataFaturamento: true,
            valorTotal: true,
            tipo: true
        },
        orderBy: { dataFaturamento: 'desc' }
    });

    console.log("Total orders in August:", orders.length);
    orders.slice(0, 10).forEach(o => console.log(o.dataFaturamento, o.valorTotal, o.tipo));
}
run();
