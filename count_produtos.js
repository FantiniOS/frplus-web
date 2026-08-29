const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.produto.count({
    where: { nome: { startsWith: 'Produto ' } }
  });
  console.log('Produtos com nome generico:', count);
}
main().finally(() => prisma.$disconnect());
