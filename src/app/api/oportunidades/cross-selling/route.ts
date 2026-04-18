import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// HELPERS
// ============================================================

const TABELA_LABELS: Record<string, string> = {
    '50a199': '50 a 199cx',
    '200a699': '200 a 699cx',
    'atacado': 'Atacado',
    'avista': 'Atacado a vista',
    'redes': 'Redes',
}

function getTabelaLabel(tabela: string | null | undefined): string {
    if (!tabela) return '50 a 199cx'
    const key = tabela.toLowerCase().replace(/\s/g, '')
    return TABELA_LABELS[key] || tabela
}

function getPrecoByTabela(prodObj: any, tabKey: string): number {
    let preco = Number(prodObj.preco50a199) || 0
    if (tabKey.includes('200') || tabKey.includes('699')) preco = Number(prodObj.preco200a699) || preco
    else if (tabKey === 'avista') preco = Number(prodObj.precoAtacadoAVista) || preco
    else if (tabKey.includes('atacado')) preco = Number(prodObj.precoAtacado) || preco
    else if (tabKey.includes('redes') || tabKey.includes('rede')) preco = Number(prodObj.precoRedes) || preco
    return preco
}

// ============================================================
// MINERAÇÃO DE DADOS: Gap de Mix (Cross-Selling)
// ============================================================

interface CrossSellOpportunity {
    clienteId: string
    clienteNome: string
    clienteComprador: string | null
    tabelaPreco: string
    tabelaLabel: string
    categoriaFaltante: string
    produtoSugerido: string
    produtoCodigo: string
    produtoUnidade: string
    produtoPreco: number
    custoReal: number
    precoGondola: number
    margemPercent: number
    lucroProjetado20: number
    fabricaNome: string
    volumeCategoriaPrincipal: number
    categoriaForte: string
}

