import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/opportunities - Get sales opportunities
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// HELPERS
// ============================================================

/**
 * Extrai a Marca de uma string de produto.
 * Ex: 'VINAGRE DE MACA 750ML - BELMONT' → 'Belmont'
 */
function extrairMarca(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return '';
    if (produtoNome.includes(' - ')) {
        const partes = produtoNome.split(' - ');
        const marca = partes[partes.length - 1].trim();
        return marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
    }
    const tokens = produtoNome.trim().split(/\s+/);
    const ultima = tokens[tokens.length - 1];
    return ultima.charAt(0).toUpperCase() + ultima.slice(1).toLowerCase();
}

/**
 * Transforma uma string técnica de nota fiscal num nome comercial natural.
 * Ex: 'VINAGRE DE ALCOOL - 2 LITROS 5%' → 'o vinagre de álcool de 2 litros'
 * Ex: 'VINAGRE DE MACA 750ML - BELMONT' → 'o vinagre de maçã 750ml da Belmont'
 * Ex: 'MOSTARDA AMARELA 200G - BELMONT' → 'a mostarda amarela 200g da Belmont'
 * Regra: nunca retorna a string técnica crua. Sempre humaniza.
 */
function formatarNomeComercial(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return 'o produto';
    const marca = extrairMarca(produtoNome);

    // Limpar: remover marca da string se vier após ' - '
    let descricao = produtoNome;
    if (produtoNome.includes(' - ')) {
        descricao = produtoNome.split(' - ').slice(0, -1).join(' - ').trim();
    }

    // Lowercase e remover % soltos e números de registro
    descricao = descricao
        .toLowerCase()
        .replace(/\b\d+%/g, '')       // remove percentuais soltos (5%, 4%, etc)
        .replace(/\s{2,}/g, ' ')       // normaliza espaços duplos
        .trim();

    // Humanizar embalagens comuns
    descricao = descricao
        .replace(/(\d+)\s*ml\b/gi, '$1ml')
        .replace(/(\d+)\s*litros?\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*l\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*g\b/gi, '$1g')
        .replace(/(\d+)\s*kg\b/gi, '$1kg');

    // Artigo — Regras de Gênero
    const masculinos = ['molho', 'vinagre', 'azeite', 'extrato', 'palmito', 'milho', 'cogumelo', 'feijão', 'arroz'];
    const femininas = ['mostarda', 'maionese', 'pimenta', 'azeitona', 'ketchup', 'catchup', 'massa', 'farinha', 'ervilha', 'sardinha', 'salsa', 'linhaça', 'água', 'bebida'];

    // Prioridade para masculinos (ex: "molho de pimenta" deve ser "o molho")
    const isMasculino = masculinos.some(m => descricao.startsWith(m) || descricao.includes(' ' + m));
    const isFeminina = femininas.some(f => descricao.startsWith(f) || descricao.includes(' ' + f));

    const artigo = isMasculino ? 'o' : (isFeminina ? 'a' : 'o');

    if (marca) {
        return `${artigo} ${descricao} da ${marca}`;
    }
    return `${artigo} ${descricao}`;
}

/**
 * Retorna o bloco de CONTROLE DE VOCABULÁRIO para o system prompt.
 * Abordagem POSITIVA: diz o que DEVE usar, não o que não deve.
 */
function getControleVocabulario(segmento: string): string {
    const isAtacado = segmento === 'atacado' || segmento === 'avista';

    if (isAtacado) {
        return `CONTROLE DE CENÁRIO — ATACADISTA/DISTRIBUIDOR:
O cliente é um ATACADISTA/DISTRIBUIDOR. O cenário dele é um GALPÃO LOGÍSTICO, não uma loja.
Você DEVE usar EXCLUSIVAMENTE estas palavras: 'giro de estoque', 'volume', 'pallet', 'margem de revenda', 'abastecer seus clientes', 'espaço no depósito', 'demanda dos varejistas da região'.
O argumento de venda é RENTABILIDADE EM ESCALA e GIRO RÁPIDO para a malha de clientes dele.
PALAVRAS 100% PROIBIDAS NESTE CONTEXTO: 'gôndola', 'prateleira', 'consumidor final', 'supermercado', 'ponto de venda', 'tirar uma frente', 'mix na loja'.`;
    }

    return `CONTROLE DE CENÁRIO — VAREJISTA:
O cliente é um VAREJISTA com loja física.
Você DEVE usar estas palavras: 'ponto de venda', 'gôndola', 'prateleira', 'mix de loja', 'ticket médio', 'consumidor final', 'evitar ruptura'.
O argumento de venda é COMPLETAR O MIX na gôndola e AUMENTAR O TICKET MÉDIO.`;
}

