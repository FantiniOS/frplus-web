const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const clients = await prisma.cliente.findMany({
        where: { nomeFantasia: { contains: 'real comercio', mode: 'insensitive' } },
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

    console.log(`Found ${clients.length} clients matching 'real comercio'`);
    if(clients.length === 0) {
        return;
    }
    const client = clients[0];
    console.log(`Client: ${client.nomeFantasia} | Pedidos: ${client.pedidos.length}`);

    const historicoPorProduto = new Map();
    const historicoPorFabrica = new Map();

    client.pedidos.forEach(pedido => {
        const resumoFabricasNoPedido = new Map();
        pedido.itens.forEach(item => {
            if (!item.produto || !item.produto.fabrica) return;
            const fabricaNome = item.produto.fabrica.nome;
            
            const pKey = `${fabricaNome}::${item.produto.id}`;
            if(!historicoPorProduto.has(pKey)) {
                historicoPorProduto.set(pKey, { fabricaNome, nome: item.produto.nome, ocorrencias: [] });
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
            historicoPorFabrica.get(fabricaNome).push({ data: new Date(pedido.data), quantidadeItens: stats.quantidade });
        }
    });

    const hojeRaw = new Date();
    const hoje = new Date(hojeRaw.getFullYear(), hojeRaw.getMonth(), hojeRaw.getDate());

    for (const [fabricaNome, pedidosVirtuais] of Array.from(historicoPorFabrica.entries())) {
        const sortedPedidos = pedidosVirtuais.sort((a, b) => b.data.getTime() - a.data.getTime());
        
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

        const volumesPorPedido = sortedPedidos.map(p => p.quantidadeItens);
        const quantidadeUltimaCompra = volumesPorPedido[0] || 0;
        const quantidadeMediaHistorica = volumesPorPedido.length > 1
            ? volumesPorPedido.slice(1).reduce((a, b) => a + b, 0) / (volumesPorPedido.length - 1)
            : quantidadeUltimaCompra;

        let fatorVolume = quantidadeMediaHistorica > 0 ? quantidadeUltimaCompra / quantidadeMediaHistorica : 1;
        if (fatorVolume > 2) fatorVolume = 2;
        if (fatorVolume < 0.5) fatorVolume = 0.5;
        if (sortedPedidos.length < 2) fatorVolume = 1;

        const novoCicloEstimado = Math.round(cicloBase * fatorVolume);
        
        let statusCiclo = 'PRESTES';
        if (daysSinceLastOrder >= novoCicloEstimado) statusCiclo = 'ATRASADO';

        console.log(`\n=== FABRICA: ${fabricaNome} ===`);
        console.log(`Ciclo Base: ${cicloBase} dias`);
        console.log(`Fator de Volume: ${fatorVolume.toFixed(2)} (Ultima qtd itens: ${quantidadeUltimaCompra}, Media historica: ${quantidadeMediaHistorica})`);
        console.log(`Novo Ciclo Estimado: ${novoCicloEstimado} dias`);
        console.log(`Dias inativo: ${daysSinceLastOrder} dias`);
        console.log(`Status Ciclo: ${statusCiclo === 'ATRASADO' ? 'Atrasado' : 'No Prazo'}`);

        console.log(`\n-- Produtos --`);
        for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
            if (prodData.fabricaNome !== fabricaNome) continue;
            
            const oc = [...prodData.ocorrencias].sort((a,b) => a.data.getTime() - b.data.getTime());
            
            let lastQtd = oc[oc.length-1].quantidade;
            if (oc.length < 2) {
                console.log(`- ${prodData.nome}: Apenas 1 compra (${lastQtd} CX), SEM_DADOS`);
                continue;
            }

            const taxasDiarias = [];
            for(let i=0; i<oc.length-1; i++) {
                const dias = Math.abs(oc[i+1].data.getTime() - oc[i].data.getTime()) / 86400000;
                if(dias >= 1) taxasDiarias.push(oc[i].quantidade / dias);
            }
            taxasDiarias.sort((a, b) => a - b);
            const mid = Math.floor(taxasDiarias.length / 2);
            const saidaDiariaBase = taxasDiarias.length % 2 !== 0 ? taxasDiarias[mid] : (taxasDiarias[mid - 1] + taxasDiarias[mid]) / 2;
            
            const maxLedger = 5;
            const ledgerOc = oc.slice(-maxLedger);

            const qtdMedHistProd = oc.length > 1 ? oc.slice(0, oc.length-1).reduce((a,b)=>a+b.quantidade,0)/(oc.length-1) : oc[0].quantidade;
            let estoqueAtual = qtdMedHistProd * 0.20;
            let ultData = ledgerOc[0].data;

            for(const ped of ledgerOc) {
                const dias = Math.abs(ped.data.getTime() - ultData.getTime()) / 86400000;
                estoqueAtual = Math.max(0, estoqueAtual - (dias * saidaDiariaBase));
                estoqueAtual += ped.quantidade;
                ultData = ped.data;
            }
            
            const diasAteHoje = Math.max(0, (hoje.getTime() - ultData.getTime()) / 86400000);
            const estoqueEstimado = Math.max(0, Math.round((estoqueAtual - (diasAteHoje * saidaDiariaBase))*10)/10);
            const diasParaEsgotar = saidaDiariaBase > 0 ? Math.max(0, Math.round(estoqueEstimado / saidaDiariaBase)) : 999;
            
            let statusE = 'OK';
            if (diasParaEsgotar <= 7) statusE = 'CRITICO (ZERADO/QUASE ZERADO)';
            else if (diasParaEsgotar <= 15) statusE = 'ATENCAO';

            if (statusE !== 'OK') {
                console.log(`- ${prodData.nome} | Saida: ${saidaDiariaBase.toFixed(2)}/dia | Estoque Est: ${estoqueEstimado} | Esgota em: ${diasParaEsgotar} dias -> ${statusE}`);
                console.log(`  > Historico das ${oc.length} compras (ultimas 5): ${ledgerOc.map(x=>x.quantidade).join(', ')}`);
                console.log(`  > Ultima compra: ${ultData.toLocaleDateString('pt-BR')} (há ${diasAteHoje} dias)`);
            }
        }
    }
}
test().finally(() => prisma.$disconnect());