async function minerarGapDeMix(): Promise<CrossSellOpportunity[]> {
    // 1. Buscar todos os clientes ativos
    const clientesAtivos = await prisma.cliente.findMany({
        where: { status: 'Ativo' },
        select: {
            id: true,
            nomeFantasia: true,
            comprador: true,
            tabelaPreco: true,
        }
    })

    if (clientesAtivos.length === 0) return []

    // 2. Buscar todos os produtos ativos (com pricing e fábrica)
    const produtos = await prisma.produto.findMany({
        where: { ativo: true },
        select: {
            id: true, nome: true, categoria: true, codigo: true, unidade: true,
            preco50a199: true, preco200a699: true, precoAtacado: true,
            precoAtacadoAVista: true, precoRedes: true,
            fabrica: { select: { nome: true } }
        }
    })

    // Lookup: produtoId -> categoria
    const produtoCategoria = new Map<string, string>()
    for (const p of produtos) {
        produtoCategoria.set(p.id, (p.categoria || 'Geral').trim())
    }

    // 3. Buscar os últimos 6 meses de pedidos com itens
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const pedidos = await prisma.pedido.findMany({
        where: {
            data: { gte: sixMonthsAgo },
            tipo: 'Venda',
            status: { in: ['Novo', 'Pendente', 'Processando', 'Concluido', 'Faturado', 'Importado', 'FATURADO', 'CONCLUIDO'] }
        },
        select: {
            clienteId: true,
            itens: {
                select: { produtoId: true, quantidade: true }
            }
        }
    })

    // 4a. Agregar volume por cliente POR CATEGORIA
    const clienteCategoriaVolume = new Map<string, Map<string, number>>()
    // 4b. Agregar set de PRODUTOS que cada cliente já comprou
    const clientProductSet = new Map<string, Set<string>>()

    for (const pedido of pedidos) {
        let catVolMap = clienteCategoriaVolume.get(pedido.clienteId)
        if (!catVolMap) {
            catVolMap = new Map<string, number>()
            clienteCategoriaVolume.set(pedido.clienteId, catVolMap)
        }
        let prodSet = clientProductSet.get(pedido.clienteId)
        if (!prodSet) {
            prodSet = new Set<string>()
            clientProductSet.set(pedido.clienteId, prodSet)
        }

        for (const item of pedido.itens) {
            const cat = produtoCategoria.get(item.produtoId) || 'Geral'
            catVolMap.set(cat, (catVolMap.get(cat) || 0) + item.quantidade)
            prodSet.add(item.produtoId)
        }
    }

    // 5. Threshold de "alto volume"
    const allVolumes: number[] = []
    clienteCategoriaVolume.forEach((catMap) => {
        catMap.forEach((vol) => allVolumes.push(vol))
    })
    allVolumes.sort((a, b) => a - b)
    const medianVolume = allVolumes.length > 0 ? allVolumes[Math.floor(allVolumes.length * 0.5)] : 10
    const volumeThreshold = Math.max(10, medianVolume)

    // 6. Build per-TABELA (segment) product popularity ranking
    //    This ensures products are ranked by what SELLS BEST in each price segment
    const clienteTabelaMap = new Map<string, string>()
    for (const c of clientesAtivos) {
        clienteTabelaMap.set(c.id, (c.tabelaPreco || '50a199').toLowerCase().replace(/\s/g, ''))
    }

    const segmentProductPop = new Map<string, Map<string, number>>()
    for (const pedido of pedidos) {
        const tabKey = clienteTabelaMap.get(pedido.clienteId) || '50a199'
        let popMap = segmentProductPop.get(tabKey)
        if (!popMap) {
            popMap = new Map<string, number>()
            segmentProductPop.set(tabKey, popMap)
        }
        for (const item of pedido.itens) {
            popMap.set(item.produtoId, (popMap.get(item.produtoId) || 0) + item.quantidade)
        }
    }

    // ============================================================
    // 7. PER-CLIENT GAP DETECTION — each client gets a UNIQUE product
    //    Walk the segment popularity ranking for the client's tabela.
    //    Find the most popular product (in their segment) that:
    //      a) Is in a category the client does NOT buy
    //      b) The client has never bought
    //    This ensures different clients get different products.
    // ============================================================
    const opportunities: CrossSellOpportunity[] = []

    for (const cliente of clientesAtivos) {
        const catVolMap = clienteCategoriaVolume.get(cliente.id)
        if (!catVolMap || catVolMap.size === 0) continue

        // Client's top category by volume
        const catEntries = Array.from(catVolMap.entries()).sort((a, b) => b[1] - a[1])
        const categoriaForte = catEntries[0]
        if (categoriaForte[1] < volumeThreshold) continue

        // Categories this client already buys
        const categoriasDoCliente = new Set(catEntries.map(e => e[0]))
        // Products this client already bought
        const myProductIds = clientProductSet.get(cliente.id) || new Set<string>()

        // Get segment popularity for this client's tabela
        const tabKey = clienteTabelaMap.get(cliente.id) || '50a199'
        const segPop = segmentProductPop.get(tabKey)

        // Build candidate list: products in missing categories, scored by segment popularity
        const candidates: Array<{ prod: typeof produtos[0]; cat: string; popularity: number }> = []

        for (const p of produtos) {
            const cat = (p.categoria || 'Geral').trim()
            if (cat === 'Geral') continue
            if (categoriasDoCliente.has(cat)) continue // Client already buys this category
            if (myProductIds.has(p.id)) continue       // Client already bought this specific product

            const popularity = segPop?.get(p.id) || 0
            candidates.push({ prod: p, cat, popularity })
        }

        if (candidates.length === 0) continue

        // Sort by popularity DESC — most popular product this client doesn't have
        candidates.sort((a, b) => b.popularity - a.popularity)

        const best = candidates[0]
        const prodObj = best.prod
        
        // --- CÁLCULO FINANCEIRO REAL (CENÁRIO 20 CAIXAS) ---
        const preco = getPrecoByTabela(prodObj, tabKey)
        const impostoRate = 0.12
        const custoReal = preco * (1 + impostoRate)
        const margemRate = (tabKey.includes('atacado') || tabKey.includes('avista')) ? 0.10 : tabKey.includes('redes') ? 0.15 : 0.22
        const precoGondola = custoReal / (1 - margemRate)
        const margemPercent = margemRate * 100
        const lucroUnit = precoGondola - custoReal
        const lucroProj20 = lucroUnit * 20

        opportunities.push({
            clienteId: cliente.id,
            clienteNome: cliente.nomeFantasia,
            clienteComprador: cliente.comprador,
            tabelaPreco: cliente.tabelaPreco || '50a199',
            tabelaLabel: getTabelaLabel(cliente.tabelaPreco),
            categoriaFaltante: best.cat,
            produtoSugerido: prodObj.nome,
            produtoCodigo: prodObj.codigo,
            produtoUnidade: prodObj.unidade || 'CX',
            produtoPreco: preco,
            custoReal: custoReal,
            precoGondola: precoGondola,
            margemPercent: margemPercent,
            lucroProjetado20: lucroProj20,
            fabricaNome: prodObj.fabrica?.nome || '',
            volumeCategoriaPrincipal: categoriaForte[1],
            categoriaForte: categoriaForte[0],
        })
    }

    // Ordenar: maior volume primeiro (clientes mais valiosos primeiro)
    opportunities.sort((a, b) => b.volumeCategoriaPrincipal - a.volumeCategoriaPrincipal)

    return opportunities.slice(0, 30) // Limitar a 30 resultados
}

// ============================================================
// IA: Geração de Argumento de Venda
// ============================================================

