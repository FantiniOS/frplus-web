const fs = require('fs');

const pathRoute = 'e:/FRPlus/frplus-web/src/app/api/ai/prestes-a-comprar/route.ts';
let route = fs.readFileSync(pathRoute, 'utf8');

// I need to add `fatorVolume: multiplicadorCarga,` and `diagnostico,` to analyzedClients.push(...)
if (!route.includes('fatorVolume: multiplicadorCarga')) {
    // Let's replace 'cicloAjustado: novoCicloEstimado,' with it, or just append it before 'produtosDaFabrica'
    route = route.replace(
        'produtos: produtosDaFabrica,',
        'produtos: produtosDaFabrica,\n                        fatorVolume: multiplicadorCarga,\n                        diagnostico: diagnostico,'
    );
}

// Ensure the frontend uses `fatorVolume` from backend by assigning it
// Wait, I need to make sure `multiplicadorCarga` and `diagnostico` are in scope where `analyzedClients.push` is called.
// Yes, they were defined via destructuring `const { ... } = radarCarga` just above. Let's check scope.

fs.writeFileSync(pathRoute, route, 'utf8');
console.log('Successfully updated analyzedClients.push in route.ts');
