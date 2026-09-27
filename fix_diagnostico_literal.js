const fs = require('fs');

const pathRadar = 'e:/FRPlus/frplus-web/src/lib/calculoRadar.ts';
let radarCode = fs.readFileSync(pathRadar, 'utf8');

// The block to replace
const startMarker = 'const diagnostico = ';
const endMarker = 'return {';

const startIndex = radarCode.indexOf(startMarker);
const endIndex = radarCode.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newDiagnosticoBlock = `const diagnostico = \`**Ritmo de Compra:** \${frequenciaBaseDias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias\\n\` +
                        \`**Carga Média Histórica:** R$ \${cargaMediaHistorica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\\n\` +
                        \`**Última Carga:** R$ \${valorUltimaCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (\${statusCarga})\\n\` +
                        \`**Previsão de Duração Ponderada:** \${previsaoDuracaoDias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias\\n\` +
                        \`**Já se passaram:** \${diasDesdeUltimaCompra.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias\\n\` +
                        \`**Gatilho do Radar (85%):** \${limiarRadar.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias\\n\\n\` +
                        (prestesAComprar ? \`✅ Cliente entrou na zona de recompra.\` : \`⏳ Aguardando prazo.\`);

    `;

    radarCode = radarCode.substring(0, startIndex) + newDiagnosticoBlock + radarCode.substring(endIndex);
    
    // Fix statusCarga as well because it might have `\${diferencaMedia}`
    radarCode = radarCode.replace(/`\\\$\\{diferencaMedia\\}%/g, '`+${diferencaMedia}%'); 
    radarCode = radarCode.replace(/`\\\$\\{/g, '`${'); // just in case
    radarCode = radarCode.replace(/\\\$\\{/g, '${');

    fs.writeFileSync(pathRadar, radarCode, 'utf8');
    console.log('Fixed diagnostico block');
} else {
    console.log('Could not find markers');
}
