import { NextResponse } from 'next/server';

// Configuration from docker-compose.yml
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'E493AE90-D9CA-4E38-95A7-526487122178';
const INSTANCE_NAME = 'frplus_main';

async function fetchEvolution(endpoint: string, options: RequestInit = {}) {
    const url = `${EVOLUTION_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        ...options.headers,
    };

    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error('Evolution API Error:', error);
        return { ok: false, status: 500, data: { error: 'Failed to connect to Evolution API' } };
    }
}

export async function POST(req: Request, { params }: { params: { action: string[] } }) {
    const action = params.action[0];
    const body = await req.json().catch(() => ({}));

    // 1. Create Instance
    if (action === 'create') {
        const res = await fetchEvolution('/instance/create', {
            method: 'POST',
            body: JSON.stringify({
                instanceName: INSTANCE_NAME,
                token: 'random_token',
                qrcode: true
            })
        });
        return NextResponse.json(res.data, { status: res.status });
    }

    // 2. Connect (Get QR Code)
    if (action === 'connect') {
        const res = await fetchEvolution(`/instance/connect/${INSTANCE_NAME}`);
        return NextResponse.json(res.data, { status: res.status });
    }

    // 3. Status
    if (action === 'status') {
        const res = await fetchEvolution(`/instance/connectionState/${INSTANCE_NAME}`);
        return NextResponse.json(res.data, { status: res.status });
    }

    // 4. Send Message key logic
    if (action === 'send-text') {
        const { phone, message } = body;
        const res = await fetchEvolution(`/message/sendText/${INSTANCE_NAME}`, {
            method: 'POST',
            body: JSON.stringify({
                number: phone,
                options: {
                    delay: 1200,
                    presence: 'composing',
                    linkPreview: false
                },
                textMessage: {
                    text: message
                }
            })
        });
        return NextResponse.json(res.data, { status: res.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function GET(req: Request, { params }: { params: { action: string[] } }) {
    const action = params.action[0];

    // Status check
    if (action === 'status') {
        const res = await fetchEvolution(`/instance/connectionState/${INSTANCE_NAME}`);
        return NextResponse.json(res.data, { status: res.status });
    }

    // List instances (Debug)
    if (action === 'list') {
        const res = await fetchEvolution('/instance/fetchInstances');
        return NextResponse.json(res.data, { status: res.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
