/* fs removed - not used and breaks serverless */
import csv from 'csv-parser';
import { prisma } from '@/lib/prisma';
import { parse } from 'date-fns';
import { Readable } from 'stream';

interface CsvRow {
    Filial: string;
    Numero: string;
    'DT Emissao': string;
    Cliente: string; // CNPJ
    Loja: string;
    Nome: string;
    'Tipo Pedido': string;
    'Nota Fiscal': string;
    Serie: string;
    'Vendedor 1': string;
    'Cond. Pagto': string;
    Descricao: string;
    'Prc Unitario': string;
    Quantidade: string;
    Unidade: string;
    'Vlr.Total': string;
    Status: string;
    Produto: string;
}

// Helper to clean CNPJ/CPF
const cleanDocument = (doc: string) => doc.replace(/\D/g, '');

// Helper to parse float BRL "1.234,56" -> 1234.56
const parseBrlFloat = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/\./g, '').replace(',', '.'));
};

const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const dia = parseInt(parts[0], 10);
            const mes = parseInt(parts[1], 10);
            const ano = parseInt(parts[2], 10);
            // Instancia a data forçando meio-dia em UTC (12:00:00) 
            // para evitar o bug de rollback de dia em fusos negativos (ex: Brasil/GMT-3)
            return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
        }
        return parse(dateStr, 'dd/MM/yyyy', new Date());
    } catch {
        return new Date();
    }
}

// Parse date retornando null se string vazia (para campos opcionais como dataFaturamento)
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

