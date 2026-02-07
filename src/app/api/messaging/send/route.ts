import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface SendMessageRequest {
    clienteId: string;
    tipo: 'whatsapp' | 'email';
    mensagem: string;
    assunto?: string; // For email
}

// POST /api/messaging/send - Send message to client
export async function POST(request: Request) {
    try {
        const body: SendMessageRequest = await request.json();
        const { clienteId, tipo, mensagem, assunto } = body;

        // Get client data
        const cliente = await prisma.cliente.findUnique({
            where: { id: clienteId }
        });

        if (!cliente) {
            return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
        }

        let result: { success: boolean; message: string; externalId?: string } = {
            success: false,
            message: ''
        };

        if (tipo === 'whatsapp') {
            // Use Evolution API for WhatsApp
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const evolutionApiKey = process.env.EVOLUTION_API_KEY;
            const evolutionInstance = process.env.EVOLUTION_INSTANCE;

            if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
                // Fallback: just log and simulate success for demo
                console.log(`[WhatsApp Demo] Enviando para ${cliente.celular || cliente.telefone}: ${mensagem}`);
                result = {
                    success: true,
                    message: 'Mensagem registrada (modo demo - configure EVOLUTION_API_URL)'
                };
            } else {
                // Real Evolution API call
                const phone = (cliente.celular || cliente.telefone).replace(/\D/g, '');
                const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;

                try {
                    const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': evolutionApiKey
                        },
                        body: JSON.stringify({
                            number: fullPhone,
                            text: mensagem
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        result = {
                            success: true,
                            message: 'Mensagem enviada via WhatsApp',
                            externalId: data.key?.id
                        };
                    } else {
                        const error = await response.text();
                        result = { success: false, message: `Erro WhatsApp: ${error}` };
                    }
                } catch (err) {
                    result = { success: false, message: `Erro de conexão: ${err}` };
                }
            }
        } else if (tipo === 'email') {
            // Use Resend for Email
            const resendApiKey = process.env.RESEND_API_KEY;
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

            if (!resendApiKey) {
                // Fallback: just log and simulate success for demo
                console.log(`[Email Demo] Enviando para ${cliente.email}: ${mensagem}`);
                result = {
                    success: true,
                    message: 'Email registrado (modo demo - configure RESEND_API_KEY)'
                };
            } else {
                try {
                    const response = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendApiKey}`
                        },
                        body: JSON.stringify({
                            from: fromEmail,
                            to: cliente.email,
                            subject: assunto || 'Mensagem de FRPlus',
                            text: mensagem
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        result = {
                            success: true,
                            message: 'Email enviado com sucesso',
                            externalId: data.id
                        };
                    } else {
                        const error = await response.text();
                        result = { success: false, message: `Erro Resend: ${error}` };
                    }
                } catch (err) {
                    result = { success: false, message: `Erro de conexão: ${err}` };
                }
            }
        }

        // Log the contact in database
        await prisma.contatoCliente.create({
            data: {
                clienteId,
                tipo,
                mensagem,
                status: result.success ? 'enviado' : 'erro'
            }
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: result.message,
                externalId: result.externalId
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.message
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
    }
}

// GET /api/messaging/send - Get contact history
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clienteId = searchParams.get('clienteId');

        const where = clienteId ? { clienteId } : {};

        const contatos = await prisma.contatoCliente.findMany({
            where,
            include: {
                cliente: {
                    select: { nomeFantasia: true, razaoSocial: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json(contatos);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return NextResponse.json({ error: 'Erro ao buscar contatos' }, { status: 500 });
    }
}
