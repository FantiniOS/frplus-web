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

/**
 * Extrai a Marca de uma string de produto.
 */
function extrairMarca(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return ''
    if (produtoNome.includes(' - ')) {
        const partes = produtoNome.split(' - ')
        const marca = partes[partes.length - 1].trim()
        return marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase()
    }
    const tokens = produtoNome.trim().split(/\s+/)
    const ultima = tokens[tokens.length - 1]
    return ultima.charAt(0).toUpperCase() + ultima.slice(1).toLowerCase()
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

    // 2. Buscar todos os produtos ativos e agrupar por categoria
    const produtos = await prisma.produto.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, categoria: true, codigo: true, unidade: true, preco50a199: true, preco200a699: true, precoAtacado: true, precoAtacadoAVista: true, precoRedes: true, fabrica: { select: { nome: true } } }
    })

    // Mapa de produto -> categoria
    const produtoCategoria = new Map<string, string>()
    const categoriasDisponiveis = new Set<string>()
    for (const p of produtos) {
        const cat = (p.categoria || 'Geral').trim()
        produtoCategoria.set(p.id, cat)
        categoriasDisponiveis.add(cat)
    }

    // Mapa de categoria -> produto sugerido completo (pick the first active product in category)
    const categoriaProdutoSugerido = new Map<string, typeof produtos[0]>()
    for (const p of produtos) {
        const cat = (p.categoria || 'Geral').trim()
        if (!categoriaProdutoSugerido.has(cat)) {
            categoriaProdutoSugerido.set(cat, p)
        }
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

    // 4. Agregar volume por cliente e por categoria
    // Map<clienteId, Map<categoria, totalQuantidade>>
    const clienteCategoriaVolume = new Map<string, Map<string, number>>()

    for (const pedido of pedidos) {
        let catVolMap = clienteCategoriaVolume.get(pedido.clienteId)
        if (!catVolMap) {
            catVolMap = new Map<string, number>()
            clienteCategoriaVolume.set(pedido.clienteId, catVolMap)
        }
        for (const item of pedido.itens) {
            const cat = produtoCategoria.get(item.produtoId) || 'Geral'
            catVolMap.set(cat, (catVolMap.get(cat) || 0) + item.quantidade)
        }
    }

    // 5. Identificar o Gap de Mix
    // Para cada cliente ativo que tem volume alto em alguma categoria, verificar
    // se há categorias complementares com volume ZERO.
    const opportunities: CrossSellOpportunity[] = []

    // Determinar o volume médio mínimo para considerar "alto volume" (percentil 50 de todos)
    const allVolumes: number[] = []
    clienteCategoriaVolume.forEach((catMap) => {
        catMap.forEach((vol) => allVolumes.push(vol))
    })
    allVolumes.sort((a, b) => a - b)
    const medianVolume = allVolumes.length > 0 ? allVolumes[Math.floor(allVolumes.length * 0.5)] : 10
    const volumeThreshold = Math.max(10, medianVolume) // Pelo menos 10 unidades para considerar "alto volume"

    // Categorias disponíveis como array
    const allCategories = Array.from(categoriasDisponiveis)
    if (allCategories.length < 2) return [] // Needs at least 2 categories to cross-sell

    for (const cliente of clientesAtivos) {
        const catVolMap = clienteCategoriaVolume.get(cliente.id)
        if (!catVolMap || catVolMap.size === 0) continue

        // Encontrar a(s) categoria(s) forte(s) do cliente
        const catEntries = Array.from(catVolMap.entries()).sort((a, b) => b[1] - a[1])
        const categoriaForte = catEntries[0]

        if (categoriaForte[1] < volumeThreshold) continue // Volume baixo, skip

        // Encontrar categorias com volume ZERO
        const categoriasDoCliente = new Set(catEntries.map(e => e[0]))

        for (const catDisponivel of allCategories) {
            if (categoriasDoCliente.has(catDisponivel)) continue // Já compra
            if (catDisponivel === 'Geral') continue // Skip generic

            const prodObj = categoriaProdutoSugerido.get(catDisponivel)
            if (!prodObj) continue

            // Obter preço correto baseado na tabela do cliente
            const tabelaKey = (cliente.tabelaPreco || '50a199').toLowerCase().replace(/\s/g, '')
            let preco = Number(prodObj.preco50a199) || 0
            if (tabelaKey.includes('200') || tabelaKey.includes('699')) preco = Number(prodObj.preco200a699) || preco
            else if (tabelaKey === 'avista') preco = Number(prodObj.precoAtacadoAVista) || preco
            else if (tabelaKey.includes('atacado')) preco = Number(prodObj.precoAtacado) || preco
            else if (tabelaKey.includes('redes') || tabelaKey.includes('rede')) preco = Number(prodObj.precoRedes) || preco

            opportunities.push({
                clienteId: cliente.id,
                clienteNome: cliente.nomeFantasia,
                clienteComprador: cliente.comprador,
                tabelaPreco: cliente.tabelaPreco || '50a199',
                tabelaLabel: getTabelaLabel(cliente.tabelaPreco),
                categoriaFaltante: catDisponivel,
                produtoSugerido: prodObj.nome,
                produtoCodigo: prodObj.codigo,
                produtoUnidade: prodObj.unidade || 'CX',
                produtoPreco: preco,
                fabricaNome: prodObj.fabrica?.nome || '',
                volumeCategoriaPrincipal: categoriaForte[1],
                categoriaForte: categoriaForte[0],
            })
            break // 1 oportunidade por cliente para não poluir
        }
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
    tabelaLabel: string
): Promise<string> {
    // Bloco de regra pela tabela
    let regraTabela = ''
    const tabelaLower = tabelaLabel.toLowerCase()
    if (tabelaLower.includes('50') || tabelaLower.includes('199') || tabelaLower.includes('200') || tabelaLower.includes('699')) {
        regraTabela = 'foque em giro rápido, defesa contra concorrência e consumidor final.'
    } else if (tabelaLower.includes('atacado') && tabelaLower.includes('vista')) {
        regraTabela = 'foque em margem de revenda, giro de capital e markup.'
    } else if (tabelaLower.includes('atacado')) {
        regraTabela = 'foque em margem de revenda, giro de capital e markup.'
    } else if (tabelaLower.includes('redes') || tabelaLower.includes('rede')) {
        regraTabela = 'foque em rentabilidade por m² de gôndola, gestão de categoria e verbas.'
    } else {
        regraTabela = 'foque em giro rápido, defesa contra concorrência e consumidor final.'
    }

    const systemPrompt = `Você é um estrategista comercial agressivo. O cliente ${nomeCliente} compra muito, mas não possui ${produtoFaltante}. A tabela de preços dele é: ${tabelaLabel}.
Crie um argumento de vendas persuasivo (máximo 4 linhas). Sem saudações.
Regra pela tabela:
- 50 a 199cx / 200 a 699cx: foque em giro rápido, defesa contra concorrência e consumidor final.
- Atacado / Atacado a vista: foque em margem de revenda, giro de capital e markup.
- Redes: foque em rentabilidade por m² de gôndola, gestão de categoria e verbas.`

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
                        { role: 'user', content: `Gere o argumento de venda para ${nomeCliente} sobre ${produtoFaltante}. Retorne APENAS o argumento, sem explicações extras.` }
                    ],
                    temperature: 0.7,
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

    return `${produtoFaltante} tem alta aderência para o perfil deste cliente. Introduzir esse produto no mix pode representar um ganho significativo de margem e competitividade.`
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

        // ETAPA 2: Gerar argumentos de IA em paralelo (batch de 5 por vez para não overloadar)
        const batchSize = 5
        const results: Array<{
            clienteId: string
            clienteNome: string
            clienteComprador: string | null
            tabelaPreco: string
            tabelaLabel: string
            categoriaFaltante: string
            produtoSugerido: string
            argumentoIA: string
            volumeCategoriaPrincipal: number
            categoriaForte: string
        }> = []

        for (let i = 0; i < opportunities.length; i += batchSize) {
            const batch = opportunities.slice(i, i + batchSize)
            const batchResults = await Promise.all(
                batch.map(async (opp) => {
                    const argumento = await gerarArgumentoDeVenda(
                        opp.clienteComprador || opp.clienteNome,
                        opp.produtoSugerido,
                        opp.tabelaLabel
                    )
                    return {
                        ...opp,
                        argumentoIA: argumento
                    }
                })
            )
            results.push(...batchResults)
        }

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
