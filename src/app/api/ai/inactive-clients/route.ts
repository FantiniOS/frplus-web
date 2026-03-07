import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/inactive-clients - Get clients sorted by SMART cycle-based delay
export const dynamic = 'force-dynamic'

/**
 * Calcula o ciclo médio de compra de um cliente baseado nas datas dos pedidos.
 * Retorna o ciclo em dias.
 * Fallback: 30 dias se o cliente tiver apenas 1 pedido.
 */
function calcularCicloMedio(pedidosDatas: Date[]): { cicloMedioDias: number; confianca: 'alta' | 'media' | 'baixa' } {
    if (pedidosDatas.length < 2) {
        return { cicloMedioDias: 30, confianca: 'baixa' };
    }

    let totalDaysDiff = 0;
    for (let i = 0; i < pedidosDatas.length - 1; i++) {
        const d1 = pedidosDatas[i];
        const d2 = pedidosDatas[i + 1];
        const diffTime = Math.abs(d1.getTime() - d2.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDaysDiff += diffDays;
    }

    const cicloMedioDias = Math.max(7, Math.floor(totalDaysDiff / (pedidosDatas.length - 1)));
    const confianca = pedidosDatas.length >= 4 ? 'alta' : 'media';

    return { cicloMedioDias, confianca };
}

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Get ACTIVE clients only (exclude manually marked Inativo/Bloqueado)
        const clients = await prisma.cliente.findMany({
            where: { status: 'Ativo' },
            include: {
                pedidos: {
                    where: { tipo: 'Venda' },
                    orderBy: { data: 'desc' },
                    take: 10, // 10 pedidos para calcular ciclo médio com precisão
                    select: {
                        data: true,
                        valorTotal: true,
                        tipo: true,
                        itens: {
                            include: { produto: true }
                        }
                    }
                },
                _count: { select: { pedidos: true } }
            }
        })

        const hoje = new Date();

        // Map and analyze clients with cycle-based delay
        const analyzedClients = clients
            .map(client => {
                const salesOrders = client.pedidos;
                const lastOrder = salesOrders[0];
                const lastOrderDate = lastOrder?.data ? new Date(lastOrder.data) : null;

                const daysSinceLastOrder = lastOrderDate
                    ? Math.floor((hoje.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                // ---- Calcular Ciclo Médio Individual ----
                const pedidosDatas = salesOrders.map(o => new Date(o.data));
                const { cicloMedioDias, confianca } = calcularCicloMedio(pedidosDatas);

                // ---- Calcular Data Esperada e Dias de Atraso ----
                let dataEsperada: Date | null = null;
                let diasDeAtraso = 0;

                if (lastOrderDate) {
                    dataEsperada = new Date(lastOrderDate.getTime() + cicloMedioDias * 24 * 60 * 60 * 1000);
                    diasDeAtraso = Math.max(0, Math.floor((hoje.getTime() - dataEsperada.getTime()) / (1000 * 60 * 60 * 24)));
                } else {
                    // Nunca comprou — atraso máximo para aparecer no topo
                    diasDeAtraso = 9999;
                }

                // ---- Encontrar o Produto Favorito (Mais Comprado em Quantidade) ----
                let produtoFavorito = 'Mix Geral';
                const volumePorProduto: Record<string, number> = {};

                salesOrders.forEach(pedido => {
                    if (pedido.itens) {
                        pedido.itens.forEach((item: any) => {
                            const nomeProduto = item.produto?.nome || 'Produto Desconhecido';
                            volumePorProduto[nomeProduto] = (volumePorProduto[nomeProduto] || 0) + Number(item.quantidade);
                        });
                    }
                });

                if (Object.keys(volumePorProduto).length > 0) {
                    const sortedProducts = Object.entries(volumePorProduto).sort((a, b) => b[1] - a[1]);
                    produtoFavorito = sortedProducts[0][0]; // Pega o nome do produto com maior volume
                }

                // ---- Alert Level baseado na relação com o ciclo ----
                // @ts-ignore - comprador exists in schema
                const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

                let alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde' = 'verde';
                let motivo = '';
                let contextoParaIA = '';

                // TEMPLATE OURO DE INATIVOS (Injeção de Dados Reais)
                const baseContext = `
Aja como um Executivo de Vendas sênior focado em resgate de clientes (Inatividade).
Você DEVE obrigatoriamente usar os seguintes dados numéricos do cliente para montar o argumento de venda:
- Dias inativo: ${daysSinceLastOrder || 0} dias sem comprar.
- Ciclo Médio: O cliente tinha o costume de comprar a cada ${cicloMedioDias} dias.
- Produto Curva A do Cliente (O que ele mais comprava): ${produtoFavorito}.

Crie uma mensagem persuasiva focada em reativar a parceria usando o ${produtoFavorito} como 'isca' para contato. Quebre o gelo citando de forma elegante que notou a ausência dele nos últimos ${daysSinceLastOrder || 0} dias, visto que ele comprava a cada ${cicloMedioDias} dias. Ofereça uma condição especial para a volta.
                `.trim();

                if (daysSinceLastOrder === null) {
                    alertLevel = 'vermelho';
                    motivo = 'Cliente ATIVO, mas nunca efetuou uma compra. Atraso máximo.';
                    contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} tem cadastro ativo mas nunca foi faturado. Envie uma mensagem quebrando o gelo, ofereça as novidades e mostre que a distribuidora tem ótimos preços para primeira compra.`;
                } else if (diasDeAtraso <= 0) {
                    // Dentro do ciclo esperado - sem atraso
                    alertLevel = 'verde';
                    motivo = `Dentro do ciclo esperado (a cada ${cicloMedioDias} dias).`;
                } else {
                    const ratio = daysSinceLastOrder / cicloMedioDias;

                    // Hardcap Semestral
                    if (daysSinceLastOrder >= 180) {
                        alertLevel = 'vermelho';
                        motivo = `Sem comprar há mais de 6 meses (${daysSinceLastOrder} dias). Atraso de ${diasDeAtraso} dias além do ciclo.`;
                        contextoParaIA = baseContext + `\n\nNÍVEL DE ALERTA: CHURN CRÍTICO (> 6 meses). A abordagem deve ser enérgica e incisiva, mostrando que o cliente fez muita falta e que a distribuidora está disposta a fazer negócio de qualquer jeito para tê-lo de volta com o ${produtoFavorito}.`;
                    } else if (ratio >= 2.0 || (salesOrders.length <= 1 && daysSinceLastOrder >= 45)) {
                        alertLevel = 'vermelho';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Crítico (${ratio >= 2.0 ? ratio.toFixed(1) + 'x o ciclo' : '> 45 dias'}).`;
                        contextoParaIA = baseContext + `\n\nNÍVEL DE ALERTA: ALTO. O cliente estourou 2x o próprio ciclo. Mostre proatividade, pergunte se houve algum problema e force o fechamento do ${produtoFavorito}.`;
                    } else if (ratio >= 1.5) {
                        alertLevel = 'laranja';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Risco.`;
                        contextoParaIA = baseContext + `\n\nNÍVEL DE ALERTA: MÉDIO. Lembrebre-o suavemente de repor os estoques antes que acabe a mercadoria, perguntando como está o giro do ${produtoFavorito}.`;
                    } else if (ratio >= 1.2 || (daysSinceLastOrder > 30 && cicloMedioDias < 30)) {
                        alertLevel = 'amarelo';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Atenção.`;
                        contextoParaIA = baseContext + `\n\nNÍVEL DE ALERTA: PREVENTIVO. Faça uma abordagem leve de serviço de reposição de gôndola.`;
                    } else {
                        alertLevel = 'verde';
                        motivo = `Dentro do ciclo esperado (a cada ${cicloMedioDias} dias).`;
                    }
                }

                // Total gasto nos pedidos disponíveis
                const totalGasto = client.pedidos.reduce((acc, o) => acc + Number(o.valorTotal), 0);

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
                    cicloMedioDias,
                    confiancaCiclo: confianca,
                    totalGasto,
                    totalPedidos: client._count.pedidos,
                    motivo,
                    alertLevel,
                    contextoParaIA
                }
            })
            // FILTRO: Apenas clientes com diasDeAtraso > 0 (estouraram o próprio ciclo)
            .filter(c => c.diasDeAtraso > 0)
            // ORDENAÇÃO: Decrescente por diasDeAtraso (quem mais atrasou aparece primeiro)
            .sort((a, b) => b.diasDeAtraso - a.diasDeAtraso)

        // Summary stats
        const summary = {
            total: analyzedClients.length,
            vermelho: analyzedClients.filter(c => c.alertLevel === 'vermelho').length,
            laranja: analyzedClients.filter(c => c.alertLevel === 'laranja').length,
            amarelo: analyzedClients.filter(c => c.alertLevel === 'amarelo').length
        }

        return NextResponse.json({ clients: analyzedClients, summary })
    } catch (error) {
        console.error('Error fetching smart inactive clients:', error)
        return NextResponse.json({ error: 'Failed to fetch inactive clients' }, { status: 500 })
    }
}
