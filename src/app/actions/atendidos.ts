'use server';

import { prisma } from '@/lib/prisma';

export interface ClienteAtendido {
  id: string;
  cliente: string;
  cnpj: string;
  cidade: string;
  parceiroDesde: Date | null;
}

export async function getClientesAtendidos(): Promise<ClienteAtendido[]> {
  try {
    // Busca clientes que possuem pelo menos 1 pedido
    const clientes = await prisma.cliente.findMany({
      where: {
        pedidos: {
          some: {}
        }
      },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
        cidade: true,
      },
      orderBy: {
        nomeFantasia: 'asc'
      }
    });

    // Como prisma não suporta agregação direta de data mínima de relação facilmente com seleção mista em todos os BDs,
    // faremos a busca do primeiro pedido individualmente ou através de um include ordenado.
    // O include é mais performático que fazer N queries em loop se o bd estiver otimizado.

    const clientesComPedidos = await prisma.cliente.findMany({
      where: {
        pedidos: {
          some: {}
        }
      },
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
