// Reparar dataFaturamento: reverte o backfill anterior que usou updatedAt
// Agora vai copiar a data original de 'data' (createdAt) para redistribuir o histórico.

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function reparar() {
    console.log('🔍 Buscando todos os pedidos faturados para reparo...')
    
    // Todos que já estão com dataFaturamento preenchido (ou só os faturados)
    const pedidos = await prisma.pedido.findMany({
        where: {
            status: { in: ['Concluido', 'Faturado', 'CONCLUIDO', 'FATURADO', 'concluido', 'faturado'] },
            dataFaturamento: { not: null }
        },
        select: { id: true, data: true }
    })
    
    console.log(`📋 Encontrados ${pedidos.length} pedidos para redistribuir a dataFaturamento.`)
    
    if (pedidos.length === 0) {
        console.log('✅ Nada a fazer!')
        await prisma.$disconnect()
        return
    }
    
    let updated = 0
    for (const pedido of pedidos) {
        await prisma.pedido.update({
            where: { id: pedido.id },
            // Setando dataFaturamento igual a data (que é o campo equivalente ao createdAt no schema)
            data: { dataFaturamento: pedido.data }
        })
        updated++
        if (updated % 50 === 0) {
            console.log(`  ... ${updated}/${pedidos.length} reparados (historico redistribuido)`)
        }
    }
    
    console.log(`✅ Reparo concluído! ${updated} pedidos agora têm a dataFaturamento igual à data de criação.`)
    await prisma.$disconnect()
}

reparar().catch(e => {
    console.error('❌ Erro no reparo:', e)
    process.exit(1)
})
