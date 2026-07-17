'use server'

import { prisma } from '@/lib/prisma'

export interface ProdutoSaidaInfo {
    id: string;
    codigo: string;
    nome: string;
    fabricaNome: string;
    categoria: string;
    unidade: string;
    preco50a199: number;
    preco200a699: number;
    precoAtacado: number;
    precoAtacadoAVista: number;
    precoRedes: number;
    imagem: string | null;
}

export interface VolumeMensal {
    mes: string;       // "Jan/2026"
    mesKey: string;     // "2026-01"
    quantidade: number;
    valorTotal: number;
}

export interface SaidaAgrupadaCliente {
    clienteId: string;
    clienteNome: string;
    quantidadeTotal: number;
    precoMedio: number;
    valorTotal: number;
    ultimaCompra: string;
}

export interface EstatisticasAvancadas {
    positivacao: {
        percentual: number;
        clientesCompraram: number;
        totalClientesAtivos: number;
    };
    abandono: {
        clientesPerdidos: number;
        lista: {
            id: string;
            nomeFantasia: string;
            dataUltimaCompra: string;
            diasAusente: number;
        }[];
    };
    precos: {
        minimo: number;
        maximo: number;
        medio: number;
    };
    shareFaturamento: number;
}

export interface ProdutoSaidasResponse {
    produto: ProdutoSaidaInfo | null;
    volumesMensais: VolumeMensal[];
    ultimasSaidas: SaidaAgrupadaCliente[];
    totais: {
        quantidadeTotal: number;
        valorTotal: number;
        mediaMensal: number;
        mesPico: string;
        mesPicoQtd: number;
    };
    estatisticasAvancadas?: EstatisticasAvancadas;
}

