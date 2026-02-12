const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get/Create a test order
        let order = await prisma.pedido.findFirst({
            where: { tipo: 'Venda' }, // Find a 'Venda' order
            include: { itens: true }
        });

        if (!order) {
            console.log("No 'Venda' order found. Creating one...");
            // Retrieve a valid client/product first (simplified)
            // For now, let's assume one exists or just fail.
            return;
        }

        console.log(`[TEST] Target Order ID: ${order.id}`);
        console.log(`[TEST] Current Tipo: ${order.tipo}`);

        // 2. Prepare Payload (Simulating frontend handleSubmit)
        const payload = {
            clienteId: order.clienteId,
            nomeCliente: "Test Client",
            itens: order.itens.map(i => ({
                produtoId: i.produtoId,
                quantidade: i.quantidade,
                precoUnitario: Number(i.precoUnitario),
                total: Number(i.total)
            })),
            valorTotal: Number(order.valorTotal),
            observacoes: "Updated via Reproduction Script",
            tipo: 'Bonificacao', // <--- CHANGING TYPE
            status: order.status,
            tabelaPreco: order.tabelaPreco,
            condicaoPagamento: order.condicaoPagamento
        };

        console.log(`[TEST] Sending PUT request with tipo='Bonificacao'...`);

        // 3. Send PUT
        // Assuming local dev server is running on 3000
        const res = await fetch(`http://localhost:3000/api/orders/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error(`[TEST] API Failed: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            console.error(txt);
            return;
        }

        const updatedOrder = await res.json();
        console.log(`[TEST] API Response Tipo: ${updatedOrder.tipo}`);

        // 4. Verify in DB directly
        const dbCheck = await prisma.pedido.findUnique({
            where: { id: order.id }
        });
        console.log(`[TEST] DB Verify Tipo: ${dbCheck.tipo}`);

        if (updatedOrder.tipo === 'Bonificacao' && dbCheck.tipo === 'Bonificacao') {
            console.log("SUCCESS: Order updated to Bonificacao");
        } else {
            console.error("FAILURE: Order was NOT updated correctly");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
