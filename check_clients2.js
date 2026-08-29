const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.cliente.findMany({
    where: { cnpj: { in: ['18060525000188', '18060525001079', '18060513'] } },
    select: { cnpj: true, razaoSocial: true, createdAt: true }
  }));
}
main().finally(() => prisma.$disconnect());
