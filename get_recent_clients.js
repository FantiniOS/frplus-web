const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.cliente.findMany({
    where: { createdAt: { gte: new Date('2026-08-28T19:00:00Z') } },
    select: { cnpj: true, razaoSocial: true, createdAt: true }
  }));
}
main().finally(() => prisma.$disconnect());
