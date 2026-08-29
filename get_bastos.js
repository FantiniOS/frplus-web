const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const clientes = await prisma.cliente.findMany({  where: { razaoSocial: { contains: 'BASTOS' } } });
  console.log(clientes.map(c => c.cnpj));
}
main().finally(() => prisma.$disconnect());
