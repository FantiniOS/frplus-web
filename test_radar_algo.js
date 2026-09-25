const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calcularCicloPonderadoPorCarga(clienteId, razaoSocial, pedidos, dataAtual = new Date()) {
    const pedidosOrdenados = [...pedidos].sort((a, b) => b.data.getTime() - a.data.getTime());
    
    const pedidosAgrupados = [];
    for (const p of pedidosOrdenados) {
        const dataStr = p.data.toDateString();
        const existente = pedidosAgrupados.find(x => x.data.toDateString() === dataStr);
        const valorNum = typeof p.valorTotal === 'object' && p.valorTotal !== null && 'toNumber' in p.valorTotal 
            ? p.valorTotal.toNumber() 
            : Number(p.valorTotal);
            
        if (existente) {
            existente.valorTotal += valorNum;
        } else {
            pedidosAgrupados.push({ data: p.data, valorTotal: valorNum });
        }
    }

    const ultimosPedidos = pedidosAgrupados.slice(0, 11);
    if (ultimosPedidos.length < 2) return null;

    const intervalos = [];
    for (let i = 0; i < ultimosPedidos.length - 1; i++) {
        const pMaisRecente = ultimosPedidos[i];
        const pMaisAntigo = ultimosPedidos[i + 1];
        const dias = Math.max(0, (pMaisRecente.data.getTime() - pMaisAntigo.data.getTime()) / (1000 * 60 * 60 * 24));
        intervalos.push({ dias, valor: pMaisAntigo.valorTotal });
    }

    const intervalosOrdenados = [...intervalos].sort((a, b) => a.dias - b.dias);
    const numDescartar = Math.floor(intervalosOrdenados.length * 0.20);
    const intervalosValidos = intervalosOrdenados.slice(numDescartar, intervalosOrdenados.length - numDescartar);
    if (intervalosValidos.length === 0) return null;

    const somaDias = intervalosValidos.reduce((acc, curr) => acc + curr.dias, 0);
    const frequenciaBaseDias = somaDias / intervalosValidos.length;

    const somaValores = intervalosValidos.reduce((acc, curr) => acc + curr.valor, 0);
    const cargaMediaHistorica = somaValores / intervalosValidos.length;

    const ultimoPedido = ultimosPedidos[0];
    const valorUltimaCompra = ultimoPedido.valorTotal;

    let multiplicadorCarga = 1;
    if (cargaMediaHistorica > 0) {
        multiplicadorCarga = valorUltimaCompra / cargaMediaHistorica;
    }
    
    multiplicadorCarga = Math.max(0.5, Math.min(2.5, multiplicadorCarga));
    const previsaoDuracaoDias = frequenciaBaseDias * multiplicadorCarga;
    const diasDesdeUltimaCompra = Math.max(0, (dataAtual.getTime() - ultimoPedido.data.getTime()) / (1000 * 60 * 60 * 24));
    const limiarRadar = previsaoDuracaoDias * 0.85;
    const prestesAComprar = diasDesdeUltimaCompra >= limiarRadar;

    return {
        clienteId,
        razaoSocial,
        totalPedidosAnalisados: ultimosPedidos.length,
        intervalosValidos: intervalosValidos.map(i => Math.round(i.dias * 10) / 10),
        frequenciaBaseDias: Math.round(frequenciaBaseDias * 10) / 10,
        cargaMediaHistorica: Math.round(cargaMediaHistorica * 100) / 100,
        valorUltimaCompra: Math.round(valorUltimaCompra * 100) / 100,
        multiplicadorCarga: Math.round(multiplicadorCarga * 100) / 100,
        previsaoDuracaoDias: Math.round(previsaoDuracaoDias * 10) / 10,
        diasDesdeUltimaCompra: Math.round(diasDesdeUltimaCompra * 10) / 10,
        prestesAComprar,
        diagnostico: "O cliente " + razaoSocial + " costuma comprar a cada " + frequenciaBaseDias.toFixed(1) + " dias. A media de carga historica valida e R$ " + cargaMediaHistorica.toFixed(2) + ". A ultima compra foi de R$ " + valorUltimaCompra.toFixed(2) + " (Multiplicador de " + multiplicadorCarga.toFixed(2) + "x). Portanto, a ultima carga deve durar " + previsaoDuracaoDias.toFixed(1) + " dias. Ja se passaram " + diasDesdeUltimaCompra.toFixed(1) + " dias. " + (prestesAComprar ? "ENTROU NO RADAR (passou de 85%)." : "FORA DO RADAR.")
    };
}

async function run() {
    const clientes = await prisma.cliente.findMany({
        where: { pedidos: { some: {} } },
        include: { pedidos: { orderBy: { data: 'desc' }, take: 40 } },
        take: 30
    });
    
    const clientesAdequados = clientes.filter(c => c.pedidos.length >= 10).slice(0, 3);
    for (const c of clientesAdequados) {
        const r = calcularCicloPonderadoPorCarga(c.id, c.razaoSocial, c.pedidos);
        console.log(JSON.stringify(r, null, 2));
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
