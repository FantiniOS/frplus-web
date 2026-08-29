const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const texto = fs.readFileSync('E:\\FRPlus\\historico_erp\\arquivototal.csv', 'utf8');
  const linhas = texto.split('\n');
  
  const produtosMap = new Map();
  
  for (let i = 2; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (cols.length < 20) continue;
    const codigo = cols[16].trim();
    const nome = cols[17].trim();
    if (codigo && nome) {
      produtosMap.set(codigo, nome);
    }
  }

  let updated = 0;
  for (const [codigo, nome] of produtosMap.entries()) {
    const result = await prisma.produto.updateMany({
      where: { codigo: codigo },
      data: { nome: nome }
    });
    updated += result.count;
  }
  console.log(`Atualizados ${updated} produtos`);
}
main().finally(() => prisma.$disconnect());
