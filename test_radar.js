const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const clients = await prisma.cliente.findMany({
        where: { status: 'Ativo' },
        include: {
            vendedor: true,
            pedidos: {
                where: { tipo: 'Venda', status: { in: ['Concluido', 'FATURADO'] } },
                orderBy: { data: 'desc' },
                take: 20,
                select: {
                    id: true,
                    data: true,
                    valorTotal: true,
                    itens: { include: { produto: { include: { fabrica: true } } } }
                }
            }
        }
    });

    let totalRadar = 0;

    clients.forEach(client => {
        if (client.pedidos.length === 0) return;

        const historicoPorFabrica = new Map();

        client.pedidos.forEach(pedido => {
            const resumoFabricasNoPedido = new Map();
            pedido.itens.forEach(item => {
                if (!item.produto || !item.produto.fabrica) return;
                const fabricaNome = item.produto.fabrica.nome;
                if (!resumoFabricasNoPedido.has(fabricaNome)) resumoFabricasNoPedido.set(fabricaNome, { quantidade: 0, valor: 0 });
                const stats = resumoFabricasNoPedido.get(fabricaNome);
                stats.quantidade += 1;
                stats.valor += 0;
            });

            for (const [fabricaNome, stats] of Array.from(resumoFabricasNoPedido.entries())) {
                if (!historicoPorFabrica.has(fabricaNome)) historicoPorFabrica.set(fabricaNome, []);
                historicoPorFabrica.get(fabricaNome).push({ data: new Date(pedido.data) });
            }
        });

        for (const [fabricaNome, pedidosVirtuais] of Array.from(historicoPorFabrica.entries())) {
            const sortedPedidos = pedidosVirtuais.sort((a, b) => b.data.getTime() - a.data.getTime());
            
            const hojeRaw = new Date('2026-09-23T16:00:00-03:00');
            const hoje = new Date(hojeRaw.getFullYear(), hojeRaw.getMonth(), hojeRaw.getDate());

            const lastOrderDate = new Date(sortedPedidos[0].data.getFullYear(), sortedPedidos[0].data.getMonth(), sortedPedidos[0].data.getDate());
            const diffTime = hoje.getTime() - lastOrderDate.getTime();
            const daysSinceLastOrder = Math.round(diffTime / (1000 * 60 * 60 * 24));

            let cicloBase = 30;
            if (sortedPedidos.length >= 2) {
                let soma = 0;
                let lim = sortedPedidos.slice(0, 4);
                for(let i=0; i<lim.length-1; i++) {
                    soma += Math.ceil(Math.abs(lim[i].data.getTime() - lim[i+1].data.getTime()) / 86400000);
                }
                cicloBase = Math.max(7, Math.round(soma / (lim.length - 1)));
            }

            const novoCicloEstimado = cicloBase;
            const antecedencia = Math.min(Math.floor(novoCicloEstimado * 0.15), 7);
            const shouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);

            if (shouldAppear) totalRadar++;
        }
    });

    console.log(`Total analyzed: ${clients.length}`);
    console.log(`Total that should appear in radar: ${totalRadar}`);
}
test().finally(() => prisma.$disconnect());
