'use server';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getHistoricoTabela(clienteId: string) {
  try {
    const historicos = await prisma.historicoTabela.findMany({
      where: { clienteId },
      include: {
        representada: {
          select: { id: true, nome: true }
        }
      },
      orderBy: { dataGeracao: 'desc' }
    });

    // Group by representadaId and keep only the most recent
    const mapaRepresentada = new Map<string, { representadaId: string; representadaNome: string; dataGeracao: Date }>();
    
    for (const h of historicos) {
      if (!mapaRepresentada.has(h.representadaId)) {
        mapaRepresentada.set(h.representadaId, {
          representadaId: h.representadaId,
          representadaNome: h.representada.nome,
          dataGeracao: h.dataGeracao
        });
      }
    }

    return {
      success: true,
      historicos: Array.from(mapaRepresentada.values())
    };
  } catch (error: any) {
    console.error('Erro ao buscar histórico de tabelas:', error);
    return { success: false, error: error.message };
  }
}

export async function registrarEnvioTabela(clienteId: string, representadaId: string) {
  try {
    const registro = await prisma.historicoTabela.create({
      data: {
        clienteId,
        representadaId
      },
      include: {
        representada: {
          select: { id: true, nome: true }
        }
      }
    });

    return {
      success: true,
      registro: {
        representadaId: registro.representadaId,
        representadaNome: registro.representada.nome,
        dataGeracao: registro.dataGeracao
      }
    };
  } catch (error: any) {
    console.error('Erro ao registrar envio de tabela:', error);
    return { success: false, error: error.message };
  }
}
