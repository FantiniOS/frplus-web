import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// POST /api/ai/generate-message - Generate a data-driven WhatsApp message for a client
export const dynamic = 'force-dynamic'

// ============================================================
// TYPES
// ============================================================

interface FatosEstrategicos {
    comprador: string
    motivo: 'Reposição de Estoque' | 'Cross-Sell' | 'Oportunidade Sazonal' | 'Contato Geral'
    produtoFoco: string
    justificativa: string
    sugestaoAdicional?: string
    fatorSazonal?: string
}

interface GenerateMessageRequest {
    clienteId: string
}

interface ProductPurchaseStats {
    produtoId: string
    produtoNome: string
    totalQuantidade: number
    compras: Date[]
}

// ============================================================
// ETAPA 1: MINERAÇÃO DE DADOS (Prisma Queries)
// ============================================================

/**
 * Busca o nome do comprador real do cliente.
 * NUNCA usa Razão Social/Nome Fantasia.
 * Fallback: primeiro nome do nomeFantasia se comprador não existir.
 */
async function buscarNomeComprador(clienteId: string): Promise<string> {
    const cliente = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { comprador: true, nomeFantasia: true }
    })

    if (!cliente) throw new Error('Cliente não encontrado')

    if (cliente.comprador && cliente.comprador.trim() !== '') {
        return cliente.comprador.split(' ')[0]
    }

    // Fallback: primeiro nome do nomeFantasia
    return cliente.nomeFantasia.split(' ')[0]
}

/**
 * Alerta de Reposição (Ciclo de Vida):
 * - Identifica o produto mais comprado pelo cliente
 * - Calcula a média de dias entre compras desse produto
 * - Compara com a data da última compra
 * - Se estiver perto ou passando do prazo → gatilho "Reposição de Estoque"
 */
