const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Pedidos fakes:', await prisma.pedido.count({ {api: true, where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } }));
}
main().finally(() => prisma.$disconnect());
