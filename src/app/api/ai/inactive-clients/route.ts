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
                    select: { data: true, valorTotal: true, tipo: true }
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

                // ---- Alert Level baseado na relação com o ciclo ----
                // @ts-ignore - comprador exists in schema
                const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

                let alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde' = 'verde';
                let motivo = '';
                let contextoParaIA = '';

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
                        contextoParaIA = `Atue como um vendedor agressivo de resgate. O cliente ${greetingName} está sem comprar há mais de 6 meses. O risco de churn foi ativado. Mande uma mensagem forte de rentabilização, mostre que você sentiu falta dele, e ofereça uma excelente oportunidade comercial apenas para quebrar esse gelo.`;
                    } else if (ratio >= 2.0 || (salesOrders.length <= 1 && daysSinceLastOrder >= 45)) {
                        alertLevel = 'vermelho';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Crítico (${ratio >= 2.0 ? ratio.toFixed(1) + 'x o ciclo' : '> 45 dias'}).`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está num atraso CRÍTICO severo (sem compras há ${daysSinceLastOrder} dias, atraso de ${diasDeAtraso} dias). Objetivo: Retomar a parceria urgentemente oferecendo alguma novidade forte.`;
                    } else if (ratio >= 1.5) {
                        alertLevel = 'laranja';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Risco.`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está com atraso considerável de ${diasDeAtraso} dias. Lembre-o de repor estoque e mande dicas fáceis.`;
                    } else if (ratio >= 1.2 || (daysSinceLastOrder > 30 && cicloMedioDias < 30)) {
                        alertLevel = 'amarelo';
                        motivo = `Ciclo: a cada ${cicloMedioDias} dias | Atraso: ${diasDeAtraso} dias — Atenção.`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está num atraso LEVE de ${diasDeAtraso} dias. Faça uma abordagem leve de reposição.`;
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
