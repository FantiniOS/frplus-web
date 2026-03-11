'use server';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function agendarVisita(data: {
  clienteId: string;
  dataVisita: Date;
  observacoes?: string;
}) {
  try {
    const visita = await prisma.visita.create({
      data: {
        clienteId: data.clienteId,
        dataVisita: data.dataVisita,
        observacoes: data.observacoes,
      },
      include: {
        cliente: true,
      },
    });
    return { success: true, visita };
  } catch (error: any) {
    console.error('Erro ao agendar visita:', error);
    return { success: false, error: 'Erro ao agendar visita: ' + error.message };
  }
}

export async function getVisitasDoMes(ano: number, mes: number) {
  try {
    // Ano e mês base 0 (JavaScript) a base 1 (Prisma) é irrelevante, mas vamos considerar que o input `mes` seja de 0 a 11
    // Criar as datas de início e fim do mês
    const startOfMonth = new Date(Date.UTC(ano, mes, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(ano, mes + 1, 0, 23, 59, 59, 999));

    const visitas = await prisma.visita.findMany({
      where: {
        dataVisita: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        cliente: {
          select: {
            nomeFantasia: true,
            razaoSocial: true,
            telefone: true,
            celular: true,
          }
        },
      },
      orderBy: {
        dataVisita: 'asc',
      },
    });

    return { success: true, visitas };
  } catch (error: any) {
    console.error('Erro ao buscar visitas:', error);
    return { success: false, error: 'Erro ao buscar visitas: ' + error.message };
  }
}

export async function excluirVisita(id: string) {
  try {
    await prisma.visita.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao excluir visita:', error);
    return { success: false, error: 'Erro ao excluir visita: ' + error.message };
  }
}

export async function atualizarVisita(id: string, data: {
  dataVisita: Date;
  observacoes?: string;
}) {
  try {
    const visita = await prisma.visita.update({
      where: { id },
      data: {
        dataVisita: data.dataVisita,
        observacoes: data.observacoes,
      },
      include: {
        cliente: true,
      },
    });
    return { success: true, visita };
  } catch (error: any) {
    console.error('Erro ao atualizar visita:', error);
    return { success: false, error: 'Erro ao atualizar visita: ' + error.message };
  }
}
