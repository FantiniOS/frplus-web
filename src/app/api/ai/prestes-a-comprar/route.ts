import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/prestes-a-comprar - Get clients in the exact buying window
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ======================== CONSTANTES DE CONFIGURAÇÃO ========================
// Quantidade máxima de pedidos usados no cálculo do giro médio.
// Usar poucos pedidos garante adaptação rápida a mudanças de tabela/comportamento.
const MAX_PEDIDOS_GIRO = 5;

// Peso atribuído a intervalos cujo pedido mais recente do par é dos últimos N dias.
const PESO_RECENTE = 3;
const JANELA_RECENTE_DIAS = 90;

// Data a partir da qual o reajuste de tabela entrou em vigor.
// Intervalos que cruzam essa data E destoam muito (>50%) da mediana recente
// são descartados para não distorcer o giro.
const DATA_REAJUSTE_TABELA = new Date('2025-06-01');
// ============================================================================

/**
 * Calcula o ciclo médio de compra de um cliente usando Média Móvel Ponderada.
 *
 * - Considera apenas os últimos MAX_PEDIDOS_GIRO pedidos.
 * - Intervalos recentes (≤ JANELA_RECENTE_DIAS) recebem peso PESO_RECENTE.
 * - Intervalos antigos recebem peso 1.
 * - Intervalos que cruzam a DATA_REAJUSTE_TABELA e destoam >50% da mediana
 *   recente são descartados (Corte Temporal).
 *
 * Fallback: 30 dias se o cliente tiver apenas 1 pedido.
 */
