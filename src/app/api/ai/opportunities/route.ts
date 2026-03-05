import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/getServerUser'

// GET /api/ai/opportunities - Get sales opportunities
export const dynamic = 'force-dynamic'

// ============================================================
// HELPERS
// ============================================================

/**
 * Extrai APENAS o nome da Marca/Representada de uma string de produto.
 * Ex: 'VINAGRE DE MACA 750ML - BELMONT' → 'Belmont'
 * Se houver traço separador, pega o trecho após o último traço.
 * Senão, retorna a última palavra como fallback.
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

/** Retorna vocabulário de negócio adaptado ao segmento do cliente. */
function getVocabularioSegmento(segmento: string): {
    argVenda: string;
    argEspaco: string;
    argResultado: string;
    termoLocal: string;
} {
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    if (isAtacado) {
        return {
            argVenda: 'giro e volume na sua malha de clientes',
            argEspaco: 'espaço no estoque e no pallet',
            argResultado: 'margem de revenda e rentabilidade por caixa',
            termoLocal: 'estoque'
        };
    }
    // Varejo: redes, 50a199, 200a699
    return {
        argVenda: 'mix completo no ponto de venda e ticket médio',
        argEspaco: 'espaço na gôndola',
        argResultado: 'rentabilidade por metro de prateleira e evitar ruptura',
        termoLocal: 'gôndola'
    };
}

/** Gera a tática de cross-sell adaptada ao segmento. */
function getTaticaCrossSell(segmento: string, recebeBonificacao: boolean, marcaFoco: string, comprador: string): string {
    const isAtacado = segmento === 'atacado' || segmento === 'avista';
    const vocab = getVocabularioSegmento(segmento);

    if (recebeBonificacao) {
        return `Use a ESTRATÉGIA DE RISCO FINANCIADO: ofereça caixas bonificadas de Vinagre de Álcool 750ml (giro garantido, 100% de lucro) como financiador do risco. Proponha que o lucro do Vinagre 750ml bonificado cubra a entrada de um lote teste da ${marcaFoco}, assim o cliente testa com risco financeiro ZERO. Seja direto, comercial e fale de ${vocab.argResultado}.`;
    }

    if (isAtacado) {
        return `Use a ESTRATÉGIA DE VOLUME: o cliente é ATACADO — NÃO tem gôndola, tem estoque e pallet. PROIBIDO usar as palavras 'gôndola', 'prateleira', 'consumidor final' ou 'supermercado'. A TÁTICA: mostre que a ${marcaFoco} tem alto giro entre os varejistas da região e que adicionar ao estoque dele vai abastecer a malha de clientes dele com um item de margem de revenda comprovada. Proponha um lote teste com volume mínimo para avaliação de giro. Fale de volume, margem de revenda e demanda dos varejistas da região.`;
    }

    return `Use a ESTRATÉGIA DE OTIMIZAÇÃO DE GÔNDOLA: o cliente é VAREJO. A TÁTICA: peça para ele substituir o espaço de um produto da concorrência que gira mal na gôndola e colocar a ${marcaFoco} no lugar para um teste de rentabilidade de 30 dias no ponto de venda. Fale de ${vocab.argResultado}.`;
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
        const clients = await prisma.cliente.findMany({
            include: {
                pedidos: {
                    include: {
                        itens: {
                            select: { produtoId: true, quantidade: true }
                        }
                    },
                    orderBy: { data: 'desc' }
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
            const vocab = getVocabularioSegmento(clientSegmentForVocab)
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
                        const tatica = getTaticaCrossSell(clientSegmentForVocab, recebeBonificacao, marca, greetingName)

                        opportunities.push({
                            type: 'crossSell',
                            clienteId: client.id,
                            clienteNome: client.nomeFantasia,
                            clienteTelefone: phone,
                            description: isAtacado
                                ? `Oportunidade: Introduzir ${marca} para aumentar o giro e a margem de revenda no estoque.`
                                : `Oportunidade: Introduzir ${marca} para elevar o ${vocab.argVenda}. Foco em ${vocab.argResultado}.`,
                            priority: 'alta',
                            actionLabel: 'Oferecer Produto',
                            contextoParaIA: `Atue como um vendedor experiente proativo. REGRA: NUNCA cite descrições técnicas de nota fiscal (ex: 'VINAGRE DE MACA 750ML'). Fale apenas o nome da marca de forma natural. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer introduzir a marca ${marca} (alta saída entre clientes de ${segmentLabel}). Analise o histórico: identifique categorias da ${marca} que o cliente NÃO compra e argumente o PORQUÊ de adicionar esse item usando vocabulário de ${isAtacado ? 'distribuição (giro, pallet, volume, estoque, margem de revenda)' : 'varejo (ponto de venda, gôndola, mix, ruptura, ticket médio)'}. ${tatica}`
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
                            const taticaFallback = getTaticaCrossSell(clientSegmentForVocab, recebeBonificacao, marcaFallback, greetingName)

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: isAtacado
                                    ? `Oportunidade: Reintroduzir ${marcaFallback} no estoque — alto giro entre distribuidores do mesmo porte.`
                                    : `Oportunidade: Reintroduzir ${marcaFallback} na ${vocab.termoLocal} — foco em ${vocab.argResultado}.`,
                                priority: 'media',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: `Atue como um vendedor experiente proativo. REGRA: NUNCA cite descrições técnicas de nota fiscal. Fale apenas o nome da marca. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer reintroduzir a marca ${marcaFallback} (popular entre clientes de ${segmentLabel}, faz +6 meses que este não compra). Argumente usando vocabulário de ${isAtacado ? 'distribuição (giro, pallet, volume, margem de revenda)' : 'varejo (gôndola, ponto de venda, mix, ticket médio)'}. ${taticaFallback}`
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
                            const taticaGlobal = getTaticaCrossSell(clientSegmentForVocab, recebeBonificacao, marcaGlobal, greetingName)

                            opportunities.push({
                                type: 'crossSell',
                                clienteId: client.id,
                                clienteNome: client.nomeFantasia,
                                clienteTelefone: phone,
                                description: isAtacado
                                    ? `Oportunidade: ${marcaGlobal} tem alto giro no mercado — cliente nunca experimentou no estoque.`
                                    : `Oportunidade: ${marcaGlobal} é um dos itens de maior giro — cliente nunca teve na ${vocab.termoLocal}.`,
                                priority: 'baixa',
                                actionLabel: 'Oferecer Produto',
                                contextoParaIA: `Atue como um vendedor experiente proativo. REGRA: NUNCA cite descrições técnicas de nota fiscal. Fale apenas o nome da marca. Escreva uma mensagem persuasiva de WhatsApp para o cliente ${greetingName}. Você quer introduzir a marca ${marcaGlobal} (um dos itens de maior giro no mercado, cliente nunca experimentou). Argumente usando vocabulário de ${isAtacado ? 'distribuição (giro, volume, pallet, margem de revenda)' : 'varejo (gôndola, ponto de venda, mix, ticket médio)'}. ${taticaGlobal}`
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
