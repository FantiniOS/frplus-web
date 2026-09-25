const fs = require('fs');
const path = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let content = fs.readFileSync(path, 'utf8');

const anchorStart = `// 3. Calcular estimativa de estoque POR PRODUTO desta fábrica`;
const anchorEnd = `analyzedClients.push({`;

const idxStart = content.indexOf(anchorStart);
const idxEnd = content.indexOf(anchorEnd, idxStart);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Could not find anchors");
    process.exit(1);
}

// Extract the products block
const productsBlock = content.substring(idxStart, idxEnd);

// Remove it from the original place
content = content.substring(0, idxStart) + content.substring(idxEnd);

// Find where to inject it
const injectAnchor = `const antecedencia = calcularAntecedencia(novoCicloEstimado);`;
const injectIdx = content.indexOf(injectAnchor);
if (injectIdx === -1) {
    console.error("Could not find inject anchor");
    process.exit(1);
}
const insertPos = injectIdx + injectAnchor.length + 1; // +1 for newline

// Prepare the modified shouldAppear logic
const newShouldAppearLogic = `
                // --- INICIO: CALCULO DE PRODUTOS ---
                ${productsBlock.trim()}
                // --- FIM: CALCULO DE PRODUTOS ---

                const macroShouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);
                const temProdutoEsgotando = produtosDaFabrica.some(p => p.statusEstoque === 'CRITICO' || p.statusEstoque === 'ATENCAO');
                const shouldAppear = macroShouldAppear || temProdutoEsgotando;
`;

// Replace the old shouldAppear logic
const oldShouldAppearLogic = `// O Prazo de Entrega foi removido da subtração para não descontar duas vezes.
                const shouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);`;

content = content.replace(oldShouldAppearLogic, "");

// Inject the new logic
content = content.substring(0, insertPos) + newShouldAppearLogic + content.substring(insertPos);

fs.writeFileSync(path, content, 'utf8');
console.log("File refactored successfully!");
