import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/prestes-a-comprar - Get clients in the exact buying window
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
                    where: {
                        tipo: 'Venda',
                        status: { in: ['Concluido', 'FATURADO'] }
                    },
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

        const hoje = new Date();

        // Map and analyze clients with cycle-based delay
        const analyzedClients = clients
            .map(client => {
                const salesOrders = client.pedidos;
                const lastOrder = salesOrders[0];
                const lastOrderDate = lastOrder?.data ? new Date(lastOrder.data) : null;

                // Dias sem comprar (Total absoluto)
                let daysSinceLastOrder = null;
                if (lastOrderDate) {
                    const diffTime = hoje.getTime() - lastOrderDate.getTime();
                    daysSinceLastOrder = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                }

                // ---- Calcular Ciclo Médio Individual ----
                const pedidosDatas = salesOrders.map(o => new Date(o.data));
                const { cicloMedioDias, confianca } = calcularCicloMedio(pedidosDatas);

                // ---- Calcular Data Esperada e Dias de Atraso (Excedente ao Ciclo) ----
                let dataEsperada: Date | null = null;
                let diasDeAtraso = 0;

                if (lastOrderDate) {
                    dataEsperada = new Date(lastOrderDate.getTime() + cicloMedioDias * 24 * 60 * 60 * 1000);
                    const diffTimeAtraso = hoje.getTime() - dataEsperada.getTime();
                    diasDeAtraso = Math.max(0, Math.floor(diffTimeAtraso / (1000 * 60 * 60 * 24)));
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

                let motivo = '';
                let contextoParaIA = '';

                // ---- Calcular Mês de Referência (Atual vs Próximo) ----
                const isEndOfMonth = hoje.getDate() >= 20;
                const targetMonthDate = new Date(hoje);
                if (isEndOfMonth) {
                    targetMonthDate.setMonth(hoje.getMonth() + 1);
                }
                const mesReferencia = targetMonthDate.toLocaleDateString('pt-BR', { month: 'long' });

                // NOVO TEMPLATE: Prestes a Comprar (Injeção de Dados Reais)
                const baseContext = `
Você é um representante comercial de rua. Escreva uma mensagem curta de WhatsApp para o cliente. Use os dados:
- Nome: ${greetingName}
- Produto: ${produtoFavorito}
- Ciclo: ${cicloMedioDias}
TEXTO BASE (Adapte para ficar natural, sem jargões e sem inventar nomes de assinatura):
Fala ${greetingName}, bom dia! Tudo bem? Pelo meu controle de estoque aqui, já faz uns ${cicloMedioDias} dias que rodamos o último pedido, então já deve estar na hora de repor o ${produtoFavorito}, certo? Tô montando a rota de entregas de hoje, quer que eu já lance o seu pedido para garantir o faturamento? Me dá um alô!
                `.trim();

                contextoParaIA = baseContext;

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
                    contextoParaIA
                }
            })
            // FILTRO DE OURO: Apenas clientes na janela exata de compra
            // diasDesdeUltimoPedido >= mediaCicloDias - 3 && diasDesdeUltimoPedido <= mediaCicloDias + 5
            .filter(c => c.diasInativo !== null && c.diasInativo >= (c.cicloMedioDias - 3) && c.diasInativo <= (c.cicloMedioDias + 5))
            // ORDENAÇÃO: Quem está mais próximo de estourar o limite máximo na frente
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
