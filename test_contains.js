const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Clientes:', await prisma.cliente.count({ where: { nomeFantasia: { contains: '_' } } }));
}
main().catch(console.error).finally(() => prisma.$disconnect());
