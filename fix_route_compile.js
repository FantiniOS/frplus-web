const fs = require('fs');

const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

// Replace novoCicloEstimado usage
route = route.replace(/novoCicloEstimado/g, 'previsaoDuracaoDias');

// Replace cicloBase usage
route = route.replace(/cicloBase/g, 'frequenciaBaseDias');

// Add missing properties to analyzedClients.push (using a safer replacement target)
if (!route.includes('fatorVolume: multiplicadorCarga')) {
    route = route.replace(
        'cicloAjustado: previsaoDuracaoDias,',
        'cicloAjustado: previsaoDuracaoDias,\n                        fatorVolume: multiplicadorCarga,\n                        diagnostico: diagnostico,'
    );
}

// Remove the `produtosEsgotandoCount` completely from the push if it still exists
route = route.replace(/produtosEsgotandoCount: [^,]+,/, '');

fs.writeFileSync(pathRoute, route, 'utf8');
console.log('Fixed route compilation errors');
