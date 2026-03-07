import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServerUser } from '@/lib/getServerUser'

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
    recebeBonificacao: boolean
}

interface GenerateMessageRequest {
    clienteId: string
    contextoParaIA?: string
}

interface ProductPurchaseStats {
    produtoId: string
    produtoNome: string
    totalQuantidade: number
    compras: Date[]
}

// ============================================================
// CONSTANTES
// ============================================================

/** Threshold em dias para considerar o cliente como churn (resgate). */
const DIAS_PARA_CHURN = 90;

// ============================================================
// HELPERS
// ============================================================

/**
 * Extrai APENAS o nome da Marca/Representada de uma string de produto.
 * Ex: 'VINAGRE DE MACA 750ML - BELMONT' → 'Belmont'
 * Ex: 'Vinagre de Álcool 750ml' → último token capitalizado
 * Se houver traço separador, pega o trecho após o último traço.
 * Senão, retorna a última palavra como fallback.
 */
function extrairMarca(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return '';

    // Se tem separador ' - ', a marca está depois do último traço
    if (produtoNome.includes(' - ')) {
        const partes = produtoNome.split(' - ');
        const marca = partes[partes.length - 1].trim();
        // Capitalizar: 'BELMONT' → 'Belmont'
        return marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
    }

    // Fallback: última palavra (pode ser a marca em nomes curtos)
    const tokens = produtoNome.trim().split(/\s+/);
    const ultima = tokens[tokens.length - 1];
    return ultima.charAt(0).toUpperCase() + ultima.slice(1).toLowerCase();
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
 * Oportunidade de Cross-Sell (Perfil do Cliente / Segmentação):
 * - Identifica o segmento/porte do cliente via tabelaPreco
 * - Busca OUTROS clientes com o mesmo perfil/segmento
 * - Descobre quais são os produtos Curva A (mais vendidos) nesse grupo
 * - Filtra produtos que este cliente NUNCA comprou (lacuna absoluta)
 * - Retorna o top produto como sugestão real baseada no perfil de negócio
 */
async function analisarCrossSell(clienteId: string): Promise<{
    produtoSugerido: string
    justificativa: string
} | null> {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // Get client info including tabelaPreco (segment proxy)
    const cliente = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { tabelaPreco: true }
    })

    if (!cliente) return null

    const clientSegment = cliente.tabelaPreco || '50a199'

    const segmentLabels: Record<string, string> = {
        '50a199': 'pequeno porte (50-199)',
        '200a699': 'médio porte (200-699)',
        'atacado': 'atacado',
        'avista': 'atacado à vista',
        'redes': 'redes'
    }
    const segmentLabel = segmentLabels[clientSegment] || clientSegment

    // Get all products this client has ever bought
    const meusPedidos = await prisma.pedido.findMany({
        where: { clienteId, tipo: 'Venda' },
        include: {
            itens: { select: { produtoId: true } }
        }
    })

    if (meusPedidos.length === 0) return null

    const meusProdutoIds = new Set<string>()
    const meusRecentes = new Set<string>()

    for (const pedido of meusPedidos) {
        for (const item of pedido.itens) {
            meusProdutoIds.add(item.produtoId)
            if (new Date(pedido.data) >= sixMonthsAgo) {
                meusRecentes.add(item.produtoId)
            }
        }
    }

    // STEP 1: Find OTHER clients in the same segment (same tabelaPreco)
    const outrosClientes = await prisma.cliente.findMany({
        where: {
            tabelaPreco: clientSegment,
            id: { not: clienteId }
        },
        select: { id: true }
    })

    const outrosClienteIds = outrosClientes.map(c => c.id)
    if (outrosClienteIds.length === 0) return null

    // STEP 2: Aggregate products bought by similar-profile clients (Curva A)
    const itensSimilares = await prisma.itemPedido.groupBy({
        by: ['produtoId'],
        where: {
            pedido: {
                clienteId: { in: outrosClienteIds },
                tipo: 'Venda'
            }
        },
        _sum: { quantidade: true },
        orderBy: { _sum: { quantidade: 'desc' } },
        take: 30
    })

    // STEP 3: Gap Filter — product this client has NEVER bought (absolute gap priority)
    for (const item of itensSimilares) {
        if (meusProdutoIds.has(item.produtoId)) continue // already bought at some point

        const prod = await prisma.produto.findUnique({
            where: { id: item.produtoId },
            select: { nome: true }
        })
        if (!prod) continue

        const qtdSimilares = item._sum.quantidade || 0

        return {
            produtoSugerido: prod.nome,
            justificativa: `Produto com alta aderência para o perfil deste cliente. "${prod.nome}" é muito adquirido por empresas de ${segmentLabel} (${qtdSimilares} unidades entre clientes similares). Este cliente ainda não experimentou.`
        }
    }

    // STEP 3b (FALLBACK): product not bought in 6+ months
    for (const item of itensSimilares) {
        if (meusRecentes.has(item.produtoId)) continue // bought recently

        const prod = await prisma.produto.findUnique({
            where: { id: item.produtoId },
            select: { nome: true }
        })
        if (!prod) continue

        const qtdSimilares = item._sum.quantidade || 0

        return {
            produtoSugerido: prod.nome,
            justificativa: `Oportunidade de expansão de mix baseada no perfil de compras de clientes similares (${segmentLabel}). "${prod.nome}" é frequente entre empresas do mesmo porte (${qtdSimilares} un.) mas este cliente não compra há mais de 6 meses.`
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
    const [comprador, reposicao, crossSell, sazonalidade, bonificacao] = await Promise.all([
        buscarNomeComprador(clienteId),
        analisarReposicao(clienteId),
        analisarCrossSell(clienteId),
        analisarSazonalidade(clienteId),
        prisma.pedido.findFirst({
            where: { clienteId, tipo: 'Bonificacao' },
            select: { id: true }
        })
    ])

    const recebeBonificacao = !!bonificacao

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
        fatorSazonal,
        recebeBonificacao
    }
}

