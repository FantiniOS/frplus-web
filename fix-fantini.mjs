import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const res = await prisma.vendedor.updateMany({
        where: {
            nome: { contains: 'FANTINI', mode: 'insensitive' }
        },
        data: {
            percentualComissao: 7
        }
    })
    console.log(`Updated ${res.count} rows.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
