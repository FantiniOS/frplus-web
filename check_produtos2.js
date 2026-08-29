const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const produtos = await prisma.produto.findMany({
    where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } },
    select: { codigo: true, nome: true, createdAt: true }
  });
  console.log('Produtos fakes:', produtos.length);
  console.log(produtos);
}
main().finally(() => prisma.$disconnect());
