import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    console.log("[BACKEND] Payload recebido:", body);
    
    const { dataInicio, dataEncerramento } = body;

    if (!dataInicio) {
      return NextResponse.json({ error: 'dataInicio é obrigatório' }, { status: 400 });
    }

    // Convert strings like '2024-05-15' to proper Date objects
    // Using T00:00:00 to avoid timezone shift dropping it to previous day
    const startDate = new Date(`${dataInicio}T00:00:00`);
    
    let endDate = null;
    if (dataEncerramento) {
       endDate = new Date(`${dataEncerramento}T23:59:59`);
    }

    const campanha = await prisma.campanha.update({
      where: { slug: 'belmont' },
      data: { 
        dataInicio: startDate,
        dataEncerramento: endDate
      },
    });

    return NextResponse.json(campanha);
  } catch (error: any) {
    console.error('[API_CAMPANHA_ERROR]:', error);
    return NextResponse.json({ error: "Erro interno", details: error.message }, { status: 500 });
  }
}
