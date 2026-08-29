const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Pedidos fakes:', await prisma.pedido.count({ where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } }));
  console.log('Clientes fakes:', await prisma.cliente.count({ where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } }));
}
main().finally(() => prisma.$disconnect());
