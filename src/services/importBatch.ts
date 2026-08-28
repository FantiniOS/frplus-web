import { prisma } from '@/lib/prisma';
import { parse } from 'date-fns';

// Helper to clean CNPJ/CPF
const cleanDocument = (doc: string) => {
    if (!doc) return '';
    return doc.replace(/\D/g, '');
}

// Helper to parse float BRL "1.234,56" -> 1234.56 or "1234.56"
const parseBrlFloat = (val: string) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/\./g, '').replace(',', '.'));
};

const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    try {
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            const dia = parseInt(parts[0], 10);
            const mes = parseInt(parts[1], 10);
            const ano = parseInt(parts[2], 10);
            if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
                return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
            }
        }
        return parse(dateStr, 'dd/MM/yyyy', new Date());
    } catch {
        return new Date();
    }
}

const parseDateOrNull = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr || !dateStr.trim()) return null;
    try {
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            const dia = parseInt(parts[0], 10);
            const mes = parseInt(parts[1], 10);
            const ano = parseInt(parts[2], 10);
            if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
            return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
        }
        return null;
    } catch {
        return null;
    }
}

export async function importSalesBatch(rows: any[], targetFabricaId: string) {
    const stats = {
        clientsNew: 0,
        clientsUpdated: 0,
        productsNew: 0,
        productsUpdated: 0,
        ordersCreated: 0,
        ordersUpdated: 0,
        ordersSkipped: 0,
        errors: [] as string[]
    };

    if (!rows || rows.length === 0) return stats;

    // --- 1. Distinct Clients ---
    const clientsMap = new Map<string, any>();
    for (const row of rows) {
        const cnpj = cleanDocument(row['Cliente'] || '');
        if (cnpj && !clientsMap.has(cnpj)) {
            clientsMap.set(cnpj, {
                cnpj,
                razaoSocial: row['Nome_Cliente'] || 'Cliente Importado',
            });
        }
    }

    // --- 2. Distinct Products ---
    const productsMap = new Map<string, any>();
    for (const row of rows) {
        const code = row['Produto']?.toString().trim();
        const desc = row['Descricao_Produto'];

        if (code && !productsMap.has(code)) {
            productsMap.set(code, {
                code,
                name: desc || `Produto ${code}`,
                price: parseBrlFloat(row['Prc_Unitario'])
            });
        }
    }

    // EXECUTE BATCHES
    await prisma.$transaction(async (tx) => {
        // Clients
        const clients = Array.from(clientsMap.values());
        for (const c of clients) {
            const existing = await tx.cliente.findUnique({ where: { cnpj: c.cnpj } });
            if (existing) {
                await tx.cliente.update({
                    where: { id: existing.id },
                    data: {
                        razaoSocial: c.razaoSocial,
                        nomeFantasia: c.razaoSocial
                    }
                });
                stats.clientsUpdated++;
            } else {
                await tx.cliente.create({
                    data: {
                        razaoSocial: c.razaoSocial,
                        nomeFantasia: c.razaoSocial,
                        cnpj: c.cnpj,
                        email: 'importado@sistema.com', // Dummy required
                        telefone: '',
                        celular: '',
                        endereco: '',
                        bairro: '',
                        cidade: '',
                        estado: '',
                        cep: '',
                    }
                });
                stats.clientsNew++;
            }
        }

        // Products
        const products = Array.from(productsMap.values());
        for (const p of products) {
            const existing = await tx.produto.findFirst({ where: { codigo: p.code } });
            if (existing) {
                // PROTECT PRICES: Just count as updated, no changes needed.
                stats.productsUpdated++;
            } else {
                await tx.produto.create({
                    data: {
                        codigo: p.code,
                        nome: p.name,
                        fabricaId: targetFabricaId,
                        precoAtacado: p.price,
                        preco50a199: p.price,
                        preco200a699: p.price,
                        precoAtacadoAVista: p.price,
                        precoRedes: p.price,
                    }
                });
                stats.productsNew++;
            }
        }
    }, { timeout: 30000, maxWait: 60000 });

    // --- 3. Orders (OPTIMIZED UPSERT) ---
    const ordersMap = new Map<string, any[]>();
    for (const row of rows) {
        const orderNum = row['Numero']?.toString().trim();
        if (!orderNum) continue;
        if (!ordersMap.has(orderNum)) {
            ordersMap.set(orderNum, []);
        }
        ordersMap.get(orderNum)?.push(row);
    }

    const orderNums = Array.from(ordersMap.keys());

    if (orderNums.length === 0) {
        return stats;
    }

    // ====== BATCH PRE-FETCH (3 queries instead of N*3) ======
    const existingOrderIds = new Set(
        (await prisma.pedido.findMany({
            where: { id: { in: orderNums } },
            select: { id: true }
        })).map(o => o.id)
    );

    const allClients = await prisma.cliente.findMany({ 
        where: { cnpj: { in: Array.from(clientsMap.keys()) } },
        select: { id: true, cnpj: true } 
    });
    const clientByCnpj = new Map(allClients.map(c => [c.cnpj, c.id]));

    const allProducts = await prisma.produto.findMany({ 
        where: { codigo: { in: Array.from(productsMap.keys()) } },
        select: { id: true, codigo: true, precoAtacado: true, fabricaId: true } 
    });
    const productByCode = new Map(allProducts.map(p => [p.codigo, p]));

    console.log(`[Batch Import] ${orderNums.length} orders in chunk. ${existingOrderIds.size} already exist (update). ${orderNums.length - existingOrderIds.size} new.`);

    // Pre-fetch vendedores for seller matching
    const allVendedores = await prisma.vendedor.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, percentualComissao: true }
    });
    const vendedorByName = new Map(
        allVendedores.map(v => [v.nome.trim().toLowerCase(), v])
    );

    // ====== SEQUENTIAL UPDATE existing orders (fix: race condition) ======
    for (const [orderNum, docRows] of Array.from(ordersMap.entries())) {
        if (!existingOrderIds.has(orderNum)) continue;

        const firstRow = docRows[0];
        const notaFiscal = firstRow['Nota_Fiscal']?.toString().trim() || null;
        let tipoPedido = 'Venda';
        let condPagto = firstRow['Cond_Pagto']?.toString() || 'Importado';
        if (firstRow['Descricao_Pagto']?.toString().trim() === 'SEM DEBITO') {
            tipoPedido = 'Bonificacao';
            condPagto = 'BONIFICACAO';
        }

        const dataNotaFiscal = parseDateOrNull(firstRow['DT_Emissao_Fat']?.toString());

        // Match vendedor by name
        const nomeVendedorRaw = firstRow['Nome_Vendedor']?.toString().trim() || '';
        const vendedorMatch = vendedorByName.get(nomeVendedorRaw.toLowerCase());

        // Rebuild items from CSV rows (block-scoped to avoid leaking state)
        const itemsData: { produtoId: string; quantidade: number; precoUnitario: number; total: number }[] = [];
        let totalOrder = 0;
        for (const row of docRows) {
            const prodCode = row['Produto']?.toString().trim();
            const product = productByCode.get(prodCode);

            if (product) {
                const qtyStr = row['Quantidade']?.toString() || '0';
                const qty = parseFloat(qtyStr.replace(',', '.')) || 0;
                let unitPrice = parseBrlFloat(row['Prc_Unitario']?.toString() || '0');

                if (unitPrice === 0) {
                    unitPrice = Number(product.precoAtacado) || 0;
                }

                let total = parseBrlFloat(row['Vlr_Total']?.toString() || '0');
                if (total === 0) {
                    total = unitPrice * qty;
                }
                totalOrder += total;

                itemsData.push({
                    produtoId: product.id,
                    quantidade: Math.round(qty),
                    precoUnitario: unitPrice,
                    total: total
                });
            }
        }

        // Calculate commission if vendedor found
        const valorComissao = vendedorMatch
            ? totalOrder * (Number(vendedorMatch.percentualComissao) / 100)
            : null;

        try {
            // Delete old items and update header + recreate items atomically
            await prisma.$transaction(async (tx) => {
                await tx.itemPedido.deleteMany({ where: { pedidoId: orderNum } });
                await tx.pedido.update({
                    where: { id: orderNum },
                    data: {
                        notaFiscal,
                        condicaoPagamento: condPagto,
                        tipo: tipoPedido,
                        valorTotal: totalOrder,
                        data: parseDate(firstRow['DT_Emissao']?.toString() || ''),
                        ...(dataNotaFiscal ? { dataFaturamento: dataNotaFiscal } : {}),
                        fabricaId: targetFabricaId,
                        nomeVendedorImport: nomeVendedorRaw || null,
                        ...(vendedorMatch ? { vendedorId: vendedorMatch.id } : {}),
                        ...(valorComissao !== null ? { valorComissao: valorComissao } : {}),
                        itens: { create: itemsData }
                    }
                });
            });
            stats.ordersUpdated++;
        } catch (e) {
            stats.errors.push(`Erro ao atualizar Pedido ${orderNum}: ${e}`);
        }
    }

    // ====== INSERT new orders ======
    for (const [orderNum, docRows] of Array.from(ordersMap.entries())) {
        if (existingOrderIds.has(orderNum)) continue;

        const firstRow = docRows[0];
        const cnpj = cleanDocument(firstRow['Cliente'] || '');
        const notaFiscal = firstRow['Nota_Fiscal']?.toString().trim() || null;
        let tipoPedido = 'Venda';
        let condPagto = firstRow['Cond_Pagto']?.toString() || 'Importado';
        if (firstRow['Descricao_Pagto']?.toString().trim() === 'SEM DEBITO') {
            tipoPedido = 'Bonificacao';
            condPagto = 'BONIFICACAO';
        }

        const clientId = clientByCnpj.get(cnpj);
        if (!clientId) {
            stats.errors.push(`Pedido ${orderNum}: Cliente ${cnpj} não encontrado.`);
            stats.ordersSkipped++;
            continue;
        }

        const itemsData = [];
        let totalOrder = 0;

        for (const row of docRows) {
            const prodCode = row['Produto']?.toString().trim();
            const product = productByCode.get(prodCode);

            if (product) {
                const qtyStr = row['Quantidade']?.toString() || '0';
                const qty = parseFloat(qtyStr.replace(',', '.')) || 0;
                let unitPrice = parseBrlFloat(row['Prc_Unitario']?.toString() || '0');

                if (unitPrice === 0) {
                    unitPrice = Number(product.precoAtacado) || 0;
                }

                let total = parseBrlFloat(row['Vlr_Total']?.toString() || '0');
                if (total === 0) {
                    total = unitPrice * qty;
                }
                totalOrder += total;

                itemsData.push({
                    produtoId: product.id,
                    quantidade: Math.round(qty),
                    precoUnitario: unitPrice,
                    total: total
                });
            }
        }

        const dataNotaFiscalCreate = parseDateOrNull(firstRow['DT_Emissao_Fat']?.toString());

        // Match vendedor by name for new orders
        const nomeVendedorRaw = firstRow['Nome_Vendedor']?.toString().trim() || '';
        const vendedorMatch = vendedorByName.get(nomeVendedorRaw.toLowerCase());

        // Calculate commission if vendedor found
        const valorComissao = vendedorMatch
            ? totalOrder * (Number(vendedorMatch.percentualComissao) / 100)
            : null;

        if (itemsData.length > 0) {
            try {
                await prisma.pedido.create({
                    data: {
                        id: orderNum,
                        clienteId: clientId,
                        fabricaId: targetFabricaId,
                        status: 'Concluido',
                        tipo: tipoPedido,
                        valorTotal: totalOrder,
                        tabelaPreco: 'atacado',
                        condicaoPagamento: condPagto,
                        notaFiscal: notaFiscal,
                        observacoes: `Importado em ${new Date().toLocaleDateString()}`,
                        data: parseDate(firstRow['DT_Emissao']?.toString() || ''),
                        ...(dataNotaFiscalCreate ? { dataFaturamento: dataNotaFiscalCreate } : {}),
                        nomeVendedorImport: nomeVendedorRaw || null,
                        ...(vendedorMatch ? { vendedorId: vendedorMatch.id } : {}),
                        ...(valorComissao !== null ? { valorComissao: valorComissao } : {}),
                        itens: { create: itemsData }
                    }
                });
                stats.ordersCreated++;
            } catch (e) {
                console.error(`Erro do prisma ao criar Pedido ${orderNum}:`, e);
                stats.errors.push(`Erro ao criar Pedido ${orderNum}: ${(e as Error).message}`);
                stats.ordersSkipped++;
            }
        } else {
            stats.errors.push(`Pedido ${orderNum}: Sem itens válidos para importar.`);
            stats.ordersSkipped++;
        }
    }

    return stats;
}
