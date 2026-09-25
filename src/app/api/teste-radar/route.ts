import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcularCicloPonderadoPorCarga } from '@/lib/calculoRadar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Find 3 clients with a decent amount of orders to test the logic
        const clientesRaw = await prisma.cliente.findMany({
            where: {
                pedidos: {
                    some: {}
                }
            },
            include: {
                pedidos: {
                    select: {
                        data: true,
                        valorTotal: true
                    },
                    orderBy: {
                        data: 'desc'
                    },
                    take: 20
                }
            },
            take: 30 // Get a sample pool, we'll filter for those with enough orders
        });

        // Filter for clients that have at least 5 orders so the math is interesting
        const clientesAdequados = clientesRaw.filter(c => c.pedidos.length >= 5).slice(0, 3);
        
        // Se não encontrar 3 com muito histórico, pega os primeiros 3 possíveis
        const clientesParaTestar = clientesAdequados.length === 3 ? clientesAdequados : clientesRaw.slice(0, 3);

        const resultados = [];

        for (const cliente of clientesParaTestar) {
            const res = calcularCicloPonderadoPorCarga(
                cliente.id,
                cliente.razaoSocial,
                cliente.pedidos
            );
            
            if (res) {
                resultados.push(res);
            } else {
                resultados.push({
                    clienteId: cliente.id,
                    razaoSocial: cliente.razaoSocial,
                    erro: 'Histórico insuficiente para calcular ciclo ponderado.'
                });
            }
        }

        return NextResponse.json({
            info: 'Teste de Lógica do Radar: Algoritmo de Ciclo Ponderado por Carga',
            resultados
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
