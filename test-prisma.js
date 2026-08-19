const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const start = new Date('2024-01-01');
        const end = new Date('2029-12-31');

        const clientesAtacado = await prisma.cliente.findMany({
            where: {
                status: 'Ativo',
                tabelaPreco: {
                    in: ['atacado', 'atacadoAVista', 'avista', 'atacado a vista', 'Atacado a Vista', 'Atacado A Vista']
                }
            },
            include: {
                metasCampanhas: {
                    where: {
                        campanha: { slug: 'vinagre-10-off' }
                    }
                },
                pedidos: {
                    where: {
                        campanha10OffAplicada: true,
                        data: {
                            gte: start,
                            lte: end
                        }
                    },
                    include: {
                        itens: {
                            include: {
                                produto: true
                            }
                        }
                    },
                    orderBy: {
                        data: 'desc'
                    }
                }
            }
        });
        
        console.log("Success! Found:", clientesAtacado.length);
    } catch (e) {
        console.error("Prisma Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
