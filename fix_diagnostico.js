const fs = require('fs');

const pathRadar = 'e:/FRPlus/frplus-web/src/lib/calculoRadar.ts';
let radar = fs.readFileSync(pathRadar, 'utf8');

// Replace .toFixed(1) with .toFixed(1).replace('.', ',') for dias
// Replace .toFixed(2) with .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) if possible, or just .toFixed(2).replace('.', ',')
// Actually, let's just use string replace on the diagnostico construction!

// Locate the diagnostico string definition
const regexDiagnostico = /const diagnostico = `([^`]+)`/s;
const match = radar.match(regexDiagnostico);

if (match) {
    let diagBlock = match[0];
    
    // Replace .toFixed(1) and .toFixed(2) inside template literals to use formatting
    diagBlock = diagBlock.replace(/frequenciaBaseDias\.toFixed\(1\)/g, "frequenciaBaseDias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })");
    diagBlock = diagBlock.replace(/cargaMediaHistorica\.toFixed\(2\)/g, "cargaMediaHistorica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    diagBlock = diagBlock.replace(/valorUltimaCompra\.toFixed\(2\)/g, "valorUltimaCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    diagBlock = diagBlock.replace(/previsaoDuracaoDias\.toFixed\(1\)/g, "previsaoDuracaoDias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })");
    diagBlock = diagBlock.replace(/diasDesdeUltimaCompra\.toFixed\(1\)/g, "diasDesdeUltimaCompra.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })");
    diagBlock = diagBlock.replace(/limiarRadar\.toFixed\(1\)/g, "limiarRadar.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })");
    
    radar = radar.replace(match[0], diagBlock);
    fs.writeFileSync(pathRadar, radar, 'utf8');
    console.log('Fixed calculoRadar.ts diagnostico formatting');
} else {
    console.log('Could not find diagnostico block in calculoRadar.ts');
}
