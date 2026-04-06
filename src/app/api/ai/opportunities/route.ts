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
 */
function formatarNomeComercial(produtoNome: string): string {
    if (!produtoNome || produtoNome.trim() === '') return 'o produto';
    const marca = extrairMarca(produtoNome);

    let descricao = produtoNome;
    if (produtoNome.includes(' - ')) {
        descricao = produtoNome.split(' - ').slice(0, -1).join(' - ').trim();
    }

    descricao = descricao
        .toLowerCase()
        .replace(/\b\d+%/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    descricao = descricao
        .replace(/(\d+)\s*ml\b/gi, '$1ml')
        .replace(/(\d+)\s*litros?\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*l\b/gi, 'de $1 litros')
        .replace(/(\d+)\s*g\b/gi, '$1g')
        .replace(/(\d+)\s*kg\b/gi, '$1kg');

    const masculinos = ['molho', 'vinagre', 'azeite', 'extrato', 'palmito', 'milho', 'cogumelo', 'feijão', 'arroz'];
    const femininas = ['mostarda', 'maionese', 'pimenta', 'azeitona', 'ketchup', 'catchup', 'massa', 'farinha', 'ervilha', 'sardinha', 'salsa', 'linhaça', 'água', 'bebida'];

    const isMasculino = masculinos.some(m => descricao.startsWith(m) || descricao.includes(' ' + m));
    const isFeminina = femininas.some(f => descricao.startsWith(f) || descricao.includes(' ' + f));

    const artigo = isMasculino ? 'o' : (isFeminina ? 'a' : 'o');

    if (marca) {
        return `${artigo} ${descricao} da ${marca}`;
    }
    return `${artigo} ${descricao}`;
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

        // 1. Get all clients with recent active order history (e.g. 120 days)
        const dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - 120);

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

        if (!clients.length) {
            return NextResponse.json({ opportunities: [], summary: { total: 0 } });
        }

        // 2. Lookup de Produtos
        const products = await prisma.produto.findMany({
            include: { fabrica: true }
        })
        const productMap = new Map(products.map(p => [p.id, p]))

        // 3. Calculando Lista de Produtos "Vivos" (Blacklist de encalhados e molhos)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const recentSales = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            where: {
                pedido: { 
                    data: { gte: ninetyDaysAgo },
                    status: { in: ['FATURADO', 'CONCLUIDO', 'Faturado', 'Concluido'] }
                }
            },
            _sum: { quantidade: true }
        });
        const activeProductIds = new Set(
            recentSales.filter(s => (s._sum.quantidade || 0) > 0).map(s => s.produtoId)
        );

        // 4. Mapeando produtos por cliente (Curva A) e Frequência por Tabela
        const clientProductMap = new Map<string, Map<string, number>>();
        const clientProductLastDate = new Map<string, Map<string, Date>>();
        const tableProductFrequency = new Map<string, Map<string, number>>();

        for (const client of clients) {
            const tabelaBase = (client.tabelaPreco || 'PADRAO').toUpperCase().trim();
            if (!tableProductFrequency.has(tabelaBase)) {
                tableProductFrequency.set(tabelaBase, new Map<string, number>());
            }
            const freqMap = tableProductFrequency.get(tabelaBase)!;

            const prodQtdMap = new Map<string, number>();
            const prodDateMap = new Map<string, Date>();
            for (const pedido of client.pedidos) {
                const produtosNestePedido = new Set<string>();
                for (const item of pedido.itens) {
                    prodQtdMap.set(item.produtoId, (prodQtdMap.get(item.produtoId) || 0) + item.quantidade);
                    produtosNestePedido.add(item.produtoId);
                    
                    const existingDate = prodDateMap.get(item.produtoId);
                    if (!existingDate || pedido.data > existingDate) {
                        prodDateMap.set(item.produtoId, pedido.data);
                    }
                }
                produtosNestePedido.forEach(prodId => {
                    freqMap.set(prodId, (freqMap.get(prodId) || 0) + 1);
                });
            }
            if (prodQtdMap.size > 0) {
                clientProductMap.set(client.id, prodQtdMap);
                clientProductLastDate.set(client.id, prodDateMap);
            }
        }

        // Pre-calcular os Top 3 Produtos por Tabela (Baseado em Frequência de Pedidos)
        const top3ByTable = new Map<string, string[]>();
        tableProductFrequency.forEach((freqMap, tabela) => {
            const freqEntries: [string, number][] = [];
            freqMap.forEach((freq, prodId) => freqEntries.push([prodId, freq]));

            const sortedProducts = freqEntries
                .filter(([prodId]) => {
                    const pRec = productMap.get(prodId);
                    return pRec?.ativo && !(pRec.categoria || '').toLowerCase().includes('molho') && activeProductIds.has(prodId);
                })
                .sort((a, b) => b[1] - a[1]) // Ordena pela frequência (decrescente)
                .slice(0, 3)
                .map(entry => entry[0] as string);
            
            top3ByTable.set(tabela, sortedProducts);
        });

        // ============================================================
        // OPPORTUNITY GENERATION (3 LAYERS)
        // ============================================================
        const opportunities: Array<{
            type: 'crossSell'
            clienteId: string
            clienteNome: string
            clienteTelefone?: string
            description: string
            priority: 'alta' | 'media' | 'baixa'
            actionLabel: string
            contextoParaIA: string
        }> = []

        const data60 = new Date();
        data60.setDate(data60.getDate() - 60);

        // Pre-compute Alcool and Maca for Cross-Sell
        const alcoolIds = products.filter(p => 
            p.ativo && !p.categoria?.toLowerCase().includes('molho') && activeProductIds.has(p.id) &&
            p.nome.toLowerCase().includes('vinagre') && 
            (p.nome.toLowerCase().includes('alcool') || p.nome.toLowerCase().includes('álcool'))
        ).map(p => p.id);

        const macaIds = products.filter(p => 
            p.ativo && !p.categoria?.toLowerCase().includes('molho') && activeProductIds.has(p.id) &&
            p.nome.toLowerCase().includes('vinagre') && 
            (p.nome.toLowerCase().includes('maca') || p.nome.toLowerCase().includes('maçã'))
        ).map(p => p.id);

        for (const client of clients) {
            if (client.pedidos.length === 0) continue;

            const phone = client.celular || client.telefone || '';
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : (client.nomeFantasia || '').split(' ')[0];
            const myProducts = clientProductMap.get(client.id);
            const myDates = clientProductLastDate.get(client.id);
            if (!myProducts || !myDates) continue;

            // Encontra o Produto Atual (Carro-Chefe)
            let maxQtd = -1;
            let produtoAtualId = '';
            myProducts.forEach((qtd, prodId) => {
                if (qtd > maxQtd) {
                    maxQtd = qtd;
                    produtoAtualId = prodId;
                }
            });
            const produtoAtualRec = productMap.get(produtoAtualId);
            const nomeProdutoAtual = produtoAtualRec ? formatarNomeComercial(produtoAtualRec.nome) : 'o produto principal';

            // Último pedido para checagens
            const pedidosRealizados = client.pedidos.sort((a,b) => b.data.getTime() - a.data.getTime());
            const ultimoPedido = pedidosRealizados[0];
            const ultimoPedidoItems = new Set(ultimoPedido.itens.map(i => i.produtoId));
            const ultimoVolume = ultimoPedido.itens.reduce((acc, i) => acc + i.quantidade, 0);

            let strategyContext = '';
            let targetProdId = '';
            let triggerPreview = '';

            // --- PRIORIDADE 1: O RESGATE ---
            if (!targetProdId) {
                const myDatesEntries: [string, Date][] = [];
                myDates.forEach((lastDate, prodId) => myDatesEntries.push([prodId, lastDate]));
                
                for (const [prodId, lastDate] of myDatesEntries) {
                    if (lastDate < data60 && !ultimoPedidoItems.has(prodId) && activeProductIds.has(prodId)) {
                        const pRec = productMap.get(prodId);
                        if (pRec && pRec.ativo && !(pRec.categoria || '').toLowerCase().includes('molho')) {
                            targetProdId = prodId;
                            break;
                        }
                    }
                }
                if (targetProdId) {
                    const nomeTarget = formatarNomeComercial(productMap.get(targetProdId)!.nome);
                    strategyContext = `ESTRATÉGIA [RESGATE]: O cliente comprava o ${nomeTarget}, mas parou nos últimos 60 dias e não o incluiu no pedido recente. Aja para RECUPERAR ESSA VENDA PERDIDA. Fale que sentiu falta desse item no pedido.`;
                    triggerPreview = `${nomeTarget} [Resgate]`;
                }
            }

            // --- PRIORIDADE 2: O CROSS-SELL DE OURO (Álcool -> Maçã) ---
            if (!targetProdId) {
                const isConsumingAlcool = alcoolIds.some(id => myProducts.has(id));
                const isConsumingMaca = macaIds.some(id => myProducts.has(id));

                if (isConsumingAlcool && !isConsumingMaca && macaIds.length > 0) {
                    targetProdId = macaIds[0];
                    const nomeTarget = formatarNomeComercial(productMap.get(targetProdId)!.nome);
                    strategyContext = `ESTRATÉGIA [CROSS-SELL DE OURO]: O cliente tem alto volume em Vinagre de Álcool, mas não compra Vinagre de Maçã. Use a força e a familiaridade do Vinagre de Álcool para INTRODUZIR O ${nomeTarget}. Mostre como o produto tem excelente aceitação.`;
                    triggerPreview = `${nomeTarget} [Cross-Sell]`;
                }
            }

            // --- PRIORIDADE 3: O PULO DE TABELA ---
            if (!targetProdId) {
                const tabelaLower = (client.tabelaPreco || '').toLowerCase();
                let puloVolumeFaltante = 0;
                let nextTableName = '';

                if (tabelaLower.includes('50a199') && ultimoVolume >= 170 && ultimoVolume < 200) {
                    puloVolumeFaltante = 200 - ultimoVolume;
                    nextTableName = '200 a 699 Caixas';
                } else if (tabelaLower.includes('200a699') && ultimoVolume >= 585 && ultimoVolume < 700) {
                    puloVolumeFaltante = 700 - ultimoVolume;
                    nextTableName = 'Atacado (700+)';
                }

                if (puloVolumeFaltante > 0) {
                    const balsamicoId = products.find(p => p.ativo && !p.categoria?.toLowerCase().includes('molho') && activeProductIds.has(p.id) && (p.nome.toLowerCase().includes('balsamico') || p.nome.toLowerCase().includes('balsâmico')) && !myProducts.has(p.id))?.id;
                    
                    targetProdId = balsamicoId || products.find(p => p.ativo && !p.categoria?.toLowerCase().includes('molho') && activeProductIds.has(p.id) && !myProducts.has(p.id))?.id || '';

                    if (targetProdId) {
                        const nomeTarget = formatarNomeComercial(productMap.get(targetProdId)!.nome);
                        strategyContext = `ESTRATÉGIA [PULO DE TABELA]: O último pedido bateu na trave para a próxima tabela (${nextTableName})! Faltam apenas ${Math.ceil(puloVolumeFaltante)} caixas. Sugira o ${nomeTarget} no pedido atual como a "cereja do bolo" para ele atingir esse volume extra e GANHAR O DESCONTO DA NOVA TABELA em tudo.`;
                        triggerPreview = `${nomeTarget} [Pulo Tab.]`;
                    }
                }
            }

            // --- PRIORIDADE 4: EFEITO ESPELHO (PROVA SOCIAL MÍMICA) ---
            if (!targetProdId) {
                const tabelaBase = (client.tabelaPreco || 'PADRAO').toUpperCase().trim();
                const top3 = top3ByTable.get(tabelaBase) || [];
                
                for (const topProdId of top3) {
                    if (!myProducts.has(topProdId)) {
                        targetProdId = topProdId;
                        const nomeTarget = formatarNomeComercial(productMap.get(targetProdId)!.nome);
                        strategyContext = `ESTRATÉGIA [EFEITO ESPELHO]: O cliente tem o perfil da tabela ${client.tabelaPreco || 'Padrão'}, e o produto ${nomeTarget} é um dos campeões absolutos de giro neste segmento. O cliente ainda não consome. Mande uma mensagem oferecendo esse item e use incisivamente o argumento de PROVA SOCIAL comprovada, afirmando que 'empresas com o mesmo perfil comercial e volume de operação que a sua estão tendo excelentes resultados com a introdução deste produto'.`;
                        triggerPreview = `${nomeTarget} [Espelho]`;
                        break;
                    }
                }
            }

            if (!targetProdId) continue; // Pula cliente se não se encaixar em nenhuma das 4

            const nomeProdutoAlvo = formatarNomeComercial(productMap.get(targetProdId)!.nome);

            // TOM DE VOZ (Tabela de Preço)
            const tabelaLower = (client.tabelaPreco || '').toLowerCase();
            let zapStyle = '';
            if (tabelaLower.includes('atacado') || tabelaLower.includes('avista')) {
                zapStyle = `TOM DE VOZ DO ZAP (DISTRIBUIDOR): Foco em repasse, abastecer vendedores para vender aos mercadinhos, logística e volume. PROIBIDO falar de 'gôndola', 'prateleira' ou 'loja'. Use termos como 'girar', 'escala' e 'novidade para seus clientes'.`;
            } else if (tabelaLower.includes('redes')) {
                zapStyle = `TOM DE VOZ DO ZAP (REDES): Foco em alto volume, criar parede da marca na gôndola, rentabilidade em escala e bater a concorrência no ponto de venda.`;
            } else {
                zapStyle = `TOM DE VOZ DO ZAP (VAREJO): Foco em introdução na gôndola, aproveitar o pedido para colocar caixas de teste, melhorar o mix da loja e margem direta alta do consumidor final.`;
            }

            const systemPrompt = `DADOS DA OPORTUNIDADE:
- Cliente: ${greetingName}
- Tabela do Cliente: ${client.tabelaPreco || 'Padrão'}
- Produto Carro-Chefe (Alto Volume): ${nomeProdutoAtual}
- Produto Alvo que VOCÊ DEVE VENDER AGORA: ${nomeProdutoAlvo}

${strategyContext}

${zapStyle}`;

            opportunities.push({
                type: 'crossSell',
                clienteId: client.id,
                clienteNome: client.nomeFantasia,
                clienteTelefone: phone,
                description: triggerPreview,
                priority: 'alta',
                actionLabel: 'Gerar Oportunidade',
                contextoParaIA: systemPrompt
            });
        }

        return NextResponse.json({
            opportunities: opportunities.slice(0, 50),
            summary: {
                total: opportunities.length,
                upgrade: 0,
                crossSell: opportunities.length,
                seasonal: 0
            }
        })
    } catch (error) {
        console.error('Error fetching opportunities:', error)
        return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
    }
}
