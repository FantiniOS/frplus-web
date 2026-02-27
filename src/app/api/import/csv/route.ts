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

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log('[CSV Import] File received:', file.name, 'Size:', file.size, 'bytes');

        const buffer = Buffer.from(await file.arrayBuffer());
        const stats = await importSalesCsv(buffer);

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
