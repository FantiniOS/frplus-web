const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.\$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'');
  console.log(res);
}
main().catch(console.error).finally(() => prisma.\$disconnect());