// ============================================================
// ETAPA 3: INJEÇÃO DE CONTEXTO NO LLM (Strict System Prompt)
// ============================================================

async function gerarMensagemComLLM(fatos: FatosEstrategicos, nomeUsuario: string, nomeCliente: string, diasSemComprar: number | null): Promise<string> {
    // Extrair apenas a marca do produto foco (nunca o nome completo/SKU)
    const marcaFoco = extrairMarca(fatos.produtoFoco);

    // Montar contexto dos fatos estratégicos (usando marca, não produto)
    let contextoDeFatos = `
FATOS MATEMÁTICOS EXTRAÍDOS DO SISTEMA:
- Motivo do contato: ${fatos.motivo}
- Marca foco: ${marcaFoco}
- Justificativa baseada em dados: ${fatos.justificativa}`

    if (fatos.sugestaoAdicional) {
        const marcaSugestao = extrairMarca(fatos.sugestaoAdicional.split('(')[0].trim());
        contextoDeFatos += `\n- Sugestão adicional de cross-sell (marca): ${marcaSugestao}`
    }

    if (fatos.fatorSazonal) {
        contextoDeFatos += `\n- Fator sazonal: ${fatos.fatorSazonal}`
    }

    // ---- Régua de Churn: Injeção Condicional ----
    let regraAbordagem = '';
    if (diasSemComprar !== null && diasSemComprar >= DIAS_PARA_CHURN) {
        // RESGATE DE CLIENTE (churn)
        regraAbordagem = `
REGRA DE ABORDAGEM — RESGATE DE CLIENTE:
ATENÇÃO: Este cliente não compra há ${diasSemComprar} dias e provavelmente foi para a concorrência. NÃO aja como um lembrete de reposição de estoque. Aja como um representante comercial sênior a tentar recuperar a conta da ${marcaFoco}. Seja direto, breve e humano. Reconheça o tempo de afastamento e pergunte abertamente o motivo: foi preço? Foi a concorrência? Houve falha no atendimento? O objetivo é reabrir o diálogo sobre a ${marcaFoco}.`
    } else if (diasSemComprar !== null && diasSemComprar > 0) {
        // ATRASO NORMAL (dentro do ciclo estendido)
        regraAbordagem = `
REGRA DE ABORDAGEM — ATRASO NORMAL:
O cliente está com um pequeno atraso. Fale sobre evitar a ruptura de estoque e a reposição dos produtos da ${marcaFoco}. Mantenha um tom coloquial e focado em não deixar o cliente sem a ${marcaFoco} para as vendas.`
    }

    const isCrossSell = fatos.motivo === 'Cross-Sell'

    const systemPrompt = `Você é o representante comercial '${nomeUsuario}'. Assine a mensagem e conduza a apresentação usando este nome exato.
O cliente que vai receber a mensagem se chama '${nomeCliente}'. Inicie a saudação chamando-o pelo nome.

Escreva uma mensagem de WhatsApp curta (máximo 3 parágrafos curtos) para o seu cliente.

REGRA ABSOLUTA: NÃO gere textos com campos ou colchetes para preencher como [Nome], [Sua Empresa] ou [Empresa]. Escreva o texto final e completo, pronto para ser enviado no WhatsApp, assinando com o seu nome ${nomeUsuario}.

REGRA 1 (INEGOCIÁVEL): NUNCA cite o nome de um produto específico, embalagem, gramatura ou SKU (ex: 'Vinagre de Maçã 750ml'). NUNCA use termos de enfeite como 'mix de produtos', 'linha de produtos' ou 'portfólio'. A ÚNICA referência permitida a um produto é pelo nome da Marca/Representada (ex: '${marcaFoco}'). Use o nome da marca de forma natural no texto.

REGRA 2: Inicie a mensagem SEMPRE com um cumprimento informal usando o nome do cliente: ${nomeCliente}. Exemplo: "Fala ${nomeCliente}, tudo bem?"

REGRA 3: Você é PROIBIDO de inventar ofertas, produtos ou motivos genéricos. Construa seu argumento EXCLUSIVAMENTE baseando-se nestes fatos matemáticos extraídos do sistema:
${contextoDeFatos}
${regraAbordagem}
${isCrossSell ? `
REGRA ESPECIAL — CROSS-SELL (ESTRATÉGIAS BIFURCADAS):
O contexto real: você quer introduzir a marca "${marcaFoco}" mas sabe que o comprador resiste a cadastrar itens novos (sem espaço na gôndola, aversão a risco).

${fatos.recebeBonificacao ? `TÁTICA ESTRITA que você DEVE seguir: ESTE CLIENTE TEM DIREITO A VERBA (Risco Financiado)
- A ÚNICA moeda de troca que a fábrica libera para bonificação é o "Vinagre de Álcool 750ml".
- Diga que você conseguiu liberar uma verba em caixas de Vinagre de Álcool 750ml bonificadas (giro garantido, 100% de lucro pro cliente).
- Proponha que o cliente use o lucro garantido do Vinagre 750ml bonificado para "bancar" a entrada de um lote minúsculo (teste) da ${marcaFoco}.
- Argumente que dessa forma o cliente faz um teste de gôndola com risco financeiro ZERO — a própria fábrica já pagou a conta com a bonificação do Vinagre.
- Seja direto, comercial e fale de rentabilidade. NÃO mencione "pontos extras" ou "verbas flexíveis" — eles NÃO existem.
- Exemplo de tom: "${fatos.comprador}, pra você não tirar um real do bolso no teste desse item novo, vou te mandar X caixas do 750ml bonificadas. O lucro do 750ml cobre o teste e a gente tenta rentabilizar melhor esse espaço na gôndola."` : `TÁTICA ESTRITA que você DEVE seguir: ESTE CLIENTE NÃO TEM VERBA (Otimização de Centímetro Quadrado/Substituição)
- O cliente NÃO tem verba/bonificação livre e não tem espaço físico na prateleira.
- A sua ÚNICA saída é pedir para ele substituir o espaço de um produto da concorrência que gira mal.
- Não peça cadastro novo. Peça para ele reduzir 1 frente do concorrente de baixo giro na gôndola e colocar a ${marcaFoco} no lugar.
- Proponha isso como um teste de margem/rentabilidade de 30 dias.
- Seja incisivo: diga que você quer ajudar a rentabilizar aquele espaço morto na prateleira.
- Exemplo de tom: "${fatos.comprador}, sei que a gôndola está apertada, mas você tem produto de concorrente aí parado que não te dá margem. Tira uma frente dele por 30 dias e coloca a ${marcaFoco} no lugar pra gente testar a rentabilidade desse espaço. Se não girar, a gente tira."`}
` : ''}
REGRA 4: O tom deve ser de parceria e consultoria. Nunca use jargões robóticos como "Prezado", "Venho por meio desta" ou "Gostaria de oferecer". Fale como quem quer ajudar o cliente a ganhar mais dinheiro.

REGRA 5: Termine a mensagem com uma pergunta leve para incentivar a resposta. Exemplos: "Posso separar esse kit pra você?", "Quer que eu monte a proposta certinha?", "Faz sentido pra você?".

REGRA 6: NÃO use markdown, asteriscos, negritos ou formatação especial. Escreva texto puro como uma mensagem de WhatsApp normal.

REGRA 7: Escreva APENAS a mensagem. Sem explicações, sem alternativas, sem notas.`

    // ---- TENTATIVA 1: Groq (primário, mais rápido) ----
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
                        { role: 'user', content: `Gere a mensagem de WhatsApp para ${fatos.comprador} com base nos fatos acima.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            })

            if (groqRes.ok) {
                const groqData = await groqRes.json()
                const text = groqData.choices?.[0]?.message?.content?.trim()
                if (text && text.length > 10) {
                    return text
                }
            }

            // Se for 429, verificar antes de cair no fallback
            if (groqRes.status === 429) {
                console.warn('Groq rate limited, tentando fallback Gemini...')
            }
        } catch (groqErr) {
            console.warn('Erro no Groq, tentando fallback Gemini:', groqErr)
        }
    }

    // ---- TENTATIVA 2: Gemini (fallback) ----
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
        throw new Error('Nenhuma API key de IA configurada (GROQ_API_KEY ou GEMINI_API_KEY).')
    }

    try {
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent(systemPrompt)
        const response = result.response
        const text = response.text()

        if (!text || text.trim() === '') {
            throw new Error('LLM retornou uma mensagem vazia')
        }

        return text.trim()
    } catch (llmError: unknown) {
        const errMsg = llmError instanceof Error ? llmError.message : String(llmError)
        if (
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('quota') ||
            errMsg.toLowerCase().includes('rate') ||
            errMsg.toLowerCase().includes('resource has been exhausted') ||
            errMsg.toLowerCase().includes('too many requests')
        ) {
            throw new Error('RATE_LIMIT')
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

        // Capturar sessão ativa para pegar o nome
        const user = await getServerUser()
        const nomeUsuario = user?.nome || 'Representante Comercial'

        // ETAPA 1 + 2: Mineração de Dados + Consolidação
        const fatosEstrategicos = await consolidarFatos(body.clienteId)

        const nomeCliente = fatosEstrategicos.comprador || clienteExiste.nomeFantasia.split(' ')[0]

        // Calcular dias sem comprar para régua de churn (Apenas para fallback)
        const ultimoPedido = await prisma.pedido.findFirst({
            where: { clienteId: body.clienteId, tipo: 'Venda' },
            orderBy: { data: 'desc' },
            select: { data: true }
        })
        const diasSemComprar = ultimoPedido
            ? Math.floor((Date.now() - new Date(ultimoPedido.data).getTime()) / (1000 * 60 * 60 * 24))
            : null

        let mensagem = ''
        let estudoInterno = ''
        let mensagemWhatsApp = ''

        // ==========================================================
        // DADOS REAIS: REGRAS DE NEGÓCIO E HISTÓRICO DE COMPRAS
        // ==========================================================

        // Busca de 120 dias faturados e agrupamento
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 120);

        const historicoItens = await prisma.itemPedido.findMany({
            where: {
                pedido: {
                    clienteId: body.clienteId,
                    data: { gte: dataLimite },
                    status: { in: ['FATURADO', 'CONCLUIDO', 'Faturado', 'Concluido'] }
                }
            },
            include: { produto: true }
        });

        // .reduce() para agrupar em memória (por nome de produto)
        type HistoricoAcumulador = Record<string, number>;

        const volumePorProduto = historicoItens.reduce((acc: HistoricoAcumulador, item: any) => {
            const nomeStr = item.produto?.nome || 'Produto Desconhecido';
            acc[nomeStr] = (acc[nomeStr] || 0) + item.quantidade;
            return acc;
        }, {} as HistoricoAcumulador);

        const arrVolumes = Object.entries(volumePorProduto).sort((a, b) => b[1] - a[1]);

        let payloadHistorico = 'O cliente não comprou nenhum produto faturado nos últimos 120 dias.';
        if (arrVolumes.length > 0) {
            payloadHistorico = 'Histórico de 120 dias - ' + arrVolumes
                .map(([nome, qtd]) => `${nome}: ${qtd} caixas`)
                .join(' | ');
        }

        // NOVO FLUXO (BYPASS): Se o Frontend já enviou o contexto predador/inteligente das abas 
        // de Oportunidades ou Alavancagem, ignorar a Régua Passiva e rodar LLM com este prompt.
        if (body.contextoParaIA && body.contextoParaIA.trim() !== '') {
            console.log(`[AI Gen] Usando bypass de contexto externo para ${nomeCliente}`);

            // O System Prompt re-escrito conforme exigência arquitetural e layout de painéis
            const directSystemPrompt = `Você é um Gerente Comercial analítico e direto. É ESTRITAMENTE PROIBIDO usar jargões como Top Tier, Share of Wallet, Sinergia ou Queda Abrupta. Baseie sua análise APENAS nos dados numéricos fornecidos no contexto. Você DEVE obrigatoriamente citar os nomes dos produtos e a quantidade exata (caixas/volume) no seu texto. Aja com foco em rua, faturamento e concorrência na gôndola.

Você DEVE retornar sua resposta ESTRITAMENTE em formato JSON. O JSON deve possuir EXATAMENTE estas duas chaves:
{
  "estudoInterno": "Um resumo rápido de 2 linhas focado em fatos para o representante ler (ex: 'Cliente inativo há X dias. Parou de comprar Produto Y. Ciclo normal era Z dias.').",
  "mensagemWhatsApp": "O texto persuasivo, pronto para ser enviado ao cliente, usando o tom de um representante de rua. Assine como '${nomeUsuario}'."
}

DADOS REAIS DE COMPRAS DO CLIENTE:
${payloadHistorico}

CONTEXTO DA AÇÃO / OPORTUNIDADE:
${body.contextoParaIA}`;

            try {
                const groqKey = process.env.GROQ_API_KEY
                let generated = false;
                if (groqKey) {
                    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: directSystemPrompt },
                                { role: 'user', content: 'Crie a mensagem exata seguindo a estrutura fornecida nas regras de contexto retornando apenas JSON.' }
                            ],
                            response_format: { type: 'json_object' },
                            temperature: 0.7,
                            max_tokens: 500
                        })
                    })
                    if (groqRes.ok) {
                        const groqData = await groqRes.json()
                        mensagem = groqData.choices?.[0]?.message?.content?.trim()
                        generated = !!mensagem && mensagem.length > 10;
                    }
                }

                if (!generated && process.env.GEMINI_API_KEY) {
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
                    const result = await model.generateContent(`${directSystemPrompt}\n\nAgora gere a mensagem exata.`)
                    mensagem = result.response.text().trim()
                }

                if (!mensagem) throw new Error("Fallback LLM também falhou no Bypass.");

                // Parse the JSON safely
                try {
                    const jsonStr = mensagem.replace(/```json/gi, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(jsonStr);
                    estudoInterno = parsed.estudoInterno || parsed.analiseInterna || '';
                    mensagemWhatsApp = parsed.mensagemWhatsApp || '';
                    mensagem = mensagemWhatsApp; // Fallback compatibility
                } catch (e) {
                    console.error("[AI Gen] Failed to parse JSON response:", e);
                    mensagemWhatsApp = mensagem;
                }

            } catch (err) {
                // Se o bypass falhar severamente nas duas APIs mas puder usar o fallback, delegar ao fluxo normal 
                // senão lançamos o erro (que cairá no catch master).
                throw err;
            }
        }
        else {
            // FLUXO ANTIGO: Consolidação de fatos genéricos (Clientes inativos ou sem prompt customizado)
            console.log(`[AI Gen] Usando LLM Flow padrão para ${nomeCliente}`);
            mensagem = await gerarMensagemComLLM(fatosEstrategicos, nomeUsuario, nomeCliente, diasSemComprar)
        }

        return NextResponse.json({
            mensagem,
            estudoInterno,
            mensagemWhatsApp,
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
