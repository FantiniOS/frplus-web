const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(clientes);
}
main().finally(() => prisma.$disconnect());
