export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('clienteId');

    if (!clienteId) {
      return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 });
    }

    const campanha = await prisma.campanha.findUnique({
      where: { slug: 'belmont' }
    });

    if (!campanha) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    // 1. Fetch Composto Products
    const produtosComposto = await prisma.produto.findMany({
      where: {
        ativo: true,
        AND: [
          {
            OR: [
              { nome: { contains: 'Composto Tinto', mode: 'insensitive' } },
              { nome: { contains: 'Composto Branco', mode: 'insensitive' } },
            ]
          },
          { nome: { contains: '750ml', mode: 'insensitive' } }
        ]
      }
    });
    const compostoIds = produtosComposto.map(p => p.id);

    // 2. Fetch Vinagre Products
    const produtosVinagre = await prisma.produto.findMany({
      where: {
        nome: {
          contains: 'VINAGRE',
          mode: 'insensitive'
        },
        ativo: true
      }
    });
    const vinagreIds = produtosVinagre.map(p => p.id);

    // Ajuste de Fuso Horário para a busca
    const dataInicioCampanha = new Date(campanha.dataInicio);
    dataInicioCampanha.setUTCHours(0, 0, 0, 0); // Garante início do dia
    
    console.log("[DEBUG AUDITORIA] Buscando pedidos para Cliente:", clienteId, "| Data >=:", dataInicioCampanha);

    // 3. Fetch all eligible orders since dataInicio (both Venda and Bonificacao)
    const itensElegiveis = await prisma.itemPedido.findMany({
      where: {
        produtoId: { in: [...compostoIds, ...vinagreIds] },
        pedido: {
          clienteId,
          data: { gte: dataInicioCampanha },
          status: { not: 'Cancelado' },
          tipo: { in: ['Venda', 'Bonificacao'] }
        }
      },
      include: {
        produto: true,
        pedido: true
      },
      orderBy: { pedido: { data: 'desc' } }
    });

    // 4. Group by Pedido and categorize
    const pedidosVenda = new Map<string, any>();
    const pedidosBonificacao = new Map<string, any>();

    for (const item of itensElegiveis) {
      const p = item.pedido;
      const isComposto = compostoIds.includes(item.produtoId);
      const isVinagre = vinagreIds.includes(item.produtoId);
      const isVenda = p.tipo === 'Venda';
      const isBonif = p.tipo === 'Bonificacao';

      // We only care about Composto in Vendas
      if (isComposto && isVenda) {
        if (!pedidosVenda.has(p.id)) {
          pedidosVenda.set(p.id, {
            id: p.id,
            data: p.data,
            totalCaixas: 0,
            produtos: new Set<string>(),
            isLinked: p.campanhaId === campanha.id
          });
        }
        const mapped = pedidosVenda.get(p.id);
        mapped.totalCaixas += item.quantidade;
        mapped.produtos.add(item.produto.nome);
      }

      // We only care about Vinagre in Bonificacoes
      if (isVinagre && isBonif) {
        if (!pedidosBonificacao.has(p.id)) {
          pedidosBonificacao.set(p.id, {
            id: p.id,
            data: p.data,
            totalCaixas: 0,
            produtos: new Set<string>(),
            isLinked: p.campanhaId === campanha.id
          });
        }
        const mapped = pedidosBonificacao.get(p.id);
        mapped.totalCaixas += item.quantidade;
        mapped.produtos.add(item.produto.nome);
      }
    }

    // Format output
    const formatMap = (map: Map<string, any>) => Array.from(map.values()).map(p => ({
      ...p,
      produtos: Array.from(p.produtos)
    }));

    return NextResponse.json({
      vendas: formatMap(pedidosVenda),
      bonificacoes: formatMap(pedidosBonificacao)
    });

  } catch (error: any) {
    console.error('Erro ao buscar pedidos para conciliação:', error);
    return NextResponse.json({ error: 'Falha ao buscar pedidos' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { vincular, desvincular } = await request.json();

    const campanha = await prisma.campanha.findUnique({
      where: { slug: 'belmont' }
    });

    if (!campanha) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    if (campanha.status === 'ENCERRADA') {
      return NextResponse.json(
        { error: 'Ação bloqueada: Não é possível alterar uma campanha encerrada.' },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (vincular && vincular.length > 0) {
        await tx.pedido.updateMany({
          where: { id: { in: vincular } },
          data: { campanhaId: campanha.id }
        });
      }

      if (desvincular && desvincular.length > 0) {
        await tx.pedido.updateMany({
          where: { id: { in: desvincular } },
          data: { campanhaId: null }
        });
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro ao atualizar conciliação:', error);
    return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });
  }
}
