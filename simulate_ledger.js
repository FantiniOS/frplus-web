const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const c = await p.cliente.findFirst({
        where: { nomeFantasia: { contains: 'goncalves vieira', mode: 'insensitive' } },
        select: { id: true }
    });

    const pedidos = await p.pedido.findMany({
        where: {
            clienteId: c.id,
            tipo: 'Venda',
            status: { in: ['Concluido', 'FATURADO'] },
        },
        orderBy: { data: 'desc' },
        take: 20, // Simulando o take: 20 da route.ts
        select: {
            data: true,
            itens: {
                where: { produto: { codigo: '10.01.03.10' } }, // Vinagre de Alcool Belmont
                select: { quantidade: true }
            }
        }
    });

    // Filtra e prepara
    const ocorrencias = [];
    pedidos.forEach(ped => {
        if (ped.itens.length > 0) {
            ocorrencias.push({
                data: ped.data,
                quantidade: ped.itens.reduce((acc, it) => acc + it.quantidade, 0)
            });
        }
    });

    // Mesma lógica da route.ts
    const ocorrenciasChronological = [...ocorrencias].sort((a, b) => a.data.getTime() - b.data.getTime());
    const mergedOcorrencias = [];
    for (const oc of ocorrenciasChronological) {
        const last = mergedOcorrencias[mergedOcorrencias.length - 1];
        if (last && last.data.toDateString() === oc.data.toDateString()) {
            last.quantidade += oc.quantidade;
        } else {
            mergedOcorrencias.push({ data: new Date(oc.data), quantidade: oc.quantidade });
        }
    }

    console.log(`\n=== HISTÓRICO USADO NO CÁLCULO (${mergedOcorrencias.length} datas) ===`);
    mergedOcorrencias.forEach(m => console.log(`${m.data.toLocaleDateString('pt-BR')} -> ${m.quantidade} CX`));

    // Calcular Saida Diaria Base (Mediana)
    const taxasDiarias = [];
    for (let i = 0; i < mergedOcorrencias.length - 1; i++) {
        const dias = Math.abs(mergedOcorrencias[i+1].data.getTime() - mergedOcorrencias[i].data.getTime()) / (1000 * 60 * 60 * 24);
        if (dias >= 1) {
            taxasDiarias.push(mergedOcorrencias[i].quantidade / dias);
        }
    }
    
    let saidaDiariaBase = 0;
    taxasDiarias.sort((a, b) => a - b);
    const mid = Math.floor(taxasDiarias.length / 2);
    saidaDiariaBase = taxasDiarias.length % 2 !== 0 ? taxasDiarias[mid] : (taxasDiarias[mid - 1] + taxasDiarias[mid]) / 2;
    
    console.log(`\nSaída Diária Base (Mediana): ${saidaDiariaBase.toFixed(2)} CX/dia`);

    console.log('\n=== SIMULAÇÃO DO LIVRO-RAZÃO (LEDGER) ===');
    let estoqueAtual = 0;
    let ultimaData = mergedOcorrencias[0].data;

    for (const pedido of mergedOcorrencias) {
        const diasPassados = Math.abs(pedido.data.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24);
        const consumo = diasPassados * saidaDiariaBase;
        const estoqueAntes = Math.max(0, estoqueAtual - consumo);
        
        console.log(`\nData: ${pedido.data.toLocaleDateString('pt-BR')}`);
        console.log(`  Dias passados: ${diasPassados}`);
        console.log(`  Consumo estimado: -${consumo.toFixed(1)} CX`);
        console.log(`  Estoque residual: ${estoqueAntes.toFixed(1)} CX`);
        console.log(`  Nova Compra: +${pedido.quantidade} CX`);
        
        estoqueAtual = estoqueAntes + pedido.quantidade;
        ultimaData = pedido.data;
        console.log(`  => NOVO ESTOQUE: ${estoqueAtual.toFixed(1)} CX`);
    }

    const hoje = new Date('2026-09-23T16:00:00-03:00'); // Fixo para coincidir com seu screenshot
    const diasAteHoje = Math.max(0, (hoje.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24));
    const consumoFinal = diasAteHoje * saidaDiariaBase;
    const estoqueEstimado = Math.max(0, Math.round((estoqueAtual - consumoFinal) * 10) / 10);

    console.log(`\n=== FECHAMENTO HOJE (23/09/2026) ===`);
    console.log(`Dias desde última compra: ${diasAteHoje.toFixed(1)}`);
    console.log(`Consumo final: -${consumoFinal.toFixed(1)} CX`);
    console.log(`ESTOQUE ESTIMADO: ${estoqueEstimado.toFixed(1)} CX (Bate com a tela: 372.6)`);

    await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