async function gerarArgumentoDeVenda(
    nomeCliente: string,
    produtoFaltante: string,
    tabelaLabel: string,
    custoNF: number,
    precoGondola: number,
    margemPercent: number,
    lucroProjetado20: number
): Promise<string> {
    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const strCusto = fmtBRL(custoNF)
    const strGondola = fmtBRL(precoGondola)
    const strLucro = fmtBRL(lucroProjetado20)
    
    const systemPrompt = `Você é um estrategista comercial sênior falando com um comprador. 
DADOS REAIS DA PROPOSTA: 
- Cliente: ${nomeCliente}
- Tabela: ${tabelaLabel}
- Produto: ${produtoFaltante}
- Custo NF atual: ${strCusto}
- Preço de Gôndola Sugerido: ${strGondola}
- Margem de Lucro: ${margemPercent.toFixed(0)}%
- Lucro Líquido Projetado na compra de 20 caixas: ${strLucro}

Sua tarefa: Escreva um pitch de vendas curto e agressivo (máximo 4 linhas) para o WhatsApp. 
REGRA ABSOLUTA: PROIBIDO usar adjetivos genéricos (ex: 'excelente produto', 'aumente seus lucros'). Você DEVE usar os números exatos fornecidos acima para provar matematicamente por que ele deve comprar. Foque no Lucro Projetado em Reais e na Margem. Sem saudações.`

    // ---- TENTATIVA 1: Groq (primário) ----
    const groqKey = process.env.GROQ_API_KEY
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
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Gere o argumento de venda com o Lucro de ${strLucro} para ${nomeCliente}.` }
                    ],
                    temperature: 0.2, // Baixa temperatura para foco exato nos dados
                    max_tokens: 300
                })
            })

            if (groqRes.ok) {
                const groqData = await groqRes.json()
                const text = groqData.choices?.[0]?.message?.content?.trim()
                if (text && text.length > 10) {
                    return text
                }
            }

            if (groqRes.status === 429) {
                console.warn('[Cross-Sell] Groq rate limited, tentando fallback Gemini...')
            }
        } catch (groqErr) {
            console.warn('[Cross-Sell] Erro no Groq, tentando fallback Gemini:', groqErr)
        }
    }

    // ---- TENTATIVA 2: Gemini (fallback) ----
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai')
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
            const result = await model.generateContent(systemPrompt + `\n\nGere o argumento agora para ${nomeCliente}.`)
            const text = result.response.text()
            if (text && text.trim().length > 10) {
                return text.trim()
            }
        } catch (geminiErr) {
            console.warn('[Cross-Sell] Erro no Gemini:', geminiErr)
        }
    }

    return `${produtoFaltante} proporciona uma margem de ${margemPercent.toFixed(0)}%. Ao focar no giro de 20 caixas, sua loja garante ${strLucro} de lucro limpo usando o preço sugerido de ${strGondola}.`
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function GET() {
    try {
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        // ETAPA 1: Mineração de dados (Gap de Mix)
        const opportunities = await minerarGapDeMix()

        if (opportunities.length === 0) {
            return NextResponse.json({
                crossSelling: [],
                total: 0
            })
        }

        // DEBUG: Log do array ANTES de gerar argumentos IA — verificar unicidade
        console.log('[Cross-Sell] Oportunidades mineradas ANTES da IA:', JSON.stringify(
            opportunities.map(o => ({
                cliente: o.clienteNome,
                produto: o.produtoSugerido,
                catFaltante: o.categoriaFaltante,
                lucroProjetado20: o.lucroProjetado20
            })),
            null, 2
        ))

        // ETAPA 2: Gerar argumentos de IA em paralelo (cada chamada com contexto isolado e exato)
        const results = await Promise.all(
            opportunities.map(async (opp) => {
                const argumento = await gerarArgumentoDeVenda(
                    opp.clienteComprador || opp.clienteNome,
                    opp.produtoSugerido,
                    opp.tabelaLabel,
                    opp.produtoPreco,
                    opp.precoGondola,
                    opp.margemPercent,
                    opp.lucroProjetado20
                )
                return {
                    ...opp,
                    argumentoIA: argumento
                }
            })
        )

        // DEBUG: Log do array FINAL
        console.log('[Cross-Sell] Array FINAL enviado ao frontend:', JSON.stringify(
            results.map(r => ({
                cliente: r.clienteNome,
                produto: r.produtoSugerido,
                argumento: r.argumentoIA.substring(0, 60) + '...',
            })),
            null, 2
        ))

        return NextResponse.json({
            crossSelling: results,
            total: results.length
        })

    } catch (error) {
        console.error('[Cross-Sell API] Erro:', error)
        return NextResponse.json(
            { error: 'Falha ao buscar oportunidades de cross-selling' },
            { status: 500 }
        )
    }
}
