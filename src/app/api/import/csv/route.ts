import { NextRequest, NextResponse } from 'next/server';
import { importSalesCsv } from '@/services/importCsv';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const stats = await importSalesCsv(buffer);

        return NextResponse.json({ success: true, stats });
    } catch (error) {
        console.error('CSV Import Error:', error);
        return NextResponse.json(
            { error: 'Import failed', details: String(error) },
            { status: 500 }
        );
    }
}
