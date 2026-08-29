const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.produto.findMany({ select: { codigo: true, nome: true }, take: 5 }));
}
main().finally(() => prisma.$disconnect());
