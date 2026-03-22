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

        // 3. Calculando Curva Global Completa (Para separar A, B e C)
        const globalStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } }
        })
        
        // Define as curvas aproximadas baseadas no ranking
        const totalItems = globalStats.length;
        const curvaA_count = Math.floor(totalItems * 0.2) || 10;
        const globalCurvaAIds = globalStats.slice(0, curvaA_count).map(stat => stat.produtoId);
        const globalCurvaCIds = globalStats.slice(Math.floor(totalItems * 0.5)).map(stat => stat.produtoId);

        // 4. Mapeando produtos por cliente (Curva A do cliente)
        const clientProductMap = new Map<string, Map<string, number>>()

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
        }

        // ============================================================
        // OPPORTUNITY GENERATION
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

        // Set to diversify global products across different clients
        const globalSuggestedProducts = new Set<string>();

        for (const client of clients) {
            if (client.pedidos.length === 0) continue

            const phone = client.celular || client.telefone || ''
            // @ts-ignore
            const greetingName = client.comprador ? client.comprador.split(' ')[0] : client.nomeFantasia.split(' ')[0]

            const myProducts = clientProductMap.get(client.id)
            if (!myProducts || myProducts.size === 0) continue;

            // Encontra o Produto Atual (Curva A do Cliente: o que ele mais compra)
            let maxQtd = -1;
            let produtoAtualId = '';
            myProducts.forEach((qtd, prodId) => {
                if (qtd > maxQtd) {
                    maxQtd = qtd;
                    produtoAtualId = prodId;
                }
            })

            const produtoAtualRec = productMap.get(produtoAtualId);
            if (!produtoAtualRec) continue;
            const nomeProdutoAtual = formatarNomeComercial(produtoAtualRec.nome);

            // Encontra 1 produto Curva C Global que o cliente AINDA NÃO COMPROU e não é Molho
            let produtoNovoId = '';

            // Tenta pegar primeiro da Curva C (baixo giro/abaixo da média global)
            for (const globalId of globalCurvaCIds) {
                const prodRec = productMap.get(globalId);
                if (!prodRec || !prodRec.ativo) continue;
                
                // BLOQUEIO ABSOLUTO: Não pode ser da categoria 'Molho' ou 'Molhos'
                const cat = (prodRec.categoria || '').toLowerCase();
                if (cat.includes('molho')) continue;

                if (!myProducts.has(globalId) && !globalSuggestedProducts.has(globalId)) {
                    produtoNovoId = globalId;
                    break;
                }
            }

            // Fallback se não achou: Qualquer produto ativo não-molho que o cliente não tem
            if (!produtoNovoId) {
                for (const prodRec of products) {
                    if (!prodRec.ativo) continue;
                    const cat = (prodRec.categoria || '').toLowerCase();
                    if (cat.includes('molho')) continue;

                    if (!myProducts.has(prodRec.id)) {
                        produtoNovoId = prodRec.id;
                        break;
                    }
                }
            }

            if (!produtoNovoId) continue; 
            globalSuggestedProducts.add(produtoNovoId);

            const produtoNovoRec = productMap.get(produtoNovoId);
            if (!produtoNovoRec) continue;
            const nomeProdutoNovo = formatarNomeComercial(produtoNovoRec.nome);

            // Nova Lógica de 3 Vias (Baseado na tabelaPreco)
            const tabelaLower = (client.tabelaPreco || '').toLowerCase();
            let strategyContext = '';
            let triggerPreview = '';

            if (tabelaLower.includes('atacado') || tabelaLower.includes('avista')) {
                // REGRA 1: Distribuidor/Atacado
                strategyContext = `REGRA/ESTRATÉGIA (MUITO IMPORTANTE): O cliente é um DISTRIBUIDOR/ATACADO. O argumento é de REPASSE e VOLUME. Você deve sugerir a compra do Produto Oportunidade para que os vendedores dele tenham uma novidade rentável para oferecer aos mercadinhos (B2B), ou para fechamento de palete/carga aproveitando o volume do Carro-Chefe. É ESTRITAMENTE PROIBIDO usar a palavra 'gôndola', 'prateleira' ou 'loja'. Use termos como 'repasse', 'novidade para os clientes dele', 'fechar pallet', 'escala'.`;
                triggerPreview = `Sugerir ${nomeProdutoNovo} focado em repasse e volume (Atacado).`;
            } else if (tabelaLower.includes('redes')) {
                // REGRA 2: Rede de Supermercados
                strategyContext = `REGRA/ESTRATÉGIA (MUITO IMPORTANTE): O cliente é uma REDE DE SUPERMERCADOS. O argumento é ALTO VOLUME e DOMÍNIO DE GÔNDOLA. Você deve sugerir aproveitar o grande volume do Carro-Chefe para fazer um "paredão" da marca na prateleira, usando o Produto Oportunidade para blocar a concorrência no ponto de venda e ganhar rentabilidade em escala nas lojas. Use termos como 'paredão da marca', 'ganhar espaço de gôndola', 'blocar o concorrente'.`;
                triggerPreview = `Sugerir ${nomeProdutoNovo} focado em gôndola e volume (Redes).`;
            } else {
                // REGRA 3: Varejo Menor (50a199, 200a699, default)
                strategyContext = `REGRA/ESTRATÉGIA (MUITO IMPORTANTE): O cliente é um VAREJO (MERCADO DE BAIRRO). O argumento é INTRODUÇÃO NA GÔNDOLA por rentabilidade. Fale em aproveitar a viagem/pedido do Carro-Chefe (que já atrai cliente para a loja) para colocar algumas caixas do Produto Oportunidade na prateleira. O objetivo é melhorar o mix da loja e testar essa nova margem para aumentar o ticket. Use termos como 'aproveitar a viagem', 'testar na gôndola', 'melhorar o mix'.`;
                triggerPreview = `Sugerir ${nomeProdutoNovo} focado em mix e gôndola (Varejo).`;
            }

            const systemPrompt = `DADOS DA OPORTUNIDADE:
- Cliente: ${greetingName}
- Produto Carro-Chefe do Cliente (Alto Volume): ${nomeProdutoAtual}
- Produto Oportunidade a ser oferecido (Curva C): ${nomeProdutoNovo}

${strategyContext}`;

            opportunities.push({
                type: 'crossSell',
                clienteId: client.id,
                clienteNome: client.nomeFantasia,
                clienteTelefone: phone,
                description: triggerPreview,
                priority: 'alta',
                actionLabel: 'Oferecer Novo Produto',
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
