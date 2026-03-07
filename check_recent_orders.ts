import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const recentOrders = await prisma.pedido.findMany({
        where: {
            data: {
                gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
            }
        },
        select: { id: true, cliente: { select: { nomeFantasia: true } }, data: true, status: true, tipo: true }
    })
    console.log("Pedidos recentes (ultimos 7 dias):")
    console.dir(recentOrders, { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
