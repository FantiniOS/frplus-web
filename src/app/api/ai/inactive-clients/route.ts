import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/ai/inactive-clients - Get clients sorted by SMART inactivity
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        // Default threshold just for the initial query, but logic will be smarter
        const daysThreshold = parseInt(searchParams.get('days') || '15')

        // Get ACTIVE clients only (exclude manually marked Inativo/Bloqueado)
        const clients = await prisma.cliente.findMany({
            where: { status: 'Ativo' },
            include: {
                pedidos: {
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
                const orders = client.pedidos;
                // Filter out 'Bonificacao' to track actual SALES inactivity
                const salesOrders = orders.filter(o => o.tipo !== 'Bonificacao');
                const lastOrder = salesOrders[0];
                const lastOrderDate = lastOrder?.data ? new Date(lastOrder.data) : null;

                const daysSinceLastOrder = lastOrderDate
                    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                // --- SMART LOGIC: Calculate Average Cycle ---
                let averageCycle = 30; // Default fallback (monthly)
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

                if (daysSinceLastOrder === null) {
                    // Never bought - depends on creation date? For now, treat as Red if old enough? 
                    // Let's keep existing logic: null days = Red (Potentially lost lead)
                    alertLevel = 'vermelho';
                    motivo = 'Cliente nunca realizou compra.';
                } else {
                    const ratio = daysSinceLastOrder / averageCycle;

                    if (ratio >= 2.0) {
                        alertLevel = 'vermelho';
                        motivo = `Ciclo médio de ${averageCycle} dias. Atraso crítico (${ratio.toFixed(1)}x normal).`;
                    } else if (ratio >= 1.5) {
                        alertLevel = 'laranja';
                        motivo = `Ciclo médio de ${averageCycle} dias. Atraso considerável.`;
                    } else if (ratio >= 1.2 || (daysSinceLastOrder > 30 && averageCycle < 30)) {
                        // Added strict 30d check as fallback for quick buyers
                        alertLevel = 'amarelo';
                        motivo = `Ciclo médio de ${averageCycle} dias. Leve atraso.`;
                    } else {
                        alertLevel = 'verde';
                        motivo = `Dentro do ciclo esperado (${averageCycle} dias).`;
                    }
                }

                // Calculate total spent from available orders
                const totalGasto = orders.reduce((acc, o) => acc + Number(o.valorTotal), 0);

                return {
                    id: client.id,
                    nomeFantasia: client.nomeFantasia,
                    razaoSocial: client.razaoSocial,
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
                    alertLevel
                }
            })
            // Filter: Only show Yellow, Orange, Red
            .filter(c => c.alertLevel !== 'verde')
            .sort((a, b) => {
                // Sort by Days Inactive DESC (Most inactive first)
                return (b.diasInativo || 0) - (a.diasInativo || 0);
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
