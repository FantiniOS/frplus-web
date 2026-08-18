const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.campanha.upsert({
    where: { slug: 'vinagre-10-off' },
    update: {},
    create: {
      nome: 'Campanha 10% OFF Vinagre de Álcool',
      slug: 'vinagre-10-off',
      status: 'ATIVA',
    },
  });
  console.log('Campanha seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
