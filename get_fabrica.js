const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const f = await prisma.fabrica.findMany();
  console.log(f.map(x => ({ id: x.id, nome: x.nome })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
