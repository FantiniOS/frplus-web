import fs from 'fs';
import csv from 'csv-parser'; // Assuming installed in node_modules

const FILE_PATH = 'e:/FRPlus/consulta20260209203555.csv';

const headers = [
    'Filial', 'Numero', 'DT_Emissao', 'Cliente', 'Loja', 'Nome_Cliente',
    'Tipo_Pedido', 'Nota_Fiscal', 'Serie', 'Vendedor_1', 'Nome_Vendedor',
    'Cond_Pagto', 'Descricao_Pagto', 'Desconto_1', 'DT_Emissao_Fat', 'Status',
    'Produto', 'Descricao_Produto', 'Unidade', 'Quantidade', 'Prc_Unitario', 'Vlr_Total'
];

console.log('Reading file:', FILE_PATH);

fs.createReadStream(FILE_PATH)
    .pipe(csv({
        separator: ';',
        skipLines: 2,
        headers: headers
    }))
    .on('data', (data) => {
        console.log('--- Row ---');
        console.log('Cliente CNPJ:', data['Cliente']);
        console.log('Nome Cliente:', data['Nome_Cliente']);
        console.log('Produto Code:', data['Produto']);
        console.log('Produto Desc:', data['Descricao_Produto']);
        console.log('Raw Data sample:', JSON.stringify(data));
        process.exit(0); // Stop after 1 row
    });
