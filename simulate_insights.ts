import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const clients = await prisma.cliente.findMany({
        include: {
            pedidos: {
                where: {
                    tipo: 'Venda',
                    status: {
                        in: ['Novo', 'Pendente', 'Processando', 'Concluido', 'Faturado', 'Importado']
                    }
                },
                orderBy: { data: 'desc' },
                include: {
                    itens: true
                }
            }
        }
    })

    const hoje = new Date()

    for (const client of clients) {
        if (client.pedidos.length < 2) continue

        const diasDesdeUltimaCompra = client.pedidos[0] ? Math.floor((hoje.getTime() - new Date(client.pedidos[0].data).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const isAtivo = diasDesdeUltimaCompra <= 45;

        const totalHistorico = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0)
        const avgMonthly = totalHistorico / Math.max(1,
            Math.ceil((Date.now() - new Date(client.pedidos[client.pedidos.length - 1]?.data || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30))
        )

        const last3Months = client.pedidos.filter(o => {
            const orderDate = new Date(o.data)
            const threeMonthsAgo = new Date()
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
            return orderDate > threeMonthsAgo
        })

        const last3MonthsTotal = last3Months.reduce((acc, o) => acc + Number(o.valorTotal), 0)

        if (avgMonthly > 1000 && last3MonthsTotal < avgMonthly * 2) {
            console.log({
                clienteNome: client.nomeFantasia,
                diasDesdeUltimaCompra,
                isAtivo,
                dynamicActionLabel: isAtivo ? 'Aumento de Ticket' : 'Reativar Cliente',
                dataUltimoPedido: client.pedidos[0].data
            })
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
