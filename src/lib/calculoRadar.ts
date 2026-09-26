import { Pedido } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface ResultadoRadar {
    clienteId: string;
    razaoSocial: string;
    totalPedidosAnalisados: number;
    intervalosValidos: number[];
    frequenciaBaseDias: number;
    cargaMediaHistorica: number;
    valorUltimaCompra: number;
    multiplicadorCarga: number;
    previsaoDuracaoDias: number;
    diasDesdeUltimaCompra: number;
    prestesAComprar: boolean;
    diagnostico: string;
}

export function calcularCicloPonderadoPorCarga(
    clienteId: string,
    razaoSocial: string,
    pedidos: { data: Date; valorTotal?: Decimal | number; valorVirtual?: number }[],
    dataAtual: Date = new Date()
): ResultadoRadar | null {
    // 1. LIMPEZA DE HISTÓRICO E AGRUPAMENTO
    // Agrupar pedidos do mesmo dia (mesmo evento de compra)
    const pedidosOrdenados = [...pedidos].sort((a, b) => b.data.getTime() - a.data.getTime());
    
    const pedidosAgrupados: { data: Date; valorTotal: number }[] = [];
    for (const p of pedidosOrdenados) {
        const dataStr = p.data.toDateString();
        const existente = pedidosAgrupados.find(x => x.data.toDateString() === dataStr);
        
        let valorRaw = p.valorVirtual !== undefined ? p.valorVirtual : p.valorTotal;
        let valorNum = typeof valorRaw === 'object' && valorRaw !== null && 'toNumber' in valorRaw 
            ? (valorRaw as any).toNumber() 
            : Number(valorRaw || 0);
            
        if (existente) {
            existente.valorTotal += valorNum;
        } else {
            pedidosAgrupados.push({ data: p.data, valorTotal: valorNum });
        }
    }
    
    // Pegar até os últimos 11 eventos de compra (para ter no máximo 10 intervalos)
    const ultimosPedidos = pedidosAgrupados.slice(0, 11);
    
    if (ultimosPedidos.length < 2) {
        return null; // Não há histórico suficiente
    }

    // Calcular intervalos em dias (do mais recente para o mais antigo)
    const intervalos: { dias: number; valor: number }[] = [];
    for (let i = 0; i < ultimosPedidos.length - 1; i++) {
        const pMaisRecente = ultimosPedidos[i];
        const pMaisAntigo = ultimosPedidos[i + 1];
        const dias = Math.max(0, (pMaisRecente.data.getTime() - pMaisAntigo.data.getTime()) / (1000 * 60 * 60 * 24));
        
        // Guarda o valor do pedido que INICIOU este ciclo
        intervalos.push({ dias, valor: pMaisAntigo.valorTotal });
    }

    // Descartar os 20% menores e 20% maiores intervalos
    const intervalosOrdenados = [...intervalos].sort((a, b) => a.dias - b.dias);
    const numDescartar = Math.floor(intervalosOrdenados.length * 0.20);
    
    const intervalosValidos = intervalosOrdenados.slice(numDescartar, intervalosOrdenados.length - numDescartar);
    
    if (intervalosValidos.length === 0) return null;

    const somaDias = intervalosValidos.reduce((acc, curr) => acc + curr.dias, 0);
    const frequenciaBaseDias = somaDias / intervalosValidos.length;

    // 2. MÉDIA DE VOLUME BASE
    const somaValores = intervalosValidos.reduce((acc, curr) => acc + curr.valor, 0);
    const cargaMediaHistorica = somaValores / intervalosValidos.length;

    // 3. PROJEÇÃO DA ÚLTIMA COMPRA (O Fator Multiplicador)
    const ultimoPedido = ultimosPedidos[0];
    const valorUltimaCompra = ultimoPedido.valorTotal;

    let multiplicadorCarga = 1;
    if (cargaMediaHistorica > 0) {
        multiplicadorCarga = valorUltimaCompra / cargaMediaHistorica;
    }
    
    // Limitar o multiplicador entre 0.5 e 2.5 para evitar distorções extremas
    multiplicadorCarga = Math.max(0.5, Math.min(2.5, multiplicadorCarga));

    const previsaoDuracaoDias = frequenciaBaseDias * multiplicadorCarga;

    // 4. GATILHO DO RADAR
    const diasDesdeUltimaCompra = Math.max(0, (dataAtual.getTime() - ultimoPedido.data.getTime()) / (1000 * 60 * 60 * 24));
    
    // Threshold de 85% para entrar no radar
    const limiarRadar = previsaoDuracaoDias * 0.85;
    const prestesAComprar = diasDesdeUltimaCompra >= limiarRadar;

    const multiplicadorFormatado = multiplicadorCarga.toFixed(2);
    const diferencaMedia = ((multiplicadorCarga - 1) * 100).toFixed(0);
    const statusCarga = multiplicadorCarga > 1.05 ? `+\${diferencaMedia}% Acima da média` : multiplicadorCarga < 0.95 ? `\${diferencaMedia}% Abaixo da média` : `Na média histórica`;

    const diagnostico = `**Ritmo de Compra:** \${frequenciaBaseDias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias\n` +
                        `**Carga Média Histórica:** R$ \${cargaMediaHistorica.toFixed(2)}\n` +
                        `**Última Carga:** R$ \${valorUltimaCompra.toFixed(2)} (\${statusCarga})\n` +
                        `**Previsão de Duração Ponderada:** \${previsaoDuracaoDias.toFixed(1)} dias\n` +
                        `**Já se passaram:** \${diasDesdeUltimaCompra.toFixed(1)} dias\n` +
                        `**Gatilho do Radar (85%):** \${limiarRadar.toFixed(1)} dias\n\n` +
                        (prestesAComprar ? `✅ Cliente entrou na zona de recompra.` : `⏳ Aguardando prazo.`);

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
        diagnostico
    };
}
