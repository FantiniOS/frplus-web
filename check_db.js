const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.pedido.count();
        console.log('Total Orders:', count);

        const countBonificacao = await prisma.pedido.count({ where: { tipo: 'Bonificacao' } });
        console.log('Bonificacao Orders:', countBonificacao);

        const first = await prisma.pedido.findFirst({
            orderBy: { data: 'desc' }
        });
        console.log('Latest Order:', first);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
