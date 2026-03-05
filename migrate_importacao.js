const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateImportacao() {
    console.log("=== MIGRATION SCRIPT FOR DUMMY 'IMPORTAÇÃO' FACTORY ===");

    // 1. Locate the dummy factory
    const dummyFactory = await prisma.fabrica.findFirst({ where: { nome: 'Importação' } });
    if (!dummyFactory) {
        console.log("No 'Importação' factory found in the database. Nothing to migrate.");
        return;
    }
    console.log(`[1] Found 'Importação' factory with ID: ${dummyFactory.id}`);

    // 2. Fetch all real factories
    const fabricas = await prisma.fabrica.findMany({ where: { id: { not: dummyFactory.id } } });
    if (fabricas.length === 0) {
        console.log("No real factories found in the database to migrate to. Create one first.");
        return;
    }

    console.log("\n[2] Available Real Factories:");
    fabricas.forEach((f, i) => console.log(`  [${i}] ${f.nome} (ID: ${f.id})`));

    // Basic automatic assumption: If there's only one other real factory, just use it. 
    // Otherwise, we take the first real factory explicitly for safety script logic or expect an arg.
    const targetFab = process.argv[2] ? fabricas.find(f => f.id === process.argv[2]) : fabricas[0];

    if (!targetFab) {
        console.log("\n[ERROR] Target factory specified in arguments not found.");
        return;
    }

    console.log(`\n[3] Target Factory Selected: ${targetFab.nome} (ID: ${targetFab.id})`);

    // 3. Perform Migration
    const productsAffected = await prisma.produto.updateMany({
        where: { fabricaId: dummyFactory.id },
        data: { fabricaId: targetFab.id }
    });
    console.log(`[4] Migrated ${productsAffected.count} Products.`);

    const ordersAffected = await prisma.pedido.updateMany({
        where: { fabricaId: dummyFactory.id },
        data: { fabricaId: targetFab.id }
    });
    console.log(`[5] Migrated ${ordersAffected.count} Orders.`);

    // 4. Safe Delete
    try {
        await prisma.fabrica.delete({ where: { id: dummyFactory.id } });
        console.log(`[6] Dummy Factory 'Importação' has been completely deleted.`);
    } catch (e) {
        console.log(`[6] Could not delete 'Importação' dummy factory yet (it may still have relations, e.g. users). Error: ${e.message}`);
    }

    console.log("\n=== MIGRATION COMPLETE ===");
}

migrateImportacao().finally(() => prisma.$disconnect());
