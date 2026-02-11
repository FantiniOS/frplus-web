const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.pedido.count();
        console.log('Total Orders:', count);

        // Check if new column exists by trying to access it
        const first = await prisma.pedido.findFirst();
        if (first && 'tipo' in first) {
            console.log('Column "tipo" exists!', first.tipo);
        } else {
            console.log('Column "tipo" MISSING');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
