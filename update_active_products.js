const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const activeCodes = [
    '10.01.03.10', '10.01.03.11', '10.01.03.60',
    '11.01.04.08', '11.01.04.09', '12.01.01.40',
    '12.01.02.05', '12.01.04.02', '12.01.04.03',
    '14.01.03.20', '14.01.04.18', '19.01.08.63',
    '19.01.08.64'
  ];

  const deactivated = await prisma.produto.updateMany({
    where: { codigo: { notIn: activeCodes } },
    data: { ativo: false }
  });
  
  const activated = await prisma.produto.updateMany({
    where: { codigo: { in: activeCodes } },
    data: { ativo: true }
  });

  console.log(`Desativados: ${deactivated.count}`);
  console.log(`Ativados: ${activated.count}`);
}
main().finally(() => prisma.$disconnect());