const MESES_PT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export async function getProdutoSaidas(produtoId: string): Promise<ProdutoSaidasResponse> {
    try {
        // 1. Buscar dados do produto
        const produto = await prisma.produto.findUnique({
            where: { id: produtoId },
            include: { fabrica: true }
        });

        if (!produto) {
            return {
                produto: null,
                volumesMensais: [],
                ultimasSaidas: [],
                totais: { quantidadeTotal: 0, valorTotal: 0, mediaMensal: 0, mesPico: '-', mesPicoQtd: 0 }
            };
        }

        const produtoInfo: ProdutoSaidaInfo = {
            id: produto.id,
            codigo: produto.codigo,
            nome: produto.nome,
            fabricaNome: produto.fabrica?.nome || 'Sem fábrica',
            categoria: produto.categoria || 'Sem categoria',
            unidade: produto.unidade || 'CX',
            preco50a199: Number(produto.preco50a199),
            preco200a699: Number(produto.preco200a699),
            precoAtacado: Number(produto.precoAtacado),
            precoAtacadoAVista: Number(produto.precoAtacadoAVista),
            precoRedes: Number(produto.precoRedes),
            imagem: produto.imagem || null,
        };

        // 2. Buscar todos os itens desse produto nos últimos 12 meses
        const now = new Date();
        const twelveMonthsAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1));

        const itens = await prisma.itemPedido.findMany({
            where: {
                produtoId: produtoId,
                pedido: {
                    data: { gte: twelveMonthsAgo },
                    status: { not: 'Cancelado' },
                    tipo: { not: 'Bonificacao' }
                }
            },
            include: {
                pedido: {
                    include: {
                        cliente: {
                            select: { nomeFantasia: true, razaoSocial: true }
                        }
                    }
                }
            },
            orderBy: {
                pedido: { data: 'desc' }
            }
        });

        // 3. Agrupar por mês para gráfico
        const volumeMap = new Map<string, { quantidade: number; valorTotal: number }>();

        // Inicializar os últimos 12 meses com zero
        for (let i = 11; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            volumeMap.set(key, { quantidade: 0, valorTotal: 0 });
        }

        // Preencher com dados reais
        for (const item of itens) {
            const pedidoDate = item.pedido.data;
            const key = `${pedidoDate.getUTCFullYear()}-${String(pedidoDate.getUTCMonth() + 1).padStart(2, '0')}`;
            const existing = volumeMap.get(key);
            if (existing) {
                existing.quantidade += item.quantidade;
                existing.valorTotal += Number(item.total);
            }
        }

        // Converter para array ordenado
        const volumesMensais: VolumeMensal[] = [];
        const sortedKeys = Array.from(volumeMap.keys()).sort();
        for (const key of sortedKeys) {
            const [yearStr, monthStr] = key.split('-');
            const monthIndex = parseInt(monthStr) - 1;
            const entry = volumeMap.get(key)!;
            volumesMensais.push({
                mes: `${MESES_PT[monthIndex]}/${yearStr}`,
                mesKey: key,
                quantidade: entry.quantidade,
                valorTotal: Math.round(entry.valorTotal * 100) / 100,
            });
        }

        // 4. Agrupar saídas por Cliente
        const clienteMap = new Map<string, SaidaAgrupadaCliente>();
        for (const item of itens) {
            const clienteId = item.pedido.clienteId;
            const clienteNome = item.pedido.cliente?.nomeFantasia || item.pedido.cliente?.razaoSocial || 'Cliente Desconhecido';
            const dataIso = item.pedido.data.toISOString();
            
            const existing = clienteMap.get(clienteId);
            if (existing) {
                existing.quantidadeTotal += item.quantidade;
                existing.valorTotal += Number(item.total);
                if (dataIso > existing.ultimaCompra) {
                    existing.ultimaCompra = dataIso;
                }
            } else {
                clienteMap.set(clienteId, {
                    clienteId,
                    clienteNome,
                    quantidadeTotal: item.quantidade,
                    valorTotal: Number(item.total),
                    precoMedio: 0,
                    ultimaCompra: dataIso
                });
            }
        }

        const ultimasSaidas: SaidaAgrupadaCliente[] = Array.from(clienteMap.values()).map(c => ({
            ...c,
            precoMedio: c.quantidadeTotal > 0 ? c.valorTotal / c.quantidadeTotal : 0
        })).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);

        // 5. Totais / KPIs
        const quantidadeTotal = volumesMensais.reduce((acc, v) => acc + v.quantidade, 0);
        const valorTotal = volumesMensais.reduce((acc, v) => acc + v.valorTotal, 0);
        const mesesComVenda = volumesMensais.filter(v => v.quantidade > 0).length;
        const mediaMensal = mesesComVenda > 0 ? Math.round(quantidadeTotal / mesesComVenda) : 0;

        let mesPico = '-';
        let mesPicoQtd = 0;
        for (const v of volumesMensais) {
            if (v.quantidade > mesPicoQtd) {
                mesPicoQtd = v.quantidade;
                mesPico = v.mes;
            }
        }

        // 6. Estatísticas Avançadas
        const sixMonthsAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const totalClientesAtivos = await prisma.cliente.count({
            where: { status: 'Ativo' }
        });

        const clientes6MesesRaw = await prisma.itemPedido.findMany({
            where: {
                produtoId: produtoId,
                pedido: {
                    data: { gte: sixMonthsAgo },
                    status: { not: 'Cancelado' },
                    tipo: { not: 'Bonificacao' },
                    cliente: { status: 'Ativo' }
                }
            },
            select: { pedido: { select: { clienteId: true } } }
        });
        const clientesCompraram6M = new Set(clientes6MesesRaw.map(i => i.pedido.clienteId)).size;
        const positivacaoPercentual = totalClientesAtivos > 0 ? (clientesCompraram6M / totalClientesAtivos) * 100 : 0;

        const lastPurchaseByClient = new Map<string, { nomeFantasia: string, data: Date }>();
        for (const item of itens) { 
            const cid = item.pedido.clienteId;
            const cdata = item.pedido.data;
            const cNome = item.pedido.cliente?.nomeFantasia || item.pedido.cliente?.razaoSocial || 'Desconhecido';
            
            const existing = lastPurchaseByClient.get(cid);
            if (!existing || cdata > existing.data) {
                lastPurchaseByClient.set(cid, { nomeFantasia: cNome, data: cdata });
            }
        }
        
        const perdidosLista: { id: string, nomeFantasia: string, dataUltimaCompra: string, diasAusente: number }[] = [];
        const entries = Array.from(lastPurchaseByClient.entries());
        for (const [cid, val] of entries) {
            if (val.data < ninetyDaysAgo) {
                const dias = Math.floor((Date.now() - val.data.getTime()) / (1000 * 60 * 60 * 24));
                perdidosLista.push({
                    id: cid,
                    nomeFantasia: val.nomeFantasia,
                    dataUltimaCompra: val.data.toISOString(),
                    diasAusente: dias
                });
            }
        }
        perdidosLista.sort((a, b) => b.diasAusente - a.diasAusente);
        const clientesPerdidos = perdidosLista.length;

        let minPreco = Infinity;
        let maxPreco = 0;
        for (const item of itens) {
            const p = Number(item.precoUnitario);
            if (p < minPreco) minPreco = p;
            if (p > maxPreco) maxPreco = p;
        }
        if (minPreco === Infinity) minPreco = 0;
        const precoMedioGlobal = quantidadeTotal > 0 ? valorTotal / quantidadeTotal : 0;

        const faturamentoGlobalAggregate = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            where: {
                data: { gte: twelveMonthsAgo },
                status: { not: 'Cancelado' },
                tipo: { not: 'Bonificacao' }
            }
        });
        const faturamentoGlobal = Number(faturamentoGlobalAggregate._sum.valorTotal || 0);
        const shareFaturamento = faturamentoGlobal > 0 ? (valorTotal / faturamentoGlobal) * 100 : 0;

        return {
            produto: produtoInfo,
            volumesMensais,
            ultimasSaidas,
            totais: {
                quantidadeTotal,
                valorTotal: Math.round(valorTotal * 100) / 100,
                mediaMensal,
                mesPico,
                mesPicoQtd,
            },
            estatisticasAvancadas: {
                positivacao: {
                    percentual: positivacaoPercentual,
                    clientesCompraram: clientesCompraram6M,
                    totalClientesAtivos,
                },
                abandono: {
                    clientesPerdidos,
                    lista: perdidosLista,
                },
                precos: {
                    minimo: minPreco,
                    maximo: maxPreco,
                    medio: precoMedioGlobal,
                },
                shareFaturamento,
            }
        };
    } catch (error) {
        console.error('[ProdutoSaidas] Erro ao buscar dados:', error);
        return {
            produto: null,
            volumesMensais: [],
            ultimasSaidas: [],
            totais: { quantidadeTotal: 0, valorTotal: 0, mediaMensal: 0, mesPico: '-', mesPicoQtd: 0 }
        };
    }
}
