'use server';

import { prisma } from '@/lib/prisma';

export interface ClienteAtendido {
  id: string;
  cliente: string;
  cnpj: string;
  cidade: string;
  parceiroDesde: Date | null;
}

export async function getClientesAtendidos(statusFiltro: 'Todos' | 'Ativos' | 'Inativos' = 'Todos'): Promise<ClienteAtendido[]> {
  try {
    // Montar a condição base: ter pelo menos 1 pedido
    const whereCondition: any = {
      pedidos: {
        some: {}
      }
    };

    // Aplicar o filtro de status se não for "Todos"
    if (statusFiltro === 'Ativos') {
      whereCondition.status = 'Ativo';
    } else if (statusFiltro === 'Inativos') {
      whereCondition.status = 'Inativo';
    }

    // Busca clientes ordenados que possuem pelo menos 1 pedido (e filtro de status), trazendo o histórico formatado
    const clientesComPedidos = await prisma.cliente.findMany({
      where: whereCondition,
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
        cidade: true,
        pedidos: {
          orderBy: {
            data: 'asc' // Data do pedido mais antigo
          },
          take: 1,
          select: {
            data: true
          }
        }
      },
      orderBy: {
        nomeFantasia: 'asc'
      }
    });

    const resultado: ClienteAtendido[] = clientesComPedidos.map((c) => ({
      id: c.id,
      cliente: c.nomeFantasia || c.razaoSocial,
      cnpj: c.cnpj,
      cidade: c.cidade,
      parceiroDesde: c.pedidos.length > 0 ? c.pedidos[0].data : null,
    }));

    return resultado;
  } catch (error) {
    console.error("Erro ao buscar clientes atendidos:", error);
    throw new Error("Falha ao carregar a lista de clientes atendidos");
  }
}
