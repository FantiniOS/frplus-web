import fs from 'fs';
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
    Nome: string; // Razão Social / Nome Fantasia
    'Tipo Pedido': string;
    'Nota Fiscal': string;
    Serie: string;
    'Vendedor 1': string;
    // Nome (Duplicated column header in CSV, usually the second 'Nome' is Vendedor Name, but we might rely on index or just the first 'Nome' for Client)
    'Cond. Pagto': string;
    Descricao: string; // Produto Descricao or Payment Desc? CSV has multiple 'Descricao' columns. 
    // Based on analysis: 
    // Col 12: Descricao (Cond Pagto?) -> "28 DD"
    // Col 17: Produto Code -> "11.01.04.09"
    // Col 18: Descricao (Produto) -> "VINAGRE..."
    'Prc Unitario': string;
    Quantidade: string;
    Unidade: string;
    'Vlr.Total': string;
    Status: string; // "2"
    Produto: string; // "11.01.04.09"
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
        return parse(dateStr, 'dd/MM/yyyy', new Date());
    } catch {
        return new Date();
    }
}

export async function importSalesCsv(fileBuffer: Buffer) {
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
                        ordersSkipped: 0,
                        errors: [] as string[]
                    };

                    // Pre-fetch or ensure Default Factory exists
                    let defaultFactory = await prisma.fabrica.findFirst({ where: { nome: 'Importação' } });
                    if (!defaultFactory) {
                        defaultFactory = await prisma.fabrica.create({ data: { nome: 'Importação' } });
                    }

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
                            // Try to find
                            const existing = await tx.cliente.findUnique({ where: { cnpj: c.cnpj } });
                            if (existing) {
                                // Update? Maybe not necessary to overwrite valid data with import data, 
                                // but request says "Se existir -> UPDATE".
                                // We prefer not to overwrite manually edited names with truncate CSV names if possible,
                                // but instructions are explicit.
                                await tx.cliente.update({
                                    where: { id: existing.id },
                                    data: {
                                        razaoSocial: c.razaoSocial, // FIX: Overwrite corrupted name
                                        nomeFantasia: c.razaoSocial,
                                        updatedAt: new Date()
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
                                // DO NOT UPDATE PRICES of existing products.
                                // Only update name if it seems generic/missing? No, trust manual data.
                                // We might want to fill gaps if price is 0?
                                // User complaint: "Não puxou os preços da tabela que CRIEI".
                                // This means they WANT the system prices to be respected, or they don't want CSV to overwrite.
                                // Given "Import History", usually we respect CSV prices for the *Order Item*, but for the *Product Definition* we should respect the System.

                                // However, if the csv item has NO price, maybe we should fetch from existing product?
                                // logic below handles product creation/update.
                                // Let's JUST updated 'updatedAt' to show it was processed, but NOT touch prices/names.
                                stats.productsUpdated++;
                            } else {
                                await tx.produto.create({
                                    data: {
                                        codigo: p.code,
                                        nome: p.name,
                                        fabricaId: defaultFactory!.id, // Ensure this ID is valid
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
                    });

                    // --- 3. Orders (Complex, needs ID mapping) ---
                    // Group rows by Order Number
                    const ordersMap = new Map<string, any[]>();
                    for (const row of results) {
                        const orderNum = row['Numero'];
                        if (!orderNum) continue;
                        if (!ordersMap.has(orderNum)) {
                            ordersMap.set(orderNum, []);
                        }
                        ordersMap.get(orderNum)?.push(row);
                    }

                    // Process Orders Transactionally (Chunks if needed, but let's try one go or per-order)
                    // We'll do simple per-order processing to count stats easily
                    const orders = Array.from(ordersMap.entries());
                    for (const [orderNum, rows] of orders) {
                        const firstRow = rows[0];
                        const cnpj = cleanDocument(firstRow['Cliente']);
                        const orderNum = row['Numero'];
                        const existingOrder = await prisma.pedido.findUnique({ where: { id: orderNum } });

                        if (existingOrder) {
                            stats.ordersSkipped++;
                            continue;
                        }

                        /*
                        const protheusId = `Protheus ID: ${orderNum}`;

                        // Check existence by observation tag
                        const existingOrder = await prisma.pedido.findFirst({
                            where: { observacoes: { contains: protheusId } }
                        });
                        */

                        // Find Client
                        const client = await prisma.cliente.findUnique({ where: { cnpj } });
                        if (!client) {
                            stats.errors.push(`Pedido ${orderNum}: Cliente ${cnpj} não encontrado (inesperado).`);
                            continue;
                        }

                        // Format Items
                        const itemsData = [];
                        let totalOrder = 0;

                        for (const row of rows) {
                            const prodCode = row['Produto'];
                            const product = await prisma.produto.findFirst({ where: { codigo: prodCode } });

                            if (product) {
                                const qty = parseFloat(row['Quantidade'].replace(',', '.')) || 0;
                                const unitPrice = parseBrlFloat(row['Prc Unitario']);
                                const total = parseBrlFloat(row['Vlr.Total']);
                                totalOrder += total;

                                itemsData.push({
                                    produtoId: product.id,
                                    quantidade: Math.round(qty), // Schema is Int
                                    precoUnitario: unitPrice,
                                    total: total
                                });
                            }
                        }

                        if (itemsData.length > 0) {
                            try {
                                await prisma.pedido.create({
                                    data: {
                                        clienteId: client.id,
                                        fabricaId: defaultFactory!.id, // Bind to default or extract
                                        status: 'Concluido',
                                        valorTotal: totalOrder,
                                        tabelaPreco: 'atacado', // Default
                                        condicaoPagamento: firstRow['Cond. Pagto'] || 'Importado',
                                        observacoes: protheusId, // KEY FOR IDEMPOTENCY
                                        data: parseDate(firstRow['DT Emissao']),
                                        itens: {
                                            create: itemsData
                                        }
                                    }
                                });
                                stats.ordersCreated++;
                            } catch (e) {
                                console.error(e);
                                stats.errors.push(`Erro ao criar Pedido ${orderNum}.`);
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
