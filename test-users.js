const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const users = await prisma.usuario.findMany();
    console.log(users);
}

run().finally(() => prisma.$disconnect());
