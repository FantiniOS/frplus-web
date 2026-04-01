// Backfill script: sets dataFaturamento = updatedAt for all orders
// with status Concluido/Faturado that don't yet have dataFaturamento

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function backfill() {
    console.log('🔍 Buscando pedidos faturados sem dataFaturamento...')
    
    const pedidos = await prisma.pedido.findMany({
        where: {
            status: { in: ['Concluido', 'Faturado', 'CONCLUIDO', 'FATURADO', 'concluido', 'faturado'] },
            dataFaturamento: null
        },
        select: { id: true, status: true, updatedAt: true }
    })
    
    console.log(`📋 Encontrados ${pedidos.length} pedidos para atualizar`)
    
    if (pedidos.length === 0) {
        console.log('✅ Nada a fazer!')
        await prisma.$disconnect()
        return
    }
    
    let updated = 0
    for (const pedido of pedidos) {
        await prisma.pedido.update({
            where: { id: pedido.id },
            data: { dataFaturamento: pedido.updatedAt }
        })
        updated++
        if (updated % 50 === 0) {
            console.log(`  ... ${updated}/${pedidos.length} atualizados`)
        }
    }
    
    console.log(`✅ Backfill concluído! ${updated} pedidos atualizados com dataFaturamento = updatedAt`)
    await prisma.$disconnect()
}

backfill().catch(e => {
    console.error('❌ Erro no backfill:', e)
    process.exit(1)
})