function calcularCicloMedio(pedidosDatas: Date[]): { cicloMedioDias: number; confianca: 'alta' | 'media' | 'baixa' } {
    if (pedidosDatas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    // Garantir que as datas estejam em ordem decrescente (mais recente primeiro)
    const datasOrdenadas = [...pedidosDatas].sort((a, b) => b.getTime() - a.getTime());

    // Limitar aos últimos MAX_PEDIDOS_GIRO pedidos
    const datasLimitadas = datasOrdenadas.slice(0, MAX_PEDIDOS_GIRO);

    if (datasLimitadas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    const hoje = new Date();
    const limiteRecente = new Date(hoje.getTime() - JANELA_RECENTE_DIAS * 24 * 60 * 60 * 1000);

    // Calcular todos os intervalos entre pedidos consecutivos
    // datasLimitadas[0] = mais recente, datasLimitadas[N-1] = mais antigo
    // Intervalo i: entre datasLimitadas[i] e datasLimitadas[i+1]
    interface IntervaloInfo {
        dias: number;
        dataMaisRecente: Date; // A data mais recente do par (datasLimitadas[i])
        cruzaReajuste: boolean;
    }

    const intervalos: IntervaloInfo[] = [];
    for (let i = 0; i < datasLimitadas.length - 1; i++) {
        const dataMaisRecente = datasLimitadas[i];
        const dataMaisAntiga = datasLimitadas[i + 1];
        const diffTime = Math.abs(dataMaisRecente.getTime() - dataMaisAntiga.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Verificar se o intervalo cruza a data de reajuste
        const cruzaReajuste = dataMaisAntiga.getTime() < DATA_REAJUSTE_TABELA.getTime()
            && dataMaisRecente.getTime() >= DATA_REAJUSTE_TABELA.getTime();

        intervalos.push({ dias: diffDays, dataMaisRecente, cruzaReajuste });
    }

    // Calcular a mediana dos intervalos recentes (para referência no corte temporal)
    const intervalosRecentes = intervalos
        .filter(iv => iv.dataMaisRecente.getTime() >= limiteRecente.getTime())
        .map(iv => iv.dias)
        .sort((a, b) => a - b);

    let medianaRecente: number | null = null;
    if (intervalosRecentes.length > 0) {
        const mid = Math.floor(intervalosRecentes.length / 2);
        medianaRecente = intervalosRecentes.length % 2 === 0
            ? (intervalosRecentes[mid - 1] + intervalosRecentes[mid]) / 2
            : intervalosRecentes[mid];
    }

    // Filtrar intervalos: descartar os que cruzam o reajuste E destoam >50% da mediana recente
    const intervalosFiltrados = intervalos.filter(iv => {
        if (iv.cruzaReajuste && medianaRecente !== null) {
            const desvio = Math.abs(iv.dias - medianaRecente) / medianaRecente;
            if (desvio > 0.5) return false; // Descarta — distorção pré-reajuste
        }
        return true;
    });

    // Se todos foram descartados, usar os intervalos originais (segurança)
    const intervalosFinais = intervalosFiltrados.length > 0 ? intervalosFiltrados : intervalos;

    // Média Móvel Ponderada: peso PESO_RECENTE para recentes, peso 1 para antigos
    let somaPonderada = 0;
    let somaPesos = 0;

    for (const iv of intervalosFinais) {
        const peso = iv.dataMaisRecente.getTime() >= limiteRecente.getTime()
            ? PESO_RECENTE
            : 1;
        somaPonderada += iv.dias * peso;
        somaPesos += peso;
    }

    const cicloMedioDias = Math.max(7, Math.round(somaPonderada / somaPesos));

    // Confiança baseada na quantidade de pedidos efetivamente usados
    const qtdPedidosUsados = datasLimitadas.length;
    const confianca: 'alta' | 'media' | 'baixa' =
        qtdPedidosUsados >= 4 ? 'alta' :
        qtdPedidosUsados >= 2 ? 'media' :
        'baixa';

    return { cicloMedioDias, confianca };
}

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Support single-client lookup via ?clienteId=xxx
        const { searchParams } = new URL(request.url);
        const clienteIdParam = searchParams.get('clienteId');

        // Get clients (single or all active)
        const clients = await prisma.cliente.findMany({
            where: clienteIdParam ? { id: clienteIdParam } : { status: 'Ativo' },
            include: {
                vendedor: true,
                pedidos: {
                    where: {
                        tipo: 'Venda',
                        status: { in: ['Concluido', 'FATURADO'] }
                    },
                    orderBy: { data: 'desc' },
                    take: MAX_PEDIDOS_GIRO + 1, // +1 margem para cálculo preciso do giro
                    select: {
                        data: true,
                        valorTotal: true,
                        tipo: true,
                        itens: {
                            include: {
                                produto: {
                                    include: {
                                        fabrica: true
                                    }
                                }
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        pedidos: {
                            where: {
                                tipo: 'Venda',
                                status: { in: ['Concluido', 'FATURADO'] }
                            }
                        }
                    }
                }
            }
        })

        // Normalizar "hoje" para início do dia (00:00:00) para evitar
        // que horas/minutos causem arredondamento fracionário de dias
        const hojeRaw = new Date();
        const hoje = new Date(hojeRaw.getFullYear(), hojeRaw.getMonth(), hojeRaw.getDate());

        // Map and analyze clients with cycle-based delay
        const analyzedClients = clients
            .map(client => {
                const salesOrders = client.pedidos;
                const lastOrder = salesOrders[0];
                const lastOrderDateRaw = lastOrder?.data ? new Date(lastOrder.data) : null;
                // Normalizar data da última compra para início do dia (ignora horas)
                const lastOrderDate = lastOrderDateRaw
                    ? new Date(lastOrderDateRaw.getFullYear(), lastOrderDateRaw.getMonth(), lastOrderDateRaw.getDate())
                    : null;

                // Dias sem comprar (Total absoluto — agora com datas normalizadas, sem fração)
                let daysSinceLastOrder = null;
                if (lastOrderDate) {
                    const diffTime = hoje.getTime() - lastOrderDate.getTime();
                    daysSinceLastOrder = Math.round(diffTime / (1000 * 60 * 60 * 24));
                }

                // ---- Calcular Ciclo Médio Individual (baseado em frequência de datas) ----
                const pedidosDatas = salesOrders.map(o => new Date(o.data));
                const { cicloMedioDias: cicloBase, confianca } = calcularCicloMedio(pedidosDatas);

                // ---- COBERTURA DE ESTOQUE: Fator de Volume (Proporcionalidade) ----
                // Calcula o volume total (soma de itens.quantidade) de cada pedido
                const volumesPorPedido = salesOrders.map(pedido => {
                    return pedido.itens.reduce((sum: number, item: any) => sum + Number(item.quantidade), 0);
                });

                const quantidadeUltimaCompra = volumesPorPedido[0] || 0;

                // Média histórica EXCLUI o último pedido para comparação justa
                const quantidadeMediaHistorica = volumesPorPedido.length > 1
                    ? volumesPorPedido.slice(1).reduce((a: number, b: number) => a + b, 0) / (volumesPorPedido.length - 1)
                    : quantidadeUltimaCompra;

                // Calcular o fator de volume (última compra / média histórica)
                let fatorVolume = quantidadeMediaHistorica > 0
                    ? quantidadeUltimaCompra / quantidadeMediaHistorica
                    : 1;

                // TRAVAS DE SEGURANÇA:
                // - Máximo 3x: evita que uma compra 10x maior jogue o ciclo para anos
                // - Mínimo 0.5x: evita que uma compra mínima encurte demais
                // - Fallback 1.0: se menos de 2 pedidos, sem histórico suficiente para comparar
                if (fatorVolume > 3) fatorVolume = 3;
                if (fatorVolume < 0.5) fatorVolume = 0.5;
                if (salesOrders.length < 2) fatorVolume = 1;

                // Ciclo ajustado pela cobertura de estoque — VARIÁVEL INTERNA
                // Usado EXCLUSIVAMENTE no filtro de exibição (.filter), nunca enviado ao frontend
                const novoCicloEstimado = Math.round(cicloBase * fatorVolume);

                // cicloMedioDias = giro histórico PURO do cliente (identidade real)
                const cicloMedioDias = cicloBase;

                // ---- Calcular Data Esperada e Dias de Atraso ----
                // dataEsperada e diasDeAtraso usam novoCicloEstimado (ajustado pelo volume)
                // para que o atraso exibido na tag reconheça as "férias" da compra grande
                let dataEsperada: Date | null = null;
                let diasDeAtraso = 0;

                if (lastOrderDate) {
                    dataEsperada = new Date(lastOrderDate.getTime() + novoCicloEstimado * 24 * 60 * 60 * 1000);
                    const diffTimeAtraso = hoje.getTime() - dataEsperada.getTime();
                    diasDeAtraso = Math.max(0, Math.floor(diffTimeAtraso / (1000 * 60 * 60 * 24)));
                } else {
                    // Nunca comprou — atraso máximo para aparecer no topo
                    diasDeAtraso = 9999;
                }

                // ---- Encontrar a Fábrica Favorita (Mais Comprada em Quantidade) ----
                let fabricaFavorita = 'Mix Geral';
                const volumePorFabrica: Record<string, number> = {};

                salesOrders.forEach(pedido => {
                    if (pedido.itens) {
                        pedido.itens.forEach((item: any) => {
                            const nomeFabrica = item.produto?.fabrica?.nome || 'Fábrica Desconhecida';
                            volumePorFabrica[nomeFabrica] = (volumePorFabrica[nomeFabrica] || 0) + Number(item.quantidade);
                        });
                    }
                });

                if (Object.keys(volumePorFabrica).length > 0) {
                    const sortedFactories = Object.entries(volumePorFabrica).sort((a, b) => b[1] - a[1]);
                    fabricaFavorita = sortedFactories[0][0]; // Pega o nome da fábrica com maior volume
                }

                // ---- Alert Level baseado na relação com o ciclo PURO ----
                // @ts-ignore - comprador exists in schema
                const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

                let motivo = '';
                let contextoParaIA = '';

                // ---- Calcular Mês de Referência (Atual vs Próximo) ----
                const isEndOfMonth = hoje.getDate() >= 20;
                const targetMonthDate = new Date(hoje);
                if (isEndOfMonth) {
                    targetMonthDate.setMonth(hoje.getMonth() + 1);
                }
                const mesReferencia = targetMonthDate.toLocaleDateString('pt-BR', { month: 'long' });

                // NOVO TEMPLATE: Prestes a Comprar (Injeção de Dados Reais usando a Fábrica)
                const baseContext = `
Você é o representante comercial Carlos Fantini. Escreva uma mensagem curta de WhatsApp para o cliente. Use os dados:
- Nome: ${greetingName}
- Fábrica: ${fabricaFavorita}
- Ciclo: ${cicloMedioDias}
TEXTO BASE (Adapte para ficar natural, sem jargões):
Fala ${greetingName}, bom dia! Tudo bem? Pelo meu controle de estoque aqui, já faz uns ${daysSinceLastOrder !== null ? daysSinceLastOrder : cicloMedioDias} dias que rodamos o último pedido, então já deve estar na hora de repor a linha da ${fabricaFavorita}, certo? Tô montando a rota de entregas de hoje, quer que eu já lance o seu pedido para garantir o faturamento? Me dá um alô!
Abs, Carlos Fantini
                `.trim();

                contextoParaIA = baseContext;

                // Total gasto nos pedidos disponíveis
                const totalGasto = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0);

                let statusCiclo: 'ATRASADO' | 'PRESTES' = 'PRESTES';
                // >= garante que o "dia zero" (diasAusente === ciclo) seja classificado como ATRASADO
                if (daysSinceLastOrder !== null && daysSinceLastOrder >= novoCicloEstimado) {
                    statusCiclo = 'ATRASADO';
                }

                // Dias restantes até a próxima compra esperada (baseado no ciclo ajustado por volume)
                const diasAteProximaCompra = daysSinceLastOrder !== null
                    ? Math.max(0, novoCicloEstimado - daysSinceLastOrder)
                    : 0;

                return {
                    id: client.id,
                    nomeFantasia: client.nomeFantasia,
                    razaoSocial: client.razaoSocial,
                    comprador: client.comprador,
                    cidade: client.cidade,
                    telefone: client.telefone,
                    celular: client.celular,
                    email: client.email,
                    diasInativo: daysSinceLastOrder,
                    ultimaCompra: lastOrderDate ? lastOrderDate.toISOString() : null,
                    dataEsperada: dataEsperada ? dataEsperada.toISOString() : null,
                    diasDeAtraso,
                    cicloMedioDias,              // Giro histórico PURO (identidade do cliente)
                    cicloAjustado: novoCicloEstimado,  // Giro ajustado pelo volume da última compra
                    _novoCicloEstimado: novoCicloEstimado,  // INTERNO: usado no .filter()
                    diasAteProximaCompra,        // Dias restantes (0 = compra devida)
                    confiancaCiclo: confianca,
                    totalGasto,
                    totalPedidos: client._count.pedidos,
                    motivo,
                    statusCiclo,
                    contextoParaIA,
                    nomeCliente: greetingName,
                    nomeRepresentada: fabricaFavorita,
                    vendedorNome: client.vendedor?.nome || null,
                    valorUltimaCompra: lastOrder ? Number(lastOrder.valorTotal) : null
                }
            })
            // When querying a single client, skip the cycle filter to show their status regardless
            // Janela de 5 dias: usa o MENOR entre ciclo puro e ajustado por volume
            // Assim, se o volume indica que o estoque acabou antes, o cliente aparece mais cedo
            // Margem de 10% de antecedência: exibe quando diasInativo >= ciclo * 0.9
            .filter(c => clienteIdParam ? true : (c.diasInativo !== null && c.diasInativo >= Math.floor(Math.min(c.cicloMedioDias, c._novoCicloEstimado) * 0.9)))
            // ORDENAÇÃO: Quem está mais atrasado aparece primeiro no topo
            .sort((a, b) => b.diasInativo! - a.diasInativo!)

        // Summary stats
        const summary = {
            total: analyzedClients.length
        }

        return NextResponse.json({ clients: analyzedClients, summary })
    } catch (error) {
        console.error('Error fetching prestes-a-comprar clients:', error)
        return NextResponse.json({ error: 'Failed to fetch prestes-a-comprar clients' }, { status: 500 })
    }
}
