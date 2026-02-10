import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        // In a real app, verify Admin session here. 
        // For now, we trust the UI/Auth layer protection or just execute.

        // Transactional delete to ensure consistency
        await prisma.$transaction([
            // 1. Delete dependent relations first
            prisma.itemPedido.deleteMany({}),

            // 2. Delete main entities
            prisma.pedido.deleteMany({}),

            // 3. Delete Products (dependent on Factory)
            prisma.produto.deleteMany({}),

            // 4. Delete Clients (and their contacts if cascade isn't set, but Schema has relation)
            prisma.contatoCliente.deleteMany({}),
            prisma.cliente.deleteMany({}),

            // 5. Delete Factories (Import will recreate 'Importação')
            prisma.fabrica.deleteMany({}),
        ]);

        return NextResponse.json({ success: true, message: 'Sistema resetado com sucesso (Usuários preservados).' });
    } catch (error) {
        console.error('Reset Error:', error);
        return NextResponse.json(
            { error: 'Falha ao resetar sistema.', details: String(error) },
            { status: 500 }
        );
    }
}
