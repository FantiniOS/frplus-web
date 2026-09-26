const fs = require('fs');

const pathClient = 'e:/FRPlus/frplus-web/src/app/dashboard/ai-insights/AIInsightsClient.tsx';
let c = fs.readFileSync(pathClient, 'utf8');

// Replace {client.cicloMedioDias} -> {Math.round(client.cicloMedioDias)}
c = c.replace(/\{client\.cicloMedioDias\}/g, '{Math.round(client.cicloMedioDias)}');

// Replace {client.diasInativo} dias -> {Math.round(client.diasInativo || 0)} dias
c = c.replace(/\{client\.diasInativo\}(\s+dias)/g, '{Math.round(client.diasInativo || 0)}$1');

// Replace Faltam {client.diasAteProximaCompra ...} dias
// It occurs as: {client.diasAteProximaCompra ?? Math.max(0, client.cicloMedioDias - (client.diasInativo ?? 0))}
c = c.replace(
    /\{client\.diasAteProximaCompra \?\? Math\.max\(0, client\.cicloMedioDias - \(client\.diasInativo \?\? 0\)\)\}/g, 
    '{Math.round(client.diasAteProximaCompra ?? Math.max(0, client.cicloMedioDias - (client.diasInativo ?? 0)))}'
);

// We also have one occurrence of: {client.diasAteProximaCompra ?? Math.max(0, client.cicloMedioDias - client.diasInativo)}
c = c.replace(
    /\{client\.diasAteProximaCompra \?\? Math\.max\(0, client\.cicloMedioDias - client\.diasInativo\)\}/g, 
    '{Math.round(client.diasAteProximaCompra ?? Math.max(0, client.cicloMedioDias - client.diasInativo))}'
);

fs.writeFileSync(pathClient, c, 'utf8');
console.log('Fixed floating point in UI');
