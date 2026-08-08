import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/prestes-a-comprar - Get clients in the exact buying window
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ======================== CONSTANTES DE CONFIGURAÇÃO ========================
// Quantidade máxima de pedidos usados no cálculo do giro médio.
// Usar poucos pedidos (3-4) garante adaptação rápida — "Miopia Intencional".
const MAX_PEDIDOS_GIRO = 4;

// Teto máximo de antecedência em dias. Nunca avisa mais de 7 dias antes.
const TETO_ANTECEDENCIA_DIAS = 7;

// Percentual de antecedência sobre o giro médio (15%).
const PERCENTUAL_ANTECEDENCIA = 0.15;
// ============================================================================

/**
 * Calcula o ciclo médio de compra de um cliente usando Média Aritmética Simples
 * dos últimos MAX_PEDIDOS_GIRO pedidos ("Miopia Intencional").
 *
 * - Considera APENAS os últimos 3-4 pedidos faturados.
 * - Calcula a média simples dos intervalos entre esses pedidos.
 * - Ignora completamente o histórico antigo — se o cliente mudou o
 *   comportamento no último mês, o sistema assume imediatamente.
 *
 * Fallback: 30 dias se o cliente tiver apenas 1 pedido.
 */
function calcularCicloMedio(pedidosDatas: Date[]): { cicloMedioDias: number; confianca: 'alta' | 'media' | 'baixa' } {
    if (pedidosDatas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    // Garantir ordem decrescente (mais recente primeiro)
    const datasOrdenadas = [...pedidosDatas].sort((a, b) => b.getTime() - a.getTime());

    // Limitar aos últimos MAX_PEDIDOS_GIRO pedidos
    const datasLimitadas = datasOrdenadas.slice(0, MAX_PEDIDOS_GIRO);

    if (datasLimitadas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    // Calcular intervalos entre pedidos consecutivos (média simples)
    let somaIntervalos = 0;
    let qtdIntervalos = 0;

    for (let i = 0; i < datasLimitadas.length - 1; i++) {
        const diffTime = Math.abs(datasLimitadas[i].getTime() - datasLimitadas[i + 1].getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        somaIntervalos += diffDays;
        qtdIntervalos++;
    }

    const cicloMedioDias = Math.max(7, Math.round(somaIntervalos / qtdIntervalos));

    // Confiança baseada na quantidade de pedidos efetivamente usados
    const qtdPedidosUsados = datasLimitadas.length;
    const confianca: 'alta' | 'media' | 'baixa' =
        qtdPedidosUsados >= 4 ? 'alta' :
        qtdPedidosUsados >= 2 ? 'media' :
        'baixa';

    return { cicloMedioDias, confianca };
}

/**
 * Calcula os dias de antecedência para o radar.
 * Fórmula: min(giro * 15%, 7 dias)
 * Nunca avisa com mais de 7 dias de antecedência.
 */
function calcularAntecedencia(cicloMedioDias: number): number {
    return Math.min(Math.floor(cicloMedioDias * PERCENTUAL_ANTECEDENCIA), TETO_ANTECEDENCIA_DIAS);
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

                // ---- Dias de Antecedência (Teto de 7 dias, 15% do giro) ----
                const diasDeAntecedencia = calcularAntecedencia(cicloMedioDias);

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
                    diasDeAntecedencia,              // Antecedência calculada (min(giro*15%, 7))
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
            // GATILHO ESTRITO: cliente aparece SOMENTE se diasInativo >= (giro - antecedência)
            // Antecedência = min(giro * 15%, 7 dias) — nunca mais de 7 dias antes
            .filter(c => clienteIdParam ? true : (c.diasInativo !== null && c.diasInativo >= (c.cicloMedioDias - c.diasDeAntecedencia)))
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
