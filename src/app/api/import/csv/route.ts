import { NextRequest, NextResponse } from 'next/server';
import { importSalesCsv } from '@/services/importCsv';
import { getServerUser } from '@/lib/getServerUser';

// Allow up to 300s for large CSV imports with upsert
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const user = await getServerUser()
        if (!user || user.role === 'industria') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const fabricaId = formData.get('fabricaId') as string;

        if (!file || !fabricaId) {
            return NextResponse.json({ error: 'Missing file or fabricaId' }, { status: 400 });
        }

        console.log(`[CSV Import] File: ${file.name} | Size: ${file.size} bytes | FabricaId: ${fabricaId}`);

        const buffer = Buffer.from(await file.arrayBuffer());
        const stats = await importSalesCsv(buffer, fabricaId);

        console.log('[CSV Import] Success:', JSON.stringify(stats));
        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        console.error('[CSV Import] FULL ERROR:', error?.message, error?.stack);
        return NextResponse.json(
            { error: 'Import failed', details: error?.message || String(error), stack: error?.stack },
            { status: 500 }
        );
    }
}
