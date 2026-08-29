const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const itens = await prisma.itemPedido.findMany({
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
  console.log(Json.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
