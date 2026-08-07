'use server'

import { prisma } from '@/lib/prisma'

export interface ProdutoABC {
    produtoId: string;
    codigo: string;
    nome: string;
    categoria: string;
    quantidadeTotal: number;
    precoMedio: number;
    valorTotal: number;
}

export interface VolumeMensalFinanceiro {
    mes: string;
    mesKey: string;
    valorTotal: number;
}

export interface ClienteRaioXResponse {
    cliente: {
        id: string;
        razaoSocial: string;
        nomeFantasia: string;
        cnpj: string;
        status: string;
        cidade: string;
        estado: string;
    } | null;
    kpis: {
        ticketMedio: number;
        giroMedioDias: number;
        diasAusente: number;
        faturamentoAno: number;
        totalPedidos: number;
        anoReferencia: number;
    };
    volumesMensais: VolumeMensalFinanceiro[];
    curvaABC: ProdutoABC[];
}

const MESES_PT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export async function getClienteRaioX(clienteId: string, ano?: number): Promise<ClienteRaioXResponse> {
    try {
        const cliente = await prisma.cliente.findUnique({
            where: { id: clienteId },
            select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                cnpj: true,
                status: true,
                cidade: true,
                estado: true,
            }
        });

        if (!cliente) {
            return {
                cliente: null,
                kpis: { ticketMedio: 0, giroMedioDias: 0, diasAusente: 0, faturamentoAno: 0, totalPedidos: 0, anoReferencia: ano || new Date().getFullYear() },
                volumesMensais: [],
                curvaABC: []
            };
        }

        const now = new Date();
        const anoRef = ano || now.getFullYear();
        
        // Filtro de data: por ano específico ou últimos 12 meses
        const dateFilter = ano
            ? { gte: new Date(`${ano}-01-01T00:00:00.000Z`), lte: new Date(`${ano}-12-31T23:59:59.999Z`) }
            : { gte: new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1)) };

        // 1. Pedidos filtrados para KPIs e Gráfico
        const pedidos = await prisma.pedido.findMany({
            where: {
                clienteId,
                data: dateFilter,
                status: { not: 'Cancelado' },
                tipo: { not: 'Bonificacao' }
            },
            orderBy: { data: 'asc' }
        });

        // 2. Gráfico Mensal
        const volumeMap = new Map<string, number>();
        if (ano) {
            // Ano específico: Jan a Dez do ano selecionado
            for (let m = 0; m < 12; m++) {
                const key = `${ano}-${String(m + 1).padStart(2, '0')}`;
                volumeMap.set(key, 0);
            }
        } else {
            // Últimos 12 meses a partir de hoje
            for (let i = 11; i >= 0; i--) {
                const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
                const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
                volumeMap.set(key, 0);
            }
        }

        let faturamentoAno = 0;
        const purchaseDates: Date[] = [];

        for (const p of pedidos) {
            const val = Number(p.valorTotal);
            faturamentoAno += val;
            purchaseDates.push(p.data);

            const key = `${p.data.getUTCFullYear()}-${String(p.data.getUTCMonth() + 1).padStart(2, '0')}`;
            if (volumeMap.has(key)) {
                volumeMap.set(key, volumeMap.get(key)! + val);
            }
        }

        const volumesMensais: VolumeMensalFinanceiro[] = [];
        const sortedKeys = Array.from(volumeMap.keys()).sort();
        for (const key of sortedKeys) {
            const [yearStr, monthStr] = key.split('-');
            const monthIndex = parseInt(monthStr) - 1;
            volumesMensais.push({
                mes: `${MESES_PT[monthIndex]}/${yearStr}`,
                mesKey: key,
                valorTotal: volumeMap.get(key)!
            });
        }

        // 3. Cálculos de KPIs
        const totalPedidos = pedidos.length;
        const ticketMedio = totalPedidos > 0 ? faturamentoAno / totalPedidos : 0;
        
        let diasAusente = 0;
        let giroMedioDias = 0;

        if (totalPedidos > 0) {
            const lastDate = purchaseDates[purchaseDates.length - 1];
            diasAusente = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (totalPedidos > 1) {
                const firstDate = purchaseDates[0];
                const totalDaysSpan = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
                giroMedioDias = totalDaysSpan / (totalPedidos - 1);
            } else {
                // Só 1 pedido, giro é indefinido (retornando 0)
                giroMedioDias = 0; 
            }
        }

        // 4. Curva ABC de Produtos
        const itens = await prisma.itemPedido.findMany({
            where: {
                pedido: {
                    clienteId,
                    data: dateFilter,
                    status: { not: 'Cancelado' },
                    tipo: { not: 'Bonificacao' }
                }
            },
            include: {
                produto: { select: { codigo: true, nome: true, categoria: true } }
            }
        });

        const abcMap = new Map<string, ProdutoABC>();
        for (const item of itens) {
            const pid = item.produtoId;
            const existing = abcMap.get(pid);
            const val = Number(item.total);
            if (existing) {
                existing.quantidadeTotal += item.quantidade;
                existing.valorTotal += val;
            } else {
                abcMap.set(pid, {
                    produtoId: pid,
                    codigo: item.produto.codigo,
                    nome: item.produto.nome,
                    categoria: item.produto.categoria || 'Sem categoria',
                    quantidadeTotal: item.quantidade,
                    valorTotal: val,
                    precoMedio: 0 // calculado no final
                });
            }
        }

        const curvaABC = Array.from(abcMap.values()).map(p => ({
            ...p,
            precoMedio: p.quantidadeTotal > 0 ? p.valorTotal / p.quantidadeTotal : 0
        })).sort((a, b) => b.valorTotal - a.valorTotal);

        return {
            cliente,
            volumesMensais,
            curvaABC,
            kpis: {
                ticketMedio: Math.round(ticketMedio * 100) / 100,
                giroMedioDias: Math.round(giroMedioDias),
                diasAusente,
                faturamentoAno: Math.round(faturamentoAno * 100) / 100,
                totalPedidos,
                anoReferencia: anoRef
            }
        };

    } catch (error) {
        console.error('[ClienteRaioX] Erro ao buscar dados:', error);
        return {
            cliente: null,
            kpis: { ticketMedio: 0, giroMedioDias: 0, diasAusente: 0, faturamentoAno: 0, totalPedidos: 0, anoReferencia: ano || new Date().getFullYear() },
            volumesMensais: [],
            curvaABC: []
        };
    }
}
