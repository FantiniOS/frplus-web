import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/getServerUser';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Busca a campanha para ter dataInicio etc (se existir)
        const campanha = await prisma.campanha.findUnique({
            where: { slug: 'vinagre-10-off' }
        });

        const dataInicio = campanha?.dataInicio || new Date('2024-01-01');

        // Busca pedidos faturados/pendentes com o item de Vinagre para clientes Atacado
        const pedidos = await prisma.pedido.findMany({
            where: {
                data: { gte: dataInicio },
                tabelaPreco: { in: ['atacado', 'atacadoAVista', 'Atacado', 'Atacado a Vista'] },
                status: { notIn: ['Cancelado'] },
                itens: {
                    some: {
                        produto: {
                            nome: { contains: 'Vinagre', mode: 'insensitive' }
                        }
                    }
                }
            },
            include: {
                cliente: {
                    select: {
                        id: true,
                        nomeFantasia: true,
                        razaoSocial: true,
                        cidade: true,
                        estado: true,
                        telefone: true,
                        vendedor: { select: { nome: true } }
                    }
                },
                itens: {
                    include: {
                        produto: {
                            select: { id: true, nome: true }
                        }
                    }
                }
            },
            orderBy: { data: 'desc' }
        });

        // Agrupar dados por cliente
        const mapClientes = new Map<string, any>();
        let volumeTotal = 0;
        let receitaTotal = 0;

        pedidos.forEach(pedido => {
            // Filtrar apenas o item do vinagre
            const vinagres = pedido.itens.filter(i => 
                i.produto.nome.toLowerCase().includes('vinagre') && 
                i.produto.nome.toLowerCase().includes('lcool') && 
                i.produto.nome.includes('750')
            );

            if (vinagres.length === 0) return;

            const cId = pedido.cliente.id;
            
            if (!mapClientes.has(cId)) {
                mapClientes.set(cId, {
                    clienteId: cId,
                    nomeFantasia: pedido.cliente.nomeFantasia,
                    razaoSocial: pedido.cliente.razaoSocial,
                    cidade: pedido.cliente.cidade,
                    estado: pedido.cliente.estado,
                    vendedor: pedido.cliente.vendedor?.nome || 'N/A',
                    telefone: pedido.cliente.telefone,
                    totalComprado: 0,
                    receitaGerada: 0,
                    pedidosCount: 0,
                    ultimaCompra: pedido.data,
                });
            }

            const clienteData = mapClientes.get(cId);
            
            let qtdPedido = 0;
            let valPedido = 0;

            vinagres.forEach(v => {
                qtdPedido += v.quantidade;
                valPedido += Number(v.total);
            });

            clienteData.totalComprado += qtdPedido;
            clienteData.receitaGerada += valPedido;
            clienteData.pedidosCount += 1;
            
            // Como ordenamos por data desc, o primeiro que encontrarmos é o mais recente
            if (new Date(pedido.data) > new Date(clienteData.ultimaCompra)) {
                clienteData.ultimaCompra = pedido.data;
            }

            volumeTotal += qtdPedido;
            receitaTotal += valPedido;
        });

        const clientesList = Array.from(mapClientes.values()).sort((a, b) => b.totalComprado - a.totalComprado);

        return NextResponse.json({
            campanha: {
                nome: campanha?.nome || 'Campanha 10% OFF Vinagre',
                status: campanha?.status || 'ATIVA',
                dataInicio: campanha?.dataInicio
            },
            metricasGlobais: {
                totalClientes: clientesList.length,
                volumeTotal,
                receitaTotal
            },
            clientes: clientesList
        });

    } catch (error) {
        console.error('Erro ao processar dashboard da campanha vinagre:', error);
        return NextResponse.json({ error: 'Erro interno ao carregar relatório' }, { status: 500 });
    }
}
