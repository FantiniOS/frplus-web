const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const produtos = await prisma.produto.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(produtos);
}
main().finally(() => prisma.$disconnect());
