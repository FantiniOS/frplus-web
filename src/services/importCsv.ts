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
                            const existing = await tx.cliente.findUnique({ where: { cnpj: c.cnpj } });
                            if (existing) {
                                await tx.cliente.update({
                                    where: { id: existing.id },
                                    data: {
                                        razaoSocial: c.razaoSocial,
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
                                // PROTECT PRICES: Do NOT update prices of existing products.
                                await tx.produto.update({
                                    where: { id: existing.id },
                                    data: { updatedAt: new Date() }
                                });
                                stats.productsUpdated++;
                            } else {
                                await tx.produto.create({
                                    data: {
                                        codigo: p.code,
                                        nome: p.name,
                                        fabricaId: defaultFactory!.id,
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
                    const ordersMap = new Map<string, any[]>();
                    for (const row of results) {
                        const orderNum = row['Numero'];
                        if (!orderNum) continue;
                        if (!ordersMap.has(orderNum)) {
                            ordersMap.set(orderNum, []);
                        }
                        ordersMap.get(orderNum)?.push(row);
                    }

                    const orders = Array.from(ordersMap.entries());
                    for (const [orderNum, rows] of orders) {
                        const firstRow = rows[0];
                        const cnpj = cleanDocument(firstRow['Cliente']);

                        // Check if order exists by ID (Using Protheus Number as ID)
                        // If it exists, SKIP IT (Idempotency)
                        const existingOrder = await prisma.pedido.findUnique({ where: { id: orderNum } });

                        if (existingOrder) {
                            stats.ordersSkipped++;
                            continue;
                        }

                        // Find Client
                        const client = await prisma.cliente.findUnique({ where: { cnpj } });
                        if (!client) {
                            stats.errors.push(`Pedido ${orderNum}: Cliente ${cnpj} não encontrado.`);
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
                                let unitPrice = parseBrlFloat(row['Prc_Unitario']);

                                // FALLBACK: If CSV price is 0, use the Product Table price (From System)
                                if (unitPrice === 0) {
                                    unitPrice = Number(product.precoAtacado) || 0;
                                }

                                const total = parseBrlFloat(row['Vlr.Total']) || (unitPrice * qty);
                                totalOrder += total;

                                itemsData.push({
                                    produtoId: product.id,
                                    quantidade: Math.round(qty),
                                    precoUnitario: unitPrice,
                                    total: total
                                });
                            }
                        }

                        if (itemsData.length > 0) {
                            try {
                                await prisma.pedido.create({
                                    data: {
                                        id: orderNum, // EXPLICIT ID FROM PROTHEUS
                                        clienteId: client.id,
                                        fabricaId: defaultFactory!.id,
                                        status: 'Concluido',
                                        valorTotal: totalOrder,
                                        tabelaPreco: 'atacado',
                                        condicaoPagamento: firstRow['Cond. Pagto'] || 'Importado',
                                        observacoes: `Importado em ${new Date().toLocaleDateString()}`,
                                        data: parseDate(firstRow['DT_Emissao']),
                                        itens: {
                                            create: itemsData
                                        }
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
