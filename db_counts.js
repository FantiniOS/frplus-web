const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Clientes:', await prisma.cliente.count());
  console.log('Pedidos:', await prisma.pedido.count());
}
main().finally(() => prisma.$disconnect());