/**
 * Gera o contextoParaIA completo para cross-sell com:
 * - Controle de vocabulário positivo por segmento
 * - Regra de ocultação de SKU
 * - Estrutura de argumento em 4 passos e fechamento agressivo
 * - Tática de bonificação adaptada
 */
function getContextoCrossSell(params: {
    segmento: string;
    comprador: string;
    nomeComercial: string;
    marca: string;
    segmentLabel: string;
    recebeBonificacao: boolean;
    motivo: string; // 'nunca comprou' | 'parou de comprar há 6+ meses' | 'alto giro global'
    isAtivo: boolean;
    score: number;
}): string {
    const { segmento, comprador, nomeComercial, marca, segmentLabel, recebeBonificacao, motivo, isAtivo, score } = params;
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    const vocabControle = getControleVocabulario(segmento);

    const propostaFechamento = isAtacado
        ? 'Vamos botar um pallet no próximo pedido para você testar essa rentabilidade hoje?'
        : 'Vamos fechar um lote teste agora para você não perder mais venda na gôndola?';

    const taticaBonificacao = recebeBonificacao
        ? `\nTÁTICA EXTRA — RISCO FINANCIADO: Você pode oferecer caixas bonificadas de Vinagre de Álcool 750ml como financiador do risco. O lucro do Vinagre bonificado cobre a entrada do lote teste. O cliente testa com risco ZERO.`
        : '';

    const fomoMath = score > 0
        ? `Temos ${score} unidades vendidas de ${nomeComercial} girando rapidamente em clientes do mesmo perfil (${segmentLabel}). Você está deixando dinheiro na mesa para a concorrência por não ter este produto.`
        : `Este item tem alto giro em clientes do mesmo perfil (${segmentLabel}). Você está deixando dinheiro na mesa para a concorrência por não ter este produto.`;

    const statusRule = isAtivo
        ? `REGRA CRÍTICA DE SEPARAÇÃO LÓGICA: O cliente comprou nos últimos 30 dias, logo é um CLIENTE ATIVO. Você NUNCA, JAMAIS, deve usar palavras como "reativar", "sumido", "lembrar de repor" ou "faz tempo que não compra". Trate-o como um cliente ativo de quem você quer AUMENTAR O TICKET MÉDIO com uma oportunidade puramente de CROSS-SELL/UP-SELL de um produto que ele NÃO tem.`
        : `REGRA DE CONTEXTO: O cliente não compra há algum tempo. No entanto, o foco não é implorar retorno e sim provar matematicamente que ele está perdendo dinheiro sem este produto.`;

    return `${vocabControle}

REGRA DE LIMPEZA VISUAL (INEGOCIÁVEL):
Ao mencionar o produto, NUNCA repita a string técnica de nota fiscal (ex: 'VINAGRE DE ALCOOL - 2 LITROS 5%').
Transforme SEMPRE em um termo comercial natural. Use a categoria + embalagem ou a marca.
Exemplos corretos: 'o galão de 2 litros', 'o vinagre de álcool de 2 litros', 'a linha de 2 litros da ${marca}'.
O nome comercial para usar nesta mensagem é: "${nomeComercial}".

INVERSÃO DE PROTAGONISMO (A LÓGICA PREDADORA):
O objetivo principal, único e absoluto desta mensagem é VENDER O PRODUTO NOVO (${nomeComercial}). O histórico de compras do cliente é apenas o gancho inicial. Assuma a postura de um consultor focado agressivamente em rentabilidade e otimização.

${statusRule}

ESTRUTURA OBRIGATÓRIA DA MENSAGEM (4 passos curtos, diretos e sem enrolação):
1. Cumprimento direto usando o nome: ${comprador}.
2. Gancho: Mencione o histórico dele com nossa linha (sem implorar retorno).
3. A Oportunidade (Alavancagem Obrigatória): "${motivo}. ${fomoMath}" Construa seu argumento focando fortemente nos indicadores do seu setor (${isAtacado ? 'focando em giro rápido, alto volume e rentabilidade/margem no pallet' : 'focando no crescimento do ticket médio e rentabilidade na gôndola/ponto de venda'}).
4. Fechamento Agressivo: "${propostaFechamento}" Terminando SEMPRE com uma chamada de vendas contundente e real. É ESTRITAMENTE PROIBIDO usar perguntas fracas como "Faz sentido?", "O que acha?" ou "Podemos conversar?". Seja imperativo.
${taticaBonificacao}

Escreva a mensagem seguindo esta estrutura. Tom comercial consultivo e agressivo. Máximo 3 parágrafos curtos.
NÃO use markdown, asteriscos ou formatação. Texto puro de WhatsApp.
Escreva APENAS a mensagem final, sem explicações extras.`;
}

