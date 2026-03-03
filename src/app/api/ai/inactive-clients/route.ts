import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/inactive-clients - Get clients sorted by SMART inactivity
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url)
        // Default threshold just for the initial query, but logic will be smarter
        const daysThreshold = parseInt(searchParams.get('days') || '15')

        // Get ACTIVE clients only (exclude manually marked Inativo/Bloqueado)
        const clients = await prisma.cliente.findMany({
            where: { status: 'Ativo' },
            include: {
                pedidos: {
                    where: { tipo: 'Venda' }, // Filtra as bonificações direto no banco para os ultimos pedidos
                    orderBy: { data: 'desc' },
                    take: 5, // Increased from 1 to 5 to calculate average cycle
                    select: { data: true, valorTotal: true, tipo: true }
                },
                _count: { select: { pedidos: true } }
            }
        })

        // Map and analyze clients
        const inactiveClients = clients
            .map(client => {
                const salesOrders = client.pedidos;
                const lastOrder = salesOrders[0];
                const lastOrderDate = lastOrder?.data ? new Date(lastOrder.data) : null;

                const daysSinceLastOrder = lastOrderDate
                    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                // --- SMART LOGIC: Calculate Average Cycle ---
                let averageCycle = 45; // Default fallback (1.5 meses para baixa frequência)
                let cycleConfidence = 'baixa'; // 'alta' | 'media' | 'baixa'

                if (salesOrders.length >= 2) {
                    let totalDaysDiff = 0;
                    for (let i = 0; i < salesOrders.length - 1; i++) {
                        const d1 = new Date(salesOrders[i].data);
                        const d2 = new Date(salesOrders[i + 1].data);
                        const diffTime = Math.abs(d1.getTime() - d2.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        totalDaysDiff += diffDays;
                    }
                    averageCycle = Math.max(7, Math.floor(totalDaysDiff / (salesOrders.length - 1))); // Min 7 days to avoid noise
                    cycleConfidence = salesOrders.length >= 4 ? 'alta' : 'media';
                }

                // Determine Alert Level based on deviation from OWN cycle
                // Green: Within normal cycle + buffer
                // Yellow: 1.2x Cycle (Late)
                // Orange: 1.5x Cycle (Risk)
                // Red: 2.0x Cycle (Churn Risk)

                let alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde' = 'verde';
                let motivo = '';
                let contextoParaIA = '';
                // Use buyer name if available (first name), else company name
                // @ts-ignore - comprador exists in schema but type might not be updated yet
                const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia;

                if (daysSinceLastOrder === null) {
                    // Never bought - depends on creation date? For now, treat as Red if old enough? 
                    // Let's keep existing logic: null days = Red (Potentially lost lead)
                    alertLevel = 'vermelho';
                    motivo = 'Cliente ATIVO, mas que nunca efetuou uma compra (ou 100% inativo). Atraso máximo.';
                    contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} tem cadastro ativo mas nunca foi faturado. Envie uma mensagem quebrando o gelo, ofereça as novidades e mostre que a distribuidora tem ótimos preços para primeira compra.`;
                } else {
                    const ratio = daysSinceLastOrder / averageCycle;

                    // Hardcap Semestral: Independente do ratio, se tiver mais de 180 dias sem compras é risco crítico.
                    if (daysSinceLastOrder >= 180) {
                        alertLevel = 'vermelho';
                        motivo = `Sem comprar há mais de 6 meses (${daysSinceLastOrder} dias). Cliente perdido para a concorrência?`;
                        contextoParaIA = `Atue como um vendedor agressivo de resgate. O cliente ${greetingName} está sem comprar há mais de 6 meses. O risco de churn foi ativado. Mande uma mensagem forte de rentabilização, mostre que você sentiu falta dele, e ofereça uma excelente oportunidade comercial apenas para quebrar esse gelo.`;
                    } else if (ratio >= 2.0 || (salesOrders.length <= 1 && daysSinceLastOrder >= 45)) {
                        alertLevel = 'vermelho';
                        motivo = `Ciclo médio de ${averageCycle} dias. Atraso crítico (${ratio >= 2.0 ? ratio.toFixed(1) + 'x normal' : 'superior a 45 dias'}).`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está num atraso CRÍTICO severo (sem compras há ${daysSinceLastOrder} dias). Objetivo: Retomar a parceria urgentemente oferecendo alguma novidade forte.`;
                    } else if (ratio >= 1.5) {
                        alertLevel = 'laranja';
                        motivo = `Ciclo médio de ${averageCycle} dias. Atraso considerável.`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está com atraso considerável. Lembre-o de repor estoque e mande dicas fáceis.`;
                    } else if (ratio >= 1.2 || (daysSinceLastOrder > 30 && averageCycle < 30)) {
                        // Added strict 30d check as fallback for quick buyers
                        alertLevel = 'amarelo';
                        motivo = `Ciclo médio de ${averageCycle} dias. Leve atraso.`;
                        contextoParaIA = `Atue como um vendedor experiente proativo. O cliente ${greetingName} está num atraso LEVE. Faça uma abordagem leve de reposição.`;
                    } else {
                        alertLevel = 'verde';
                        motivo = `Dentro do ciclo esperado (${averageCycle} dias).`;
                    }
                }

                // Calculate total spent from available orders
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
                    totalGasto,
                    totalPedidos: client._count.pedidos,
                    cicloMedio: averageCycle,
                    motivo,

                    alertLevel,
                    contextoParaIA
                }
            })
            // Filter: Only show Yellow, Orange, Red
            .filter(c => c.alertLevel !== 'verde')
            .sort((a, b) => {
                // Se null (nunca comprou), colocar pontuação gigante para aparecer em 1º
                const scoreA = a.diasInativo === null ? 999999 : a.diasInativo;
                const scoreB = b.diasInativo === null ? 999999 : b.diasInativo;
                return scoreB - scoreA;
            })

        // Summary stats
        const summary = {
            total: inactiveClients.length,
            vermelho: inactiveClients.filter(c => c.alertLevel === 'vermelho').length,
            laranja: inactiveClients.filter(c => c.alertLevel === 'laranja').length,
            amarelo: inactiveClients.filter(c => c.alertLevel === 'amarelo').length
        }

        return NextResponse.json({ clients: inactiveClients, summary })
    } catch (error) {
        console.error('Error fetching smart inactive clients:', error)
        return NextResponse.json({ error: 'Failed to fetch inactive clients' }, { status: 500 })
    }
}
