'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

interface AnaliseClienteParams {
    nomeCliente: string;
    faturamento: string;
    giroDias: number;
    diasAusente: number;
    produtoMaisComprado: string | null;
    totalPedidos: number;
    ticketMedio: string;
    status: string;
    ano: number;
    mesMaisForte: string | null;
    top3Produtos: string[];
}

function buildPrompt(params: AnaliseClienteParams): string {
    const {
        nomeCliente,
        faturamento,
        giroDias,
        diasAusente,
        produtoMaisComprado,
        totalPedidos,
        ticketMedio,
        status,
        ano,
        mesMaisForte,
        top3Produtos
    } = params;

    return `Você é um Investigador de Mercado Sênior e Estrategista de Vendas B2B de Elite. Seu trabalho não é repetir os números, mas ler as entrelinhas e encontrar dinheiro deixado na mesa.
Dados do cliente "${nomeCliente}":
- Faturamento do ano: ${faturamento}
- Giro médio (ciclo de compras): ${giroDias} dias
- Tempo atual sem comprar: ${diasAusente} dias
- Produtos Curva A: ${produtoMaisComprado || 'Nenhum'}
- Status atual: ${status}

REGRAS: 
1. NUNCA repita os dados fornecidos. Eu já sei os números.
2. Fale com um tom direto, analítico e de alto nível comercial.
3. Entregue a análise dividida ESTRITAMENTE em 3 tópicos curtos e diretos (use os emojis exatos):

🔍 Ponto Cego: O que o comportamento de compra esconde? Existe potencial de aumento de ticket médio ignorado?
⚠️ Alerta Tático: Qual o risco real atual? (Ex: espaço aberto para a concorrência se o ciclo de compras estiver atrasado, ou risco de ruptura de estoque na gôndola).
🎯 Ação de Fechamento: Qual é o argumento de venda EXATO que o representante deve usar na ligação ou WhatsApp HOJE para forçar um novo pedido, considerando o mix da Belmont? (Dê o roteiro de abordagem).`;
}

export async function gerarAnaliseClienteIA(params: AnaliseClienteParams): Promise<{ texto: string } | { erro: string }> {
    const prompt = buildPrompt(params);

    // ── TENTATIVA 1: Groq (primário, mais rápido) ──
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'Você é um Investigador de Mercado Sênior e Estrategista de Vendas B2B de Elite. Entregue a análise estritamente na estrutura solicitada.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 600
                })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                const text = groqData.choices?.[0]?.message?.content?.trim();
                if (text && text.length > 10) {
                    return { texto: text };
                }
            }

            if (groqRes.status === 429) {
                console.warn('[AnaliseClienteIA] Groq rate limited, tentando fallback Gemini...');
            }
        } catch (groqErr) {
            console.warn('[AnaliseClienteIA] Erro no Groq, tentando fallback Gemini:', groqErr);
        }
    }

    // ── TENTATIVA 2: Gemini (fallback) ──
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        return { erro: 'Nenhuma API de IA configurada (GROQ_API_KEY ou GEMINI_API_KEY). Contate o administrador.' };
    }

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const texto = response.text();

        if (!texto || texto.trim().length === 0) {
            return { erro: 'A IA retornou uma resposta vazia. Tente novamente.' };
        }

        return { texto: texto.trim() };

    } catch (error: unknown) {
        console.error('[AnaliseClienteIA] Erro no Gemini (fallback):', error);

        const message = error instanceof Error ? error.message : 'Erro desconhecido';

        if (message.includes('API_KEY') || message.includes('401') || message.includes('403')) {
            return { erro: 'Chave da API inválida ou expirada.' };
        }
        if (message.includes('429') || message.includes('RATE_LIMIT')) {
            return { erro: 'Limite de requisições excedido em ambas as IAs. Aguarde 1 minuto e tente novamente.' };
        }

        return { erro: 'Falha ao gerar análise com IA. Tente novamente em instantes.' };
    }
}