async function analisarReposicao(clienteId: string): Promise<{
    produtoFoco: string
    cicloMedio: number
    diasDesdeUltimaCompra: number
    gatilhoAtivado: boolean
    justificativa: string
} | null> {
    // Buscar todos os pedidos do cliente com itens
    const pedidos = await prisma.pedido.findMany({
        where: {
            clienteId,
            tipo: 'Venda' // Ignora bonificações
        },
        include: {
            itens: {
                include: { produto: true }
            }
        },
        orderBy: { data: 'asc' }
    })

    if (pedidos.length < 2) return null

    // Agrupar itens por produto e contar quantidade total + datas de compra
    const statsMap = new Map<string, ProductPurchaseStats>()

    for (const pedido of pedidos) {
        for (const item of pedido.itens) {
            const existing = statsMap.get(item.produtoId)
            if (existing) {
                existing.totalQuantidade += item.quantidade
                // Adicionar data se for uma compra diferente
                const pedidoDate = new Date(pedido.data)
                if (!existing.compras.some(d => d.getTime() === pedidoDate.getTime())) {
                    existing.compras.push(pedidoDate)
                }
            } else {
                statsMap.set(item.produtoId, {
                    produtoId: item.produtoId,
                    produtoNome: item.produto.nome,
                    totalQuantidade: item.quantidade,
                    compras: [new Date(pedido.data)]
                })
            }
        }
    }

    if (statsMap.size === 0) return null

    // Produto mais comprado (por quantidade total)
    const produtoTop = Array.from(statsMap.values())
        .filter(p => p.compras.length >= 2) // Precisa de pelo menos 2 compras para calcular ciclo
        .sort((a, b) => b.totalQuantidade - a.totalQuantidade)[0]

    if (!produtoTop) return null

    // Calcular ciclo médio entre compras deste produto
    const comprasOrdenadas = produtoTop.compras.sort((a, b) => a.getTime() - b.getTime())
    let totalDias = 0
    for (let i = 1; i < comprasOrdenadas.length; i++) {
        totalDias += Math.floor(
            (comprasOrdenadas[i].getTime() - comprasOrdenadas[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        )
    }
    const cicloMedio = Math.max(7, Math.floor(totalDias / (comprasOrdenadas.length - 1)))

    // Dias desde a última compra deste produto
    const ultimaCompra = comprasOrdenadas[comprasOrdenadas.length - 1]
    const diasDesdeUltimaCompra = Math.floor(
        (Date.now() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Gatilho: se estiver a 90% ou mais do ciclo médio
    const gatilhoAtivado = diasDesdeUltimaCompra >= cicloMedio * 0.9

    const justificativa = gatilhoAtivado
        ? `O cliente compra "${produtoTop.produtoNome}" em média a cada ${cicloMedio} dias e já fazem ${diasDesdeUltimaCompra} dias desde a última compra deste produto.`
        : `O cliente compra "${produtoTop.produtoNome}" em média a cada ${cicloMedio} dias. Última compra há ${diasDesdeUltimaCompra} dias.`

    return {
        produtoFoco: produtoTop.produtoNome,
        cicloMedio,
        diasDesdeUltimaCompra,
        gatilhoAtivado,
        justificativa
    }
}

/**
 * Oportunidade de Cross-Sell (Market Basket / Collaborative Filtering):
 * - Identifica a fábrica "Core" do cliente (mais comprada)
 * - Busca o que OUTROS clientes que compram da mesma fábrica também compram
 * - Filtra produtos que este cliente NÃO comprou nos últimos 6 meses
 * - Retorna o top produto como sugestão real de afinidade
 */
async function analisarCrossSell(clienteId: string): Promise<{
    produtoSugerido: string
    justificativa: string
} | null> {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // Buscar pedidos do cliente com produtos (incluindo fábrica)
    const meusPedidos = await prisma.pedido.findMany({
        where: { clienteId, tipo: 'Venda' },
        include: {
            itens: { include: { produto: { include: { fabrica: true } } } }
        }
    })

    if (meusPedidos.length === 0) return null

    // STEP 1: Identificar a fábrica Core (mais comprada por quantidade)
    const fabricaQtdMap = new Map<string, { nome: string; qtd: number }>()
    const meusProdutoIds = new Set<string>()
    const meusRecentes = new Set<string>()

    for (const pedido of meusPedidos) {
        for (const item of pedido.itens) {
            meusProdutoIds.add(item.produtoId)
            if (new Date(pedido.data) >= sixMonthsAgo) {
                meusRecentes.add(item.produtoId)
            }

            const fabId = item.produto.fabricaId
            const existing = fabricaQtdMap.get(fabId)
            if (existing) {
                existing.qtd += item.quantidade
            } else {
                fabricaQtdMap.set(fabId, {
                    nome: item.produto.fabrica?.nome || 'Fábrica',
                    qtd: item.quantidade
                })
            }
        }
    }

    // Ordenar fábricas por quantidade desc
    const fabricasOrdenadas = Array.from(fabricaQtdMap.entries())
        .sort((a, b) => b[1].qtd - a[1].qtd)

    // STEP 2: Para cada fábrica core, buscar o que outros compradores compram
    for (const [coreFactoryId, coreFactoryInfo] of fabricasOrdenadas) {
        // Buscar outros clientes que compram desta fábrica
        const outrosCompradores = await prisma.itemPedido.findMany({
            where: {
                produto: { fabricaId: coreFactoryId },
                pedido: { clienteId: { not: clienteId } }
            },
            select: { pedido: { select: { clienteId: true } } },
            distinct: ['pedidoId']
        })

        const outrosClienteIds = Array.from(new Set(outrosCompradores.map(o => o.pedido.clienteId)))
        if (outrosClienteIds.length === 0) continue

        // O que esses clientes similares compram (agregado por produto)
        const itensSimilares = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            where: {
                pedido: { clienteId: { in: outrosClienteIds } }
            },
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 20
        })

        // STEP 3: Gap Filter — produto que eu NÃO comprei nos últimos 6 meses
        for (const item of itensSimilares) {
            if (meusRecentes.has(item.produtoId)) continue // comprou recentemente

            const prod = await prisma.produto.findUnique({
                where: { id: item.produtoId },
                select: { nome: true, fabrica: { select: { nome: true } } }
            })
            if (!prod) continue

            const nuncaComprou = !meusProdutoIds.has(item.produtoId)
            const qtdSimilares = item._sum.quantidade || 0

            return {
                produtoSugerido: prod.nome,
                justificativa: nuncaComprou
                    ? `Clientes que compram "${coreFactoryInfo.nome}" também compram "${prod.nome}" (${qtdSimilares} unidades entre clientes similares). Este cliente nunca comprou.`
                    : `"${prod.nome}" é frequente entre clientes similares (${qtdSimilares} un.), mas este cliente não compra há mais de 6 meses.`
            }
        }
    }

    return null
}

/**
 * Fator Sazonal:
 * - Verifica o histórico de compras dos últimos anos
 * - Existe produto que o cliente sempre compra em maior volume no mês atual?
 * - Compara volume do mês atual histórico vs média dos outros meses
 */
async function analisarSazonalidade(clienteId: string): Promise<{
    produtoSazonal: string
    justificativa: string
} | null> {
    const mesAtual = new Date().getMonth() // 0-11

    // Buscar todos os pedidos do cliente com itens
    const pedidos = await prisma.pedido.findMany({
        where: {
            clienteId,
            tipo: 'Venda'
        },
        include: {
            itens: {
                include: { produto: true }
            }
        },
        orderBy: { data: 'asc' }
    })

    // Precisamos de pelo menos 6 meses de histórico para sazonalidade
    if (pedidos.length < 4) return null

    const primeiroPedido = new Date(pedidos[0].data)
    const mesesHistorico = Math.floor(
        (Date.now() - primeiroPedido.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    if (mesesHistorico < 6) return null

    // Agrupar itens por produto e por mês
    const produtoMesMap = new Map<string, { nome: string; meses: Map<number, number> }>()

    for (const pedido of pedidos) {
        const mes = new Date(pedido.data).getMonth()
        for (const item of pedido.itens) {
            if (!produtoMesMap.has(item.produtoId)) {
                produtoMesMap.set(item.produtoId, {
                    nome: item.produto.nome,
                    meses: new Map()
                })
            }
            const registro = produtoMesMap.get(item.produtoId)!
            registro.meses.set(mes, (registro.meses.get(mes) || 0) + item.quantidade)
        }
    }

    // Para cada produto, verificar se o mês atual tem volume acima da média
    type SazonalResult = { nome: string; ratio: number; qtdMesAtual: number; mediaOutros: number }

    const allEntries = Array.from(produtoMesMap.entries())
    const melhorSazonal = allEntries.reduce<SazonalResult | null>((best, [, dados]) => {
        const qtdMesAtual = dados.meses.get(mesAtual) || 0
        if (qtdMesAtual === 0) return best

        // Média dos outros meses
        let totalOutros = 0
        let countOutros = 0
        Array.from(dados.meses.entries()).forEach(([mes, qtd]) => {
            if (mes !== mesAtual) {
                totalOutros += qtd
                countOutros++
            }
        })

        if (countOutros === 0) return best
        const mediaOutros = totalOutros / countOutros

        const ratio = qtdMesAtual / mediaOutros

        // Sazonal se o volume no mês atual for 30%+ acima da média dos outros meses
        if (ratio > 1.3 && (!best || ratio > best.ratio)) {
            return {
                nome: dados.nome,
                ratio,
                qtdMesAtual,
                mediaOutros
            }
        }

        return best
    }, null)

    if (!melhorSazonal) return null

    const percentAcima = Math.round((melhorSazonal.ratio - 1) * 100)
    const nomeMes = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ][mesAtual]

    return {
        produtoSazonal: melhorSazonal.nome,
        justificativa: `Historicamente, o cliente compra ${percentAcima}% a mais de "${melhorSazonal.nome}" no mês de ${nomeMes} comparado aos outros meses.`
    }
}

// ============================================================
// ETAPA 2: CONSOLIDAÇÃO DO CONTEXTO (Data Facts)
// ============================================================

async function consolidarFatos(clienteId: string): Promise<FatosEstrategicos> {
    // Executar todas as análises em paralelo
    const [comprador, reposicao, crossSell, sazonalidade] = await Promise.all([
        buscarNomeComprador(clienteId),
        analisarReposicao(clienteId),
        analisarCrossSell(clienteId),
        analisarSazonalidade(clienteId)
    ])

    // Prioridade de motivo: Reposição > Sazonal > Cross-Sell > Geral
    let motivo: FatosEstrategicos['motivo'] = 'Contato Geral'
    let produtoFoco = ''
    let justificativa = ''
    let sugestaoAdicional: string | undefined
    let fatorSazonal: string | undefined

    // 1. Reposição de Estoque (prioridade máxima se gatilho ativado)
    if (reposicao?.gatilhoAtivado) {
        motivo = 'Reposição de Estoque'
        produtoFoco = reposicao.produtoFoco
        justificativa = reposicao.justificativa
    }
    // 2. Oportunidade Sazonal
    else if (sazonalidade) {
        motivo = 'Oportunidade Sazonal'
        produtoFoco = sazonalidade.produtoSazonal
        justificativa = sazonalidade.justificativa
    }
    // 3. Cross-Sell
    else if (crossSell) {
        motivo = 'Cross-Sell'
        produtoFoco = crossSell.produtoSugerido
        justificativa = crossSell.justificativa
    }
    // 4. Fallback: usa reposição mesmo sem gatilho (informativo)
    else if (reposicao) {
        motivo = 'Contato Geral'
        produtoFoco = reposicao.produtoFoco
        justificativa = reposicao.justificativa
    }
    // 5. Sem dados suficientes
    else {
        motivo = 'Contato Geral'
        produtoFoco = 'Portfólio geral'
        justificativa = 'Cliente com histórico insuficiente para análise detalhada. Sugestão de contato para manter relacionamento.'
    }

    // Adicionar cross-sell como sugestão adicional se não for o motivo principal
    if (crossSell && motivo !== 'Cross-Sell') {
        sugestaoAdicional = `${crossSell.produtoSugerido} (Cross-sell de alta saída na região). ${crossSell.justificativa}`
    }

    // Adicionar sazonalidade como informação extra se não for o motivo principal
    if (sazonalidade && motivo !== 'Oportunidade Sazonal') {
        fatorSazonal = sazonalidade.justificativa
    }

    return {
        comprador,
        motivo,
        produtoFoco,
        justificativa,
        sugestaoAdicional,
        fatorSazonal
    }
}

// ============================================================
// ETAPA 3: INJEÇÃO DE CONTEXTO NO LLM (Strict System Prompt)
// ============================================================

async function gerarMensagemComLLM(fatos: FatosEstrategicos): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada. Adicione a variável de ambiente GEMINI_API_KEY no seu .env.local')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Montar contexto dos fatos estratégicos
    let contextoDeFatos = `
FATOS MATEMÁTICOS EXTRAÍDOS DO SISTEMA:
- Motivo do contato: ${fatos.motivo}
- Produto foco: ${fatos.produtoFoco}
- Justificativa baseada em dados: ${fatos.justificativa}`

    if (fatos.sugestaoAdicional) {
        contextoDeFatos += `\n- Sugestão adicional de cross-sell: ${fatos.sugestaoAdicional}`
    }

    if (fatos.fatorSazonal) {
        contextoDeFatos += `\n- Fator sazonal: ${fatos.fatorSazonal}`
    }

    const systemPrompt = `Você é um representante comercial B2B sênior e de alta performance.

Escreva uma mensagem de WhatsApp curta (máximo 3 parágrafos curtos) para o seu cliente.

REGRA 1: Inicie a mensagem SEMPRE com um cumprimento informal usando apenas o primeiro nome do comprador: ${fatos.comprador}. Exemplo: "Fala ${fatos.comprador}, tudo bem?"

REGRA 2: Você é PROIBIDO de inventar ofertas, produtos ou motivos genéricos. Construa seu argumento EXCLUSIVAMENTE baseando-se nestes fatos matemáticos extraídos do sistema:
${contextoDeFatos}

REGRA 3: O tom deve ser de parceria e consultoria. Nunca use jargões robóticos como "Prezado", "Venho por meio desta" ou "Gostaria de oferecer". Fale como quem quer ajudar o cliente a não ficar sem estoque ou a ganhar mais dinheiro.

REGRA 4: Termine a mensagem com uma pergunta leve para incentivar a resposta. Exemplos: "Como está o estoque dessa linha por aí?", "Posso te mandar a tabela atualizada?", "Quer que eu separe uma condição especial?".

REGRA 5: NÃO use markdown, asteriscos, negritos ou formatação especial. Escreva texto puro como uma mensagem de WhatsApp normal.

REGRA 6: Escreva APENAS a mensagem. Sem explicações, sem alternativas, sem notas.`

    try {
        const result = await model.generateContent(systemPrompt)
        const response = result.response
        const text = response.text()

        if (!text || text.trim() === '') {
            throw new Error('LLM retornou uma mensagem vazia')
        }

        return text.trim()
    } catch (llmError: unknown) {
        // Detectar erro de Rate Limit / Quota Exceeded do Gemini
        const errMsg = llmError instanceof Error ? llmError.message : String(llmError)
        if (
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('quota') ||
            errMsg.toLowerCase().includes('rate') ||
            errMsg.toLowerCase().includes('resource has been exhausted') ||
            errMsg.toLowerCase().includes('too many requests')
        ) {
            const rateLimitError = new Error('RATE_LIMIT')
            throw rateLimitError
        }
        throw llmError
    }
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function POST(request: Request) {
    try {
        // Validar body
        const body = await request.json() as GenerateMessageRequest

        if (!body.clienteId || typeof body.clienteId !== 'string') {
            return NextResponse.json(
                { error: 'Campo "clienteId" é obrigatório e deve ser uma string.' },
                { status: 400 }
            )
        }

        // Verificar se o cliente existe
        const clienteExiste = await prisma.cliente.findUnique({
            where: { id: body.clienteId },
            select: { id: true, nomeFantasia: true, celular: true, telefone: true }
        })

        if (!clienteExiste) {
            return NextResponse.json(
                { error: 'Cliente não encontrado.' },
                { status: 404 }
            )
        }

        // ETAPA 1 + 2: Mineração de Dados + Consolidação
        const fatosEstrategicos = await consolidarFatos(body.clienteId)

        // ETAPA 3: Gerar mensagem com LLM
        const mensagem = await gerarMensagemComLLM(fatosEstrategicos)

        return NextResponse.json({
            mensagem,
            fatosEstrategicos,
            cliente: {
                id: clienteExiste.id,
                nome: clienteExiste.nomeFantasia,
                telefone: clienteExiste.celular || clienteExiste.telefone
            }
        })

    } catch (error) {
        console.error('Erro ao gerar mensagem IA:', error)

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'

        // Retornar 429 limpo para rate limit / cota excedida
        if (errorMessage === 'RATE_LIMIT' || errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
            return NextResponse.json(
                { error: 'O limite de gerações simultâneas foi atingido. Por favor, aguarde cerca de 1 minuto e tente novamente.' },
                { status: 429 }
            )
        }

        // Retornar erro específico para API key não configurada
        if (errorMessage.includes('GEMINI_API_KEY')) {
            return NextResponse.json(
                { error: errorMessage },
                { status: 500 }
            )
        }

        return NextResponse.json(
            { error: `Falha ao gerar mensagem: ${errorMessage}` },
            { status: 500 }
        )
    }
}
