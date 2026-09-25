const fs = require('fs');
const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

route = route.replace(
    'const shouldAppear = macroShouldAppear;',
    `const macroShouldAppear = daysSinceLastOrder >= (novoCicloEstimado - antecedencia);\n                const shouldAppear = macroShouldAppear;`
);

fs.writeFileSync(pathRoute, route, 'utf8');
