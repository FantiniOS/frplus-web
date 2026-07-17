const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.vendedor.updateMany({
        where: { nome: { contains: 'Jaime', mode: 'insensitive' } },
        data: { taxaRetencaoIR: 1.5, taxaRetencaoISSQN: 2.5 }
    });
    
    // Some people spell Sergio without the accent, let's just do Sergio or Sérgio
    await prisma.vendedor.updateMany({
        where: { nome: { contains: 'ergio', mode: 'insensitive' } },
        data: { taxaRetencaoIR: 1.5, taxaRetencaoISSQN: 2.5 }
    });
    console.log('Updated Jaime and Sérgio impostos.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
