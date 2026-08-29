const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const itens = await prisma.itemPedido.findMany({
    where: {
      pedido: {
        data: { gte: new Date('2025-01-01T00:00:00Z') }
      }
    },
    select: {
      produto: {
        select: { codigo: true, nome: true, ativo: true }
      }
    }
  });

  const uniqueProducts = new Map();
  itens.forEach(item => {
    if (item.produto) {
      uniqueProducts.set(item.produto.codigo, item.produto);
    }
  });

  const result = Array.from(uniqueProducts.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
