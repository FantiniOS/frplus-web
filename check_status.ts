import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const pedidos = await prisma.pedido.findMany({
        select: { status: true, tipo: true },
        distinct: ['status', 'tipo']
    })
    console.log("Status unicos:", pedidos.map(p => ({ status: p.status, tipo: p.tipo })))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
