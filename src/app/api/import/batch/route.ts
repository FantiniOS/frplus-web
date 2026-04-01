import { NextRequest, NextResponse } from 'next/server';
import { importSalesBatch } from '@/services/importBatch';
import { getServerUser } from '@/lib/getServerUser';

// Allow up to 300s for large CSV chunks with upsert
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const body = await req.json();
        const { rows, fabricaId } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Missing or invalid rows' }, { status: 400 });
        }

        if (!fabricaId) {
            return NextResponse.json({ error: 'Missing fabricaId' }, { status: 400 });
        }

        console.log(`[Batch Import] Received chunk of ${rows.length} rows for FabricaId: ${fabricaId}`);

        const stats = await importSalesBatch(rows, fabricaId);

        console.log('[Batch Import] Chunk Success:', JSON.stringify(stats));
        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        console.error('[Batch Import] FULL ERROR:', error?.message, error?.stack);
        return NextResponse.json(
            { error: 'Import chunk failed', details: error?.message || String(error), stack: error?.stack },
            { status: 500 }
        );
    }
}
