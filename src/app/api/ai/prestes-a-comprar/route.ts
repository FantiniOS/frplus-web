import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/prestes-a-comprar - Get clients in the exact buying window
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ======================== CONSTANTES DE CONFIGURAÇÃO ========================
const MAX_PEDIDOS_GIRO = 4;
const TETO_ANTECEDENCIA_DIAS = 7;
const PERCENTUAL_ANTECEDENCIA = 0.15;

// Removido: PRAZO_ENTREGA_DIAS = 10
// O prazo de entrega já está embutido no ciclo de compras do cliente
// ============================================================================

function calcularCicloMedio(pedidosDatas: Date[]): { cicloMedioDias: number; confianca: 'alta' | 'media' | 'baixa' } {
    if (pedidosDatas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    const datasOrdenadas = [...pedidosDatas].sort((a, b) => b.getTime() - a.getTime());
    const datasLimitadas = datasOrdenadas.slice(0, MAX_PEDIDOS_GIRO);

    if (datasLimitadas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    let somaIntervalos = 0;
    let qtdIntervalos = 0;

    for (let i = 0; i < datasLimitadas.length - 1; i++) {
        const diffTime = Math.abs(datasLimitadas[i].getTime() - datasLimitadas[i + 1].getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        somaIntervalos += diffDays;
        qtdIntervalos++;
    }

    const cicloMedioDias = Math.max(7, Math.round(somaIntervalos / qtdIntervalos));

    const qtdPedidosUsados = datasLimitadas.length;
    const confianca: 'alta' | 'media' | 'baixa' =
        qtdPedidosUsados >= 4 ? 'alta' :
        qtdPedidosUsados >= 2 ? 'media' :
        'baixa';

    return { cicloMedioDias, confianca };
}

function calcularAntecedencia(cicloMedioDias: number): number {
    return Math.min(Math.floor(cicloMedioDias * PERCENTUAL_ANTECEDENCIA), TETO_ANTECEDENCIA_DIAS);
}

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const clienteIdParam = searchParams.get('clienteId');

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
                    take: 20, // Suficiente para cobrir múltiplas fábricas (MAX_PEDIDOS_GIRO por fábrica)
                    select: {
                        id: true,
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

        const hojeRaw = new Date();
        const hoje = new Date(hojeRaw.getFullYear(), hojeRaw.getMonth(), hojeRaw.getDate());

        let analyzedClients: any[] = [];

        clients.forEach(client => {
            const salesOrders = client.pedidos;
            if (salesOrders.length === 0) return;

            // 1. Agrupar pedidos virtualmente por FÁBRICA
            // Mapeia o histórico de cada fábrica separadamente
            const historicoPorFabrica = new Map<string, {
                data: Date;
                quantidadeItens: number;
                valorVirtual: number;
            }[]>();

            // 1b. Agrupar por PRODUTO dentro de cada fábrica
            const historicoPorProduto = new Map<string, {
                produtoId: string;
                nome: string;
                codigo: string;
                unidade: string;
                fabricaNome: string;
                ocorrencias: { data: Date; quantidade: number }[];
            }>();

            salesOrders.forEach(pedido => {
                const resumoFabricasNoPedido = new Map<string, { quantidade: number, valor: number }>();
                
                pedido.itens.forEach((item: any) => {
                    const fabricaNome = item.produto?.fabrica?.nome || 'Fábrica Desconhecida';
                    const produtoId = item.produtoId || item.produto?.id || '';
                    const produtoNome = item.produto?.nome || 'Produto Desconhecido';
                    const produtoCodigo = item.produto?.codigo || '';
                    const produtoUnidade = item.produto?.unidade || 'UN';

                    // Alimentar resumo por fábrica (já existia)
                    if (!resumoFabricasNoPedido.has(fabricaNome)) {
                        resumoFabricasNoPedido.set(fabricaNome, { quantidade: 0, valor: 0 });
                    }
                    const current = resumoFabricasNoPedido.get(fabricaNome)!;
                    current.quantidade += Number(item.quantidade);
                    const preco = item.precoUnitario ? Number(item.precoUnitario) : 0;
                    current.valor += Number(item.quantidade) * preco;

                    // Alimentar histórico por produto (NOVO)
                    const produtoKey = `${fabricaNome}::${produtoId}`;
                    if (!historicoPorProduto.has(produtoKey)) {
                        historicoPorProduto.set(produtoKey, {
                            produtoId,
                            nome: produtoNome,
                            codigo: produtoCodigo,
                            unidade: produtoUnidade,
                            fabricaNome,
                            ocorrencias: []
                        });
                    }
                    historicoPorProduto.get(produtoKey)!.ocorrencias.push({
                        data: new Date(pedido.data),
                        quantidade: Number(item.quantidade)
                    });
                });

                // Registrar este pedido para cada fábrica que apareceu nele
                for (const [fabricaNome, stats] of Array.from(resumoFabricasNoPedido.entries())) {
                    if (!historicoPorFabrica.has(fabricaNome)) {
                        historicoPorFabrica.set(fabricaNome, []);
                    }
                    historicoPorFabrica.get(fabricaNome)!.push({
                        data: new Date(pedido.data),
                        quantidadeItens: stats.quantidade,
                        valorVirtual: stats.valor
                    });
                }
            });

            // 2. Analisar o ciclo de CADA fábrica independentemente
            for (const [fabricaNome, pedidosVirtuais] of Array.from(historicoPorFabrica.entries())) {
                // Ordenar por data mais recente
                const sortedPedidos = pedidosVirtuais.sort((a, b) => b.data.getTime() - a.data.getTime());
                const lastOrder = sortedPedidos[0];

                const lastOrderDate = new Date(lastOrder.data.getFullYear(), lastOrder.data.getMonth(), lastOrder.data.getDate());
                const diffTime = hoje.getTime() - lastOrderDate.getTime();
                const daysSinceLastOrder = Math.round(diffTime / (1000 * 60 * 60 * 24));

                const pedidosDatas = sortedPedidos.map(o => o.data);
                const { cicloMedioDias: cicloBase, confianca } = calcularCicloMedio(pedidosDatas);

                // Fator Volume isolado desta Fábrica
                const volumesPorPedido = sortedPedidos.map(p => p.quantidadeItens);
                const quantidadeUltimaCompra = volumesPorPedido[0] || 0;
                
                const quantidadeMediaHistorica = volumesPorPedido.length > 1
                    ? volumesPorPedido.slice(1).reduce((a, b) => a + b, 0) / (volumesPorPedido.length - 1)
                    : quantidadeUltimaCompra;

                let fatorVolume = quantidadeMediaHistorica > 0
                    ? quantidadeUltimaCompra / quantidadeMediaHistorica
                    : 1;

                if (fatorVolume > 2) fatorVolume = 2;
                if (fatorVolume < 0.5) fatorVolume = 0.5;
                if (sortedPedidos.length < 2) fatorVolume = 1;

                const novoCicloEstimado = Math.round(cicloBase * fatorVolume);
                const antecedencia = calcularAntecedencia(novoCicloEstimado);

                // O Prazo de Entrega foi removido da subtração para não descontar duas vezes.
                const shouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);

                if (clienteIdParam || shouldAppear) {
                    const dataEsperada = new Date(lastOrderDate.getTime() + novoCicloEstimado * 24 * 60 * 60 * 1000);
                    const diffTimeAtraso = hoje.getTime() - dataEsperada.getTime();
                    const diasDeAtraso = Math.max(0, Math.floor(diffTimeAtraso / (1000 * 60 * 60 * 24)));

                    const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

                    let statusCiclo: 'ATRASADO' | 'PRESTES' = 'PRESTES';
                    if (daysSinceLastOrder >= novoCicloEstimado) {
                        statusCiclo = 'ATRASADO';
                    }

                    const baseContext = `Você é o representante comercial Carlos Fantini. Escreva uma mensagem curta de WhatsApp para o cliente. Use os dados:
- Nome: ${greetingName}
- Fábrica: ${fabricaNome}
- Ciclo: ${cicloBase}
TEXTO BASE (Adapte para ficar natural, sem jargões):
Fala ${greetingName}, bom dia! Tudo bem? Pelo meu controle de estoque aqui, já faz uns ${daysSinceLastOrder} dias que rodamos o último pedido, então já deve estar na hora de repor a linha da ${fabricaNome}, certo? Tô montando a rota de entregas de hoje, quer que eu já lance o seu pedido para garantir o faturamento? Me dá um alô!
Abs, Carlos Fantini`;

                    // Para simplificar e não quebrar o frontend, passamos o valor global real para estes campos:
                    const totalGastoGlobal = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0);
                    const valorUltimaCompraGlobal = client.pedidos[0] ? Number(client.pedidos[0].valorTotal) : null;

                    // 3. Calcular estimativa de estoque POR PRODUTO desta fábrica
                    const produtosDaFabrica: any[] = [];
                    for (const [prodKey, prodData] of Array.from(historicoPorProduto.entries())) {
                        if (prodData.fabricaNome !== fabricaNome) continue;

                        const ocorrencias = prodData.ocorrencias.sort((a, b) => b.data.getTime() - a.data.getTime());
                        const totalOcorrencias = ocorrencias.length;
                        const qtdUltimaCompra = ocorrencias[0].quantidade;
                        const qtdMediaHistorica = totalOcorrencias > 1
                            ? ocorrencias.reduce((acc, o) => acc + o.quantidade, 0) / totalOcorrencias
                            : qtdUltimaCompra;

                        if (totalOcorrencias < 2) {
                            produtosDaFabrica.push({
                                produtoId: prodData.produtoId,
                                nome: prodData.nome,
                                codigo: prodData.codigo,
                                unidade: prodData.unidade,
                                qtdUltimaCompra,
                                qtdMediaHistorica: Math.round(qtdMediaHistorica * 10) / 10,
                                saidaDiaria: 0,
                                estoqueEstimado: qtdUltimaCompra,
                                diasParaEsgotar: 999,
                                statusEstoque: 'SEM_DADOS' as const,
                                totalOcorrencias
                            });
                            continue;
                        }

                        // Calcular ciclo do produto (intervalo entre pedidos que incluíram este produto)
                        const datasUnicasProduto = Array.from(new Set(ocorrencias.map(o => o.data.getTime())))
                            .sort((a, b) => b - a)
                            .map(t => new Date(t));

                        let cicloProduto = cicloBase; // fallback = ciclo da fábrica
                        if (datasUnicasProduto.length >= 2) {
                            let somaInterv = 0;
                            const limitDatas = datasUnicasProduto.slice(0, MAX_PEDIDOS_GIRO);
                            for (let i = 0; i < limitDatas.length - 1; i++) {
                                somaInterv += Math.abs(limitDatas[i].getTime() - limitDatas[i + 1].getTime()) / (1000 * 60 * 60 * 24);
                            }
                            cicloProduto = Math.max(7, Math.round(somaInterv / (limitDatas.length - 1)));
                        }

                        const saidaDiaria = cicloProduto > 0 ? qtdMediaHistorica / cicloProduto : 0;
                        const estoqueEstimado = Math.max(0, Math.round((qtdUltimaCompra - (daysSinceLastOrder * saidaDiaria)) * 10) / 10);
                        const diasParaEsgotar = saidaDiaria > 0 ? Math.max(0, Math.round(estoqueEstimado / saidaDiaria)) : 999;

                        let statusEstoque: 'CRITICO' | 'ATENCAO' | 'OK' = 'OK';
                        if (diasParaEsgotar <= 7) statusEstoque = 'CRITICO';
                        else if (diasParaEsgotar <= 15) statusEstoque = 'ATENCAO';

                        produtosDaFabrica.push({
                            produtoId: prodData.produtoId,
                            nome: prodData.nome,
                            codigo: prodData.codigo,
                            unidade: prodData.unidade,
                            qtdUltimaCompra,
                            qtdMediaHistorica: Math.round(qtdMediaHistorica * 10) / 10,
                            saidaDiaria: Math.round(saidaDiaria * 100) / 100,
                            estoqueEstimado,
                            diasParaEsgotar,
                            statusEstoque,
                            totalOcorrencias
                        });
                    }

                    // Ordenar: mais urgente primeiro, SEM_DADOS no final
                    produtosDaFabrica.sort((a, b) => {
                        if (a.statusEstoque === 'SEM_DADOS' && b.statusEstoque !== 'SEM_DADOS') return 1;
                        if (b.statusEstoque === 'SEM_DADOS' && a.statusEstoque !== 'SEM_DADOS') return -1;
                        return a.diasParaEsgotar - b.diasParaEsgotar;
                    });

                    analyzedClients.push({
                        id: client.id,
                        radarKey: `${client.id}_${fabricaNome.replace(/\s+/g, '_')}`,
                        nomeFantasia: client.nomeFantasia,
                        razaoSocial: client.razaoSocial,
                        comprador: client.comprador,
                        cidade: client.cidade,
                        telefone: client.telefone,
                        celular: client.celular,
                        email: client.email,
                        diasInativo: daysSinceLastOrder,
                        ultimaCompra: lastOrderDate.toISOString(),
                        dataEsperada: dataEsperada.toISOString(),
                        diasDeAtraso,
                        cicloMedioDias: cicloBase,
                        cicloAjustado: novoCicloEstimado,
                        _novoCicloEstimado: novoCicloEstimado,
                        diasAteProximaCompra: Math.max(0, novoCicloEstimado - daysSinceLastOrder),
                        diasDeAntecedencia: antecedencia,
                        confiancaCiclo: confianca,
                        totalGasto: totalGastoGlobal,
                        totalPedidos: client._count.pedidos,
                        motivo: '',
                        statusCiclo,
                        contextoParaIA: baseContext,
                        nomeCliente: greetingName,
                        nomeRepresentada: fabricaNome,
                        vendedorNome: client.vendedor?.nome || null,
                        valorUltimaCompra: valorUltimaCompraGlobal,
                        produtos: produtosDaFabrica
                    });
                }
            }
        });

        // Ordenação por Urgência (Mais atrasado primeiro)
        analyzedClients.sort((a, b) => {
            const urgenciaA = a._novoCicloEstimado - a.diasInativo;
            const urgenciaB = b._novoCicloEstimado - b.diasInativo;
            return urgenciaA - urgenciaB;
        });

        const summary = {
            total: analyzedClients.length
        }

        return NextResponse.json({ clients: analyzedClients, summary })
    } catch (error) {
        console.error('Error fetching prestes-a-comprar clients:', error)
        return NextResponse.json({ error: 'Failed to fetch prestes-a-comprar clients' }, { status: 500 })
    }
}
