const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const deletedItems = await prisma.itemPedido.deleteMany({ where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } });
  console.log('Itens deletados:', deletedItems.count);
  
  const deletedPedidos = await prisma.pedido.deleteMany({ where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } });
  console.log('Pedidos deletados:', deletedPedidos.count);
  
  const deletedClientes = await prisma.cliente.deleteMany({ where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } } });
  console.log('Clientes deletados:', deletedClientes.count);
}
main().finally(() => prisma.$disconnect());