export async function importSalesCsv(fileBuffer: Buffer, targetFabricaId: string) {
    const results: any[] = [];
    const stream = Readable.from(fileBuffer);

    return new Promise((resolve, reject) => {
        const headers = [
            'Filial', 'Numero', 'DT_Emissao', 'Cliente', 'Loja', 'Nome_Cliente',
            'Tipo_Pedido', 'Nota_Fiscal', 'Serie', 'Vendedor_1', 'Nome_Vendedor',
            'Cond_Pagto', 'Descricao_Pagto', 'Desconto_1', 'DT_Emissao_Fat', 'Status',
            'Produto', 'Descricao_Produto', 'Unidade', 'Quantidade', 'Prc_Unitario', 'Vlr_Total'
        ];

        stream
            .pipe(csv({
                separator: ';',
                skipLines: 2, // Skip 'Consulta' AND the original Header row
                headers: headers // Use our manual unique headers
            }))
            .on('headers', (h) => console.log('Parsed Headers:', h)) // Debug
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    const stats = {
                        clientsNew: 0,
                        clientsUpdated: 0,
                        productsNew: 0,
                        productsUpdated: 0,
                        ordersCreated: 0,
                        ordersUpdated: 0,
                        errors: [] as string[]
                    };

                    // Removed dummy 'Importação' logic

                    // --- 1. Distinct Clients ---
                    const clientsMap = new Map<string, any>();
                    for (const row of results) {
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
                    for (const row of results) {
                        const code = row['Produto'];
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
                    for (const row of results) {
                        const orderNum = row['Numero'];
                        if (!orderNum) continue;
                        if (!ordersMap.has(orderNum)) {
                            ordersMap.set(orderNum, []);
                        }
                        ordersMap.get(orderNum)?.push(row);
                    }

                    const orderNums = Array.from(ordersMap.keys());

                    // ====== BATCH PRE-FETCH (3 queries instead of N*3) ======
                    const existingOrderIds = new Set(
                        (await prisma.pedido.findMany({
                            where: { id: { in: orderNums } },
                            select: { id: true }
                        })).map(o => o.id)
                    );

                    const allClients = await prisma.cliente.findMany({ select: { id: true, cnpj: true } });
                    const clientByCnpj = new Map(allClients.map(c => [c.cnpj, c.id]));

                    const allProducts = await prisma.produto.findMany({ select: { id: true, codigo: true, precoAtacado: true, fabricaId: true } });
                    const productByCode = new Map(allProducts.map(p => [p.codigo, p]));

                    console.log(`[CSV Import] ${orderNums.length} orders to process. ${existingOrderIds.size} already exist (will update). ${orderNums.length - existingOrderIds.size} new.`);

                    // Pre-fetch vendedores for seller matching
                    const allVendedores = await prisma.vendedor.findMany({
                        where: { ativo: true },
                        select: { id: true, nome: true, percentualComissao: true }
                    });
                    const vendedorByName = new Map(
                        allVendedores.map(v => [v.nome.trim().toLowerCase(), v])
                    );

                    // ====== SEQUENTIAL UPDATE existing orders (fix: race condition) ======
                    for (const [orderNum, rows] of Array.from(ordersMap.entries())) {
                        if (!existingOrderIds.has(orderNum)) continue;

                        const firstRow = rows[0];
                        const notaFiscal = firstRow['Nota_Fiscal']?.trim() || null;
                        let tipoPedido = 'Venda';
                        let condPagto = firstRow['Cond_Pagto'] || 'Importado';
                        if (firstRow['Descricao_Pagto']?.trim() === 'SEM DEBITO') {
                            tipoPedido = 'Bonificacao';
                            condPagto = 'BONIFICACAO';
                        }

                        // Factory is directly chosen by UI

                        // Parsear data da NF da segunda coluna 'DT Emissao' (mapeada como DT_Emissao_Fat)
                        const dataNotaFiscal = parseDateOrNull(firstRow['DT_Emissao_Fat']);

                        // Match vendedor by name
                        const nomeVendedorRaw = firstRow['Nome_Vendedor']?.trim() || '';
                        const vendedorMatch = vendedorByName.get(nomeVendedorRaw.toLowerCase());

                        // Rebuild items from CSV rows (block-scoped to avoid leaking state)
                        const itemsData: { produtoId: string; quantidade: number; precoUnitario: number; total: number }[] = [];
                        let totalOrder = 0;
                        for (const row of rows) {
                            const prodCode = row['Produto'];
                            const product = productByCode.get(prodCode);

                            if (product) {
                                const qty = parseFloat(row['Quantidade'].replace(',', '.')) || 0;
                                let unitPrice = parseBrlFloat(row['Prc_Unitario']);

                                if (unitPrice === 0) {
                                    unitPrice = Number(product.precoAtacado) || 0;
                                }

                                const total = parseBrlFloat(row['Vlr_Total']) || (unitPrice * qty);
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
                                        data: parseDate(firstRow['DT_Emissao']),
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
                    for (const [orderNum, rows] of Array.from(ordersMap.entries())) {
                        if (existingOrderIds.has(orderNum)) continue;

                        const firstRow = rows[0];
                        const cnpj = cleanDocument(firstRow['Cliente']);
                        const notaFiscal = firstRow['Nota_Fiscal']?.trim() || null;
                        let tipoPedido = 'Venda';
                        let condPagto = firstRow['Cond_Pagto'] || 'Importado';
                        if (firstRow['Descricao_Pagto']?.trim() === 'SEM DEBITO') {
                            tipoPedido = 'Bonificacao';
                            condPagto = 'BONIFICACAO';
                        }

                        const clientId = clientByCnpj.get(cnpj);
                        if (!clientId) {
                            stats.errors.push(`Pedido ${orderNum}: Cliente ${cnpj} não encontrado.`);
                            continue;
                        }

                        const itemsData = [];
                        let totalOrder = 0;

                        for (const row of rows) {
                            const prodCode = row['Produto'];
                            const product = productByCode.get(prodCode);

                            if (product) {
                                const qty = parseFloat(row['Quantidade'].replace(',', '.')) || 0;
                                let unitPrice = parseBrlFloat(row['Prc_Unitario']);

                                if (unitPrice === 0) {
                                    unitPrice = Number(product.precoAtacado) || 0;
                                }

                                const total = parseBrlFloat(row['Vlr_Total']) || (unitPrice * qty);
                                totalOrder += total;

                                itemsData.push({
                                    produtoId: product.id,
                                    quantidade: Math.round(qty),
                                    precoUnitario: unitPrice,
                                    total: total
                                });
                            }
                        }

                        // Parsear data da NF da segunda coluna 'DT Emissao' (mapeada como DT_Emissao_Fat)
                        const dataNotaFiscalCreate = parseDateOrNull(firstRow['DT_Emissao_Fat']);

                        // Match vendedor by name for new orders
                        const nomeVendedorRaw = firstRow['Nome_Vendedor']?.trim() || '';
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
                                        data: parseDate(firstRow['DT_Emissao']),
                                        ...(dataNotaFiscalCreate ? { dataFaturamento: dataNotaFiscalCreate } : {}),
                                        nomeVendedorImport: nomeVendedorRaw || null,
                                        ...(vendedorMatch ? { vendedorId: vendedorMatch.id } : {}),
                                        ...(valorComissao !== null ? { valorComissao: valorComissao } : {}),
                                        itens: { create: itemsData }
                                    }
                                });
                                stats.ordersCreated++;
                            } catch (e) {
                                console.error(e);
                                stats.errors.push(`Erro ao criar Pedido ${orderNum}: ${e}`);
                            }
                        }
                    }

                    resolve(stats);
                } catch (err) {
                    reject(err);
                }
            });
    });
}
