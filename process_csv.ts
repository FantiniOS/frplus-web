import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';
import { importSalesBatch } from './src/services/importBatch';

const prisma = new PrismaClient();

async function processFile(filePath: string, fabricaId: string) {
    console.log('Iniciando leitura do arquivo: ' + filePath);
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
    });
    
    console.log(parsed.data.length + ' linhas encontradas. Separando em lotes de 1000...');
    
    const rows = parsed.data as any[];
    const CHUNK_SIZE = 1000;
    
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        console.log('Processando lote ' + (Math.floor(i/CHUNK_SIZE) + 1) + ' de ' + Math.ceil(rows.length/CHUNK_SIZE) + '...');
        try {
            const stats = await importSalesBatch(chunk, fabricaId);
            console.log('Lote importado com sucesso:', stats);
        } catch (err) {
            console.error('Erro no lote:', err);
        }
    }
    console.log('Arquivo finalizado.');
}

async function main() {
    const dir = 'E:\\FRPlus\\historico_erp';
    if (!fs.existsSync(dir)) {
        console.log('Pasta historico_erp nao encontrada.');
        return;
    }
    
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.csv'));
    if (files.length === 0) {
        console.log('Nenhum CSV encontrado na pasta.');
        return;
    }
    
    // Defaulting to BELMONT for now based on the previous sample. 
    const fabricaBelmont = 'cmm3e1jks003ogtu9mlyac1qi';
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        await processFile(fullPath, fabricaBelmont);
    }
    
    console.log('Importacção Total Conclu?da!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
