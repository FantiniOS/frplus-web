const fs = require('fs');

const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

route = route.replace(/diasDeAntecedencia: antecedencia,/g, 'diasDeAntecedencia: Math.ceil(previsaoDuracaoDias * 0.15),');
route = route.replace(/confiancaCiclo: confianca,/g, "confiancaCiclo: 'alta',");

fs.writeFileSync(pathRoute, route, 'utf8');
console.log('Fixed undefined variables in analyzedClients.push');