export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        // ============================================================
        // DATA LOADING
        // ============================================================

        // 1. Get all clients with their order history
        // Definição do Ponto de Corte
        const dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - 60);

        const clients = await prisma.cliente.findMany({
            where: {
                pedidos: {
                    some: {
                        data: { gte: dataCorte },
                        status: { in: ['FATURADO', 'CONCLUIDO', 'Faturado', 'Concluido'] }
                    }
                }
            },
            include: {
                pedidos: {
                    where: {
                        tipo: 'Venda',
                        status: {
                            in: ['Novo', 'Pendente', 'Processando', 'Concluido', 'Faturado', 'Importado']
                        }
                    },
                    include: {
                        itens: {
                            select: { produtoId: true, quantidade: true }
                        }
                    },
                    orderBy: { data: 'desc' },
                }
            }
        })

        // 2. Get all products with factory info (single query, used as lookup)
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })

        // Product lookup map
        const productMap = new Map(products.map(p => [p.id, p]))

        // 3. Pre-compute global product popularity (for fallback)
        const globalStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 50
        })

        // 4. Build segment-buyer and client-product indexes
        // Segment = tabelaPreco (proxy for client size/porte)
        const segmentBuyerMap = new Map<string, Set<string>>() // segment -> Set<clienteId>
        const clientProductMap = new Map<string, Map<string, number>>() // clienteId -> Map<produtoId, totalQtd>

        for (const client of clients) {
            const prodQtdMap = new Map<string, number>()
            for (const pedido of client.pedidos) {
                for (const item of pedido.itens) {
                    prodQtdMap.set(item.produtoId, (prodQtdMap.get(item.produtoId) || 0) + item.quantidade)
                }
            }
            if (prodQtdMap.size > 0) {
                clientProductMap.set(client.id, prodQtdMap)
            }

            // Determine client segment from tabelaPreco field or most frequent order table
            const segment = client.tabelaPreco || '50a199'
            if (!segmentBuyerMap.has(segment)) {
                segmentBuyerMap.set(segment, new Set())
            }
            segmentBuyerMap.get(segment)!.add(client.id)
        }

        // Build a human-readable label for each segment
        const segmentLabels: Record<string, string> = {
            '50a199': 'pequeno porte (50-199)',
            '200a699': 'médio porte (200-699)',
            'atacado': 'atacado',
            'avista': 'atacado à vista',
            'redes': 'redes'
        }

        // ============================================================
        // OPPORTUNITY GENERATION
        // ============================================================

        const opportunities: Array<{
            type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation'
            clienteId: string
            clienteNome: string
            clienteTelefone?: string
            description: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
            contextoParaIA: string
        }> = []

        const now = new Date()
        const currentMonth = now.getMonth()
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

        const hoje = new Date()

        // Track suggested products to diversify cross-sell across clients
        const globalSuggestedProducts = new Set<string>()

        for (const client of clients) {
            if (client.pedidos.length === 0) continue

            const phone = client.celular || client.telefone || ''
            // @ts-ignore
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia

            const recentOrders = client.pedidos.slice(0, 10)
            const thisMonthOrders = recentOrders.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )

            const diasDesdeUltimaCompra = client.pedidos[0] ? Math.floor((hoje.getTime() - new Date(client.pedidos[0].data).getTime()) / (1000 * 60 * 60 * 24)) : 999;
            const isAtivo = diasDesdeUltimaCompra <= 45;

            // --- UPGRADE OPPORTUNITY ---
            const using50a199 = recentOrders.some(o => o.tabelaPreco === '50a199')
            if (using50a199 && thisMonthOrders.length >= 2) {
                opportunities.push({
                    type: 'upgrade',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,
                    description: `${thisMonthOrders.length} pedidos este mês na tabela 50-199. Sugerir migração para 200-669.`,
                    priority: 'alta',
                    actionLabel: 'Propor Upgrade',
                    contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Proponha a mudança para a tabela de atacado (200+) porque o cliente fez vários pedidos este mês na tabela 50-199.`
                })
            }

            // Determine if client has a history of receiving bonifications
            const recebeBonificacao = client.pedidos.some(p => p.tipo === 'Bonificacao')
            const clientSegmentForVocab = client.tabelaPreco || '50a199'
            const isAtacado = clientSegmentForVocab === 'atacado' || clientSegmentForVocab === 'avista'

            // ==========================================================
            // --- CROSS-SELL: Perfil do Cliente / Segmentação ---
            // ==========================================================
            const myProducts = clientProductMap.get(client.id)
            if (myProducts && myProducts.size > 0) {

                // STEP 1: Determine this client's segment
                const clientSegment = client.tabelaPreco || '50a199'
                const segmentLabel = segmentLabels[clientSegment] || clientSegment

                // STEP 2: Find OTHER clients in the same segment
                const segmentBuyers = segmentBuyerMap.get(clientSegment)
                if (segmentBuyers && segmentBuyers.size > 1) {

                    // Aggregate what similar-profile clients buy (Curva A do segmento)
                    const segmentProductScores = new Map<string, number>()

                    segmentBuyers.forEach(buyerId => {
                        if (buyerId === client.id) return
                        const buyerProducts = clientProductMap.get(buyerId)
                        if (!buyerProducts) return

                        buyerProducts.forEach((qtd, prodId) => {
                            segmentProductScores.set(prodId, (segmentProductScores.get(prodId) || 0) + qtd)
                        })
                    })

                    // Sort by score desc → Curva A products for this segment
                    const rankedSegmentProducts = Array.from(segmentProductScores.entries())
                        .sort((a, b) => b[1] - a[1])

                    // All products this client has EVER bought
                    const allBoughtProductIds = new Set(Array.from(myProducts.keys()))

                    // Products bought in last 6 months
                    const recentProductIds = new Set<string>()
                    for (const pedido of client.pedidos) {
                        if (new Date(pedido.data) >= sixMonthsAgo) {
                            for (const item of pedido.itens) {
                                recentProductIds.add(item.produtoId)
                            }
                        }
                    }

                    let crossSellFound = false

                    // STEP 3: Gap Filter — find top product this client NEVER bought (absolute gap)
                    for (let aIdx = 0; aIdx < rankedSegmentProducts.length && !crossSellFound; aIdx++) {
                        const prodId = rankedSegmentProducts[aIdx][0]
                        const score = rankedSegmentProducts[aIdx][1]

                        // Priority: products NEVER bought by this client
                        if (allBoughtProductIds.has(prodId)) continue
                        if (globalSuggestedProducts.has(prodId) && score < 50) continue

                        const prod = productMap.get(prodId)
                        if (!prod) continue

                        const marca = extrairMarca(prod.nome)
                        const nomeComercial = formatarNomeComercial(prod.nome)

                        opportunities.push({
                            type: 'crossSell',
                            clienteId: client.id,
                            clienteNome: client.nomeFantasia,
                            clienteTelefone: phone,
                            description: isAtacado
                                ? `Oportunidade: Introduzir ${nomeComercial} para aumentar o giro e a margem de revenda no estoque.`
                                : `Oportunidade: Introduzir ${nomeComercial} para completar o mix na gôndola e elevar o ticket médio.`,
                            priority: 'alta',
                            actionLabel: 'Oferecer Produto',
                            contextoParaIA: getContextoCrossSell({
                                segmento: clientSegmentForVocab,
                                comprador: greetingName,
                                nomeComercial,
                                marca,
                                segmentLabel,
                                recebeBonificacao,
                                motivo: `Este cliente nunca comprou ${nomeComercial}, mas é um dos itens de maior saída entre clientes de ${segmentLabel}`,
                                isAtivo,
                                score
                            })
                        })

                        globalSuggestedProducts.add(prodId)
                        crossSellFound = true
                    }

                    // STEP 3b (FALLBACK): product not bought in 6+ months
                    if (!crossSellFound) {
                        for (let aIdx = 0; aIdx < rankedSegmentProducts.length && !crossSellFound; aIdx++) {
                            const prodId = rankedSegmentProducts[aIdx][0]
                            const score = rankedSegmentProducts[aIdx][1]

                            if (recentProductIds.has(prodId)) continue
                            if (globalSuggestedProducts.has(prodId) && score < 50) continue

                            const prod = productMap.get(prodId)
                            if (!prod) continue

                            const marcaFallback = extrairMarca(prod.nome)
                            const nomeComercialFb = formatarNomeComercial(prod.nome)

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: isAtacado
                                    ? `Oportunidade: Reintroduzir ${nomeComercialFb} no estoque — alto giro entre distribuidores do mesmo porte.`
                                    : `Oportunidade: Reintroduzir ${nomeComercialFb} na gôndola — foco em rentabilidade e evitar ruptura.`,
                                priority: 'media',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: getContextoCrossSell({
                                    segmento: clientSegmentForVocab,
                                    comprador: greetingName,
                                    nomeComercial: nomeComercialFb,
                                    marca: marcaFallback,
                                    segmentLabel,
                                    recebeBonificacao,
                                    motivo: `O cliente já comprou ${nomeComercialFb} mas parou há mais de 6 meses. É popular entre clientes de ${segmentLabel}`,
                                    isAtivo,
                                    score
                                })
                            })

                            globalSuggestedProducts.add(prodId)
                            crossSellFound = true
                        }
                    }

                    // STEP 4 (FALLBACK): Diversified high-volume product (pre-computed global stats)
                    if (!crossSellFound) {
                        for (const stat of globalStats) {
                            if (allBoughtProductIds.has(stat.produtoId)) continue
                            if (globalSuggestedProducts.has(stat.produtoId)) continue

                            const prod = productMap.get(stat.produtoId)
                            if (!prod) continue

                            const marcaGlobal = extrairMarca(prod.nome)
                            const nomeComercialGlob = formatarNomeComercial(prod.nome)

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: isAtacado
                                    ? `Oportunidade: ${nomeComercialGlob} tem alto giro no mercado — cliente nunca experimentou no estoque.`
                                    : `Oportunidade: ${nomeComercialGlob} é um dos itens de maior giro — cliente nunca teve na gôndola.`,
                                priority: 'baixa',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: getContextoCrossSell({
                                    segmento: clientSegmentForVocab,
                                    comprador: greetingName,
                                    nomeComercial: nomeComercialGlob,
                                    marca: marcaGlobal,
                                    segmentLabel,
                                    recebeBonificacao,
                                    motivo: `${nomeComercialGlob} é um dos itens de maior giro no mercado e o cliente nunca experimentou`,
                                    isAtivo,
                                    score: stat._sum.quantidade ?? 0
                                })
                            })

                            globalSuggestedProducts.add(stat.produtoId)
                            break
                        }
                    }
                }
            }

            // --- SEASONAL OPPORTUNITY ---
            const ordersThisMonth = client.pedidos.filter(o =>
                new Date(o.data).getMonth() === currentMonth
            )
            const avgOrdersPerMonth = client.pedidos.length / 12

            if (client.createdAt < sixMonthsAgo && ordersThisMonth.length > avgOrdersPerMonth * 1.3 && ordersThisMonth.length < avgOrdersPerMonth * 2.5) {
                opportunities.push({
                    type: 'seasonal',
                    clienteId: client.id,
                    clienteNome: client.nomeFantasia,
                    clienteTelefone: phone,
                    description: `Historicamente compra mais neste mês. Momento ideal para contato.`,
                    priority: 'media',
                    actionLabel: 'Contatar Cliente',
                    contextoParaIA: `Atue como um vendedor experiente proativo. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Sugira a reposição de stock, pois os dados históricos mostram que este é um mês de fortes vendas na região dele.`
                })
            }
        }

        // Sort by priority
        const priorityOrder = { alta: 0, media: 1, baixa: 2 }
        opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

        return NextResponse.json({
            opportunities: opportunities.slice(0, 20),
            summary: {
                total: opportunities.length,
                upgrade: opportunities.filter(o => o.type === 'upgrade').length,
                crossSell: opportunities.filter(o => o.type === 'crossSell').length,
                seasonal: opportunities.filter(o => o.type === 'seasonal').length
            }
        })
    } catch (error) {
        console.error('Error fetching opportunities:', error)
        return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
    }
}
