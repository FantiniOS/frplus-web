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

        const historicoPorProduto = new Map();
        const historicoPorFabrica = new Map();

        client.pedidos.forEach(pedido => {
            const resumoFabricasNoPedido = new Map();
            pedido.itens.forEach(item => {
                if (!item.produto || !item.produto.fabrica) return;
                const fabricaNome = item.produto.fabrica.nome;
                
                // Produto
                const pKey = `${fabricaNome}::${item.produto.id}`;
                if(!historicoPorProduto.has(pKey)) {
                    historicoPorProduto.set(pKey, { fabricaNome, ocorrencias: [] });
                }
                historicoPorProduto.get(pKey).ocorrencias.push({
                    data: new Date(pedido.data), quantidade: Number(item.quantidade)
                });

                if (!resumoFabricasNoPedido.has(fabricaNome)) resumoFabricasNoPedido.set(fabricaNome, { quantidade: 0, valor: 0 });
                const stats = resumoFabricasNoPedido.get(fabricaNome);
                stats.quantidade += 1;
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
            
            // Simular produtos
            const produtosDaFabrica = [];
            for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
                if (prodData.fabricaNome !== fabricaNome) continue;
                
                const oc = [...prodData.ocorrencias].sort((a,b) => a.data.getTime() - b.data.getTime());
                if (oc.length < 2) continue;

                let soma = 0;
                for(let i=0; i<oc.length-1; i++) {
                    const dias = Math.abs(oc[i+1].data.getTime() - oc[i].data.getTime()) / 86400000;
                    if(dias >= 1) soma += (oc[i].quantidade / dias);
                }
                const saidaDiaria = soma / (oc.length - 1);
                
                const lastQ = oc[oc.length-1].quantidade;
                const eAtual = lastQ; // simplificado
                const diasAteHoje = Math.max(0, (hoje.getTime() - oc[oc.length-1].data.getTime()) / 86400000);
                const estEst = Math.max(0, eAtual - (diasAteHoje * saidaDiaria));
                
                const diasParaEsgotar = saidaDiaria > 0 ? estEst / saidaDiaria : 999;
                let status = 'OK';
                if(diasParaEsgotar <= 7) status = 'CRITICO';
                else if (diasParaEsgotar <= 15) status = 'ATENCAO';
                
                produtosDaFabrica.push({ statusEstoque: status });
            }

            const temProdutoEsgotando = produtosDaFabrica.some(p => p.statusEstoque === 'CRITICO' || p.statusEstoque === 'ATENCAO');
            const macroShouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);
            
            const shouldAppear = macroShouldAppear || temProdutoEsgotando;
            if (shouldAppear) totalRadar++;
        }
    });

    console.log(`Total that should appear in radar (with hybrid logic): ${totalRadar}`);
}
test().finally(() => prisma.$disconnect());
