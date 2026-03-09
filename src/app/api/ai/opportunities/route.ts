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

        // 3. Calculando Curva A Global (Top 50 produtos mais vendidos de todos os tempos)
        const globalStats = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 50
        })
        const globalCurvaAIds = globalStats.map(stat => stat.produtoId);

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

            // Encontra 1 produto Curva A Global que o cliente AINDA NÃO COMPROU
            let produtoNovoId = '';

            // Fazer um giro para tentar diversificar os produtos sugeridos
            for (const globalId of globalCurvaAIds) {
                if (!myProducts.has(globalId)) {
                    if (!globalSuggestedProducts.has(globalId)) {
                        produtoNovoId = globalId;
                        break;
                    }
                }
            }

            // Se nao achou nenhum que ja nao tenha sido sugerido para outro, repete o primeiro que ele nao tem
            if (!produtoNovoId) {
                for (const globalId of globalCurvaAIds) {
                    if (!myProducts.has(globalId)) {
                        produtoNovoId = globalId;
                        break;
                    }
                }
            }

            if (!produtoNovoId) continue; // Cliente já comprou os 50 produtos mais vendidos inteiros (raro)
            globalSuggestedProducts.add(produtoNovoId);

            const produtoNovoRec = productMap.get(produtoNovoId);
            if (!produtoNovoRec) continue;
            const nomeProdutoNovo = formatarNomeComercial(produtoNovoRec.nome);

            const systemPrompt = `Você é um representante comercial de rua. Seu objetivo é introduzir um produto novo no mix do cliente. Use os dados:
- Nome: ${greetingName}
- Produto Novo: ${nomeProdutoNovo}
- Produto Atual: ${nomeProdutoAtual}
TEXTO BASE (Adapte a gramática, sem robô, sem assinar seu nome):
Fala ${greetingName}, parceiro! O seu giro do ${nomeProdutoAtual} tá legal demais, mas reparei que você ainda não colocou o ${nomeProdutoNovo} na gôndola. Esse item tá saindo muito aqui na região, é Curva A total, tá todo mundo levando. O que acha de colocarmos umas caixas dele no seu próximo pedido só pra você testar a saída aí na loja? Certeza que não vai parar na prateleira.`;

            opportunities.push({
                type: 'crossSell',
                clienteId: client.id,
                clienteNome: client.nomeFantasia,
                clienteTelefone: phone,
                description: `Sugerir a introdução de ${nomeProdutoNovo} (Curva A Global) apoiado no alto giro de ${nomeProdutoAtual}.`,
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
