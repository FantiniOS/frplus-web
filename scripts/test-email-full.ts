import { prisma } from '../src/lib/prisma';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const now = new Date("2026-08-07T18:00:00Z"); // Simulando uma execução de sexta-feira passada
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Calculo da Segunda-feira da semana corrente (00:00:00)
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);

        // BLOCO 1: Termômetro Mensal (Apenas Vendas)
        const aggregateMes = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            where: {
                dataFaturamento: { gte: startOfMonth, lte: now },
                status: { in: ['Faturado', 'Concluido'] },
                tipo: 'Venda'
            }
        });
        const totalFaturadoMes = aggregateMes._sum.valorTotal ? Number(aggregateMes._sum.valorTotal) : 0;

        // BLOCO 2: Faturamento da Semana (Apenas Vendas)
        const aggregateSemanaVendas = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            _count: { id: true },
            where: {
                dataFaturamento: { gte: startOfWeek, lte: now },
                status: { in: ['Faturado', 'Concluido'] },
                tipo: 'Venda'
            }
        });
        const totalFaturadoSemana = aggregateSemanaVendas._sum.valorTotal ? Number(aggregateSemanaVendas._sum.valorTotal) : 0;
        const qtdePedidosVenda = aggregateSemanaVendas._count.id;

        // BLOCO 2: Bonificações da Semana
        const aggregateSemanaBonif = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            _count: { id: true },
            where: {
                dataFaturamento: { gte: startOfWeek, lte: now },
                status: { in: ['Faturado', 'Concluido'] },
                tipo: 'Bonificacao'
            }
        });
        const totalBonificacaoSemana = aggregateSemanaBonif._sum.valorTotal ? Number(aggregateSemanaBonif._sum.valorTotal) : 0;
        const qtdePedidosBonif = aggregateSemanaBonif._count.id;
        
        const totalPedidosSemana = qtdePedidosVenda + qtdePedidosBonif;

        // Produto Mais Vendido (Curva A da Semana) - Apenas Vendas
        const itensGroup = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            where: {
                pedido: {
                    dataFaturamento: { gte: startOfWeek, lte: now },
                    status: { in: ['Faturado', 'Concluido'] },
                    tipo: 'Venda'
                }
            },
            orderBy: { _sum: { quantidade: 'desc' } },
            take: 1
        });

        let nomeProdutoDestaque = 'Nenhum produto vendido';
        let qtdeProdutoDestaque = 0;
        if (itensGroup.length > 0) {
            const prod = await prisma.produto.findUnique({ where: { id: itensGroup[0].produtoId } });
            nomeProdutoDestaque = prod ? prod.nome : '-';
            qtdeProdutoDestaque = itensGroup[0]._sum.quantidade || 0;
        }

        // Top 3 Clientes da Semana - Apenas Vendas
        const clientesGroup = await prisma.pedido.groupBy({
            by: ['clienteId'],
            _sum: { valorTotal: true },
            where: {
                dataFaturamento: { gte: startOfWeek, lte: now },
                status: { in: ['Faturado', 'Concluido'] },
                tipo: 'Venda'
            },
            orderBy: { _sum: { valorTotal: 'desc' } },
            take: 3
        });

        const topClientes = [];
        for (const c of clientesGroup) {
            const cli = await prisma.cliente.findUnique({ where: { id: c.clienteId } });
            if (cli) {
                topClientes.push({
                    nome: cli.nomeFantasia || cli.razaoSocial,
                    valor: c._sum.valorTotal ? Number(c._sum.valorTotal) : 0
                });
            }
        }

        const formatCurrency = (val: number) => 
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        const formatDateWithDay = (date: Date) => {
            const dayStr = String(date.getDate()).padStart(2, '0');
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            const shortDate = `${dayStr}/${monthStr}`;
            const dayName = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date);
            const cleanDay = dayName.replace('.', '').charAt(0).toUpperCase() + dayName.replace('.', '').slice(1);
            return `${cleanDay}, ${shortDate}`;
        };

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://frplus-web.vercel.app';

        // HTML Email Template
        const html = \`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resumo Semanal - FRPlus</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; -webkit-font-smoothing: antialiased;">
    <div style="background-color: #0f172a; padding: 30px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #1e293b; border-radius: 8px; border: 1px solid #334155;">
            <tr>
                <td style="padding: 30px;">
                    <!-- Cabecalho -->
                    <div style="text-align: center; border-bottom: 1px solid #334155; padding-bottom: 25px; margin-bottom: 25px;">
                        <img src="\${baseUrl}/logo.png" alt="FRPlus Logo" style="max-height: 50px; margin-bottom: 20px; display: inline-block;" />
                        <h2 style="margin: 0; color: #f8fafc; font-size: 24px; font-weight: normal;">Relatório Semanal <span style="color: #3b82f6;">FRPlus</span></h2>
                    </div>

                    <!-- BLOCO 1: Termômetro Mensal -->
                    <table width="100%" cellpadding="15" cellspacing="0" border="0" style="margin-bottom: 30px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155; border-left: 4px solid #10b981; text-align: left;">
                        <tr>
                            <td>
                                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Termômetro Mensal</p>
                                <p style="margin: 8px 0 0 0; font-size: 22px; font-weight: bold; color: #f8fafc;">
                                    Faturamento Acumulado: <span style="color: #10b981;">\${formatCurrency(totalFaturadoMes)}</span>
                                </p>
                            </td>
                        </tr>
                    </table>

                    <!-- BLOCO 3: Nota Explicativa (Subtitulo da Semana) -->
                    <h3 style="margin: 0 0 15px 0; color: #f8fafc; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; display: inline-block;">
                        Desempenho da Semana <span style="font-size: 14px; font-weight: normal; color: #94a3b8; margin-left: 10px;">(\${formatDateWithDay(startOfWeek)} a \${formatDateWithDay(now)})</span>
                    </h3>

                    <!-- BLOCO 2: Resumo da Semana -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                        <tr>
                            <!-- Vendas -->
                            <td width="32%" valign="top">
                                <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">💰 Vendas</p>
                                            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; color: #3b82f6;">\${formatCurrency(totalFaturadoSemana)}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td width="2%">&nbsp;</td> <!-- Espacador -->
                            <!-- Bonificações -->
                            <td width="32%" valign="top">
                                <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">🎁 Bonificações</p>
                                            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; color: #f43f5e;">\${formatCurrency(totalBonificacaoSemana)}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td width="2%">&nbsp;</td> <!-- Espacador -->
                            <!-- Pedidos -->
                            <td width="32%" valign="top">
                                <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">📦 Pedidos</p>
                                            <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: bold; color: #f8fafc;">\${totalPedidosSemana}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- Top Clientes -->
                    <h3 style="margin: 0 0 15px 0; color: #f8fafc; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; display: inline-block;">🏆 Top 3 Clientes da Semana</h3>
                    \${topClientes.length > 0 ? \`
                        <table width="100%" cellpadding="12" cellspacing="0" border="0" style="margin-bottom: 30px; border-collapse: collapse; background-color: #0f172a; border-radius: 6px; overflow: hidden; border: 1px solid #334155;">
                            \${topClientes.map((c, i) => \`
                                <tr>
                                    <td style="border-bottom: \${i === topClientes.length - 1 ? 'none' : '1px solid #334155'}; color: #cbd5e1; font-size: 14px;">
                                        <strong style="color: #3b82f6;">#\${i + 1}</strong> &nbsp;\${c.nome}
                                    </td>
                                    <td style="border-bottom: \${i === topClientes.length - 1 ? 'none' : '1px solid #334155'}; text-align: right; color: #f8fafc; font-weight: bold; font-size: 14px;">
                                        \${formatCurrency(c.valor)}
                                    </td>
                                </tr>
                            \`).join('')}
                        </table>
                    \` : '<p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px;">Nenhuma venda registrada na semana.</p>'}

                    <!-- Curva A -->
                    <h3 style="margin: 0 0 15px 0; color: #f8fafc; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; display: inline-block;">🔥 Curva A (Mais Vendido)</h3>
                    <table width="100%" cellpadding="15" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #0f172a; border-left: 4px solid #3b82f6; border-radius: 0 4px 4px 0; border-top: 1px solid #334155; border-right: 1px solid #334155; border-bottom: 1px solid #334155;">
                        <tr>
                            <td>
                                <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: bold; color: #f8fafc;">\${nomeProdutoDestaque}</p>
                                <p style="margin: 0; font-size: 13px; color: #94a3b8;">\${qtdeProdutoDestaque} unidades vendidas na semana</p>
                            </td>
                        </tr>
                    </table>

                    <!-- Rodapé Profissional -->
                    <div style="margin-top: 40px; text-align: center; border-top: 1px solid #334155; padding-top: 25px;">
                        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                            Relatório gerado automaticamente pelo sistema <strong>FRPlus - Inteligência Comercial</strong>.<br/>
                            Não é necessário responder a este e-mail.
                        </p>
                    </div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>\`;

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'cfantinibr@gmail.com',
            subject: \`[TESTE FINAL COM CLIENTES] Resumo Semanal FRPLUS\`,
            html: html
        };

        const result = await transporter.sendMail(mailOptions);
        console.log("E-mail enviado com sucesso:", result.messageId);
    } catch (error) {
        console.error("Erro ao enviar:", error);
    }
}

run();
