const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const produtos = await prisma.produto.findMany({
    where: { createdAt: { gte: new Date('2026-08-28T18:00:00Z') } },
    select: { codigo: true, nome: true, createdAt: true },
    orderBy: { codigo: 'asc' }
  });
  console.log(JSON.stringify(produtos, null, 2));
}
main().finally(() => prisma.$disconnect());
