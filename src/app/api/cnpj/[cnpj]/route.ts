import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Server-side proxy for CNPJ lookups — avoids CORS and exposes no rate-limit to client
export async function GET(request: Request, { params }: { params: { cnpj: string } }) {
    const cnpj = params.cnpj.replace(/\D/g, '')

    if (!cnpj || cnpj.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }

    try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            headers: { 'User-Agent': 'FRPlus/1.0' },
            next: { revalidate: 86400 } // Cache 24h
        })

        if (!res.ok) {
            const text = await res.text()
            console.error(`[CNPJ Proxy] BrasilAPI returned ${res.status}:`, text)
            return NextResponse.json(
                { error: res.status === 429 ? 'Muitas consultas. Tente novamente em alguns segundos.' : 'CNPJ não encontrado' },
                { status: res.status }
            )
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('[CNPJ Proxy] Error:', error)
        return NextResponse.json({ error: 'Erro ao consultar CNPJ' }, { status: 500 })
    }
}
