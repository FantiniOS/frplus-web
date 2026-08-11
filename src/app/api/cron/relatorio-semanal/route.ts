import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        const startOfPeriod = new Date(now);
        startOfPeriod.setDate(startOfPeriod.getDate() - 7);

        // Pedidos do Mês (Total Faturado no Mês)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const aggregateMes = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            where: {
                data: { gte: startOfMonth, lte: now },
                status: { not: 'Cancelado' }
            }
        });
        const totalFaturadoMes = aggregateMes._sum.valorTotal ? Number(aggregateMes._sum.valorTotal) : 0;

        // 1. Pedidos (Total Faturado e Quantidade)
        const aggregatePedidos = await prisma.pedido.aggregate({
            _sum: { valorTotal: true },
            _count: { id: true },
            where: {
                data: { gte: startOfPeriod, lte: now },
                status: { not: 'Cancelado' }
            }
        });

        const totalFaturado = aggregatePedidos._sum.valorTotal ? Number(aggregatePedidos._sum.valorTotal) : 0;
        const qtdePedidos = aggregatePedidos._count.id;
        const ticketMedio = qtdePedidos > 0 ? totalFaturado / qtdePedidos : 0;

        // 2. Produto Mais Vendido (Curva A)
        const itensGroup = await prisma.itemPedido.groupBy({
            by: ['produtoId'],
            _sum: { quantidade: true },
            where: {
                pedido: {
                    data: { gte: startOfPeriod, lte: now },
                    status: { not: 'Cancelado' }
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

        // 3. Top 3 Clientes
        const clientesGroup = await prisma.pedido.groupBy({
            by: ['clienteId'],
            _sum: { valorTotal: true },
            where: {
                data: { gte: startOfPeriod, lte: now },
                status: { not: 'Cancelado' }
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

        const formatDate = (date: Date) => 
            new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://frplus-web.vercel.app';

        // HTML Mini-Dashboard (Dark Theme, Table-based)
        const html = `<!DOCTYPE html>
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
                        <img src="${baseUrl}/logo.png" alt="FRPlus Logo" style="max-height: 50px; margin-bottom: 20px; display: inline-block;" />
                        <h2 style="margin: 0; color: #f8fafc; font-size: 24px; font-weight: normal;">Resumo Semanal <span style="color: #3b82f6;">FRPlus</span></h2>
                        <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">Apuração: ${formatDate(startOfPeriod)} a ${formatDate(now)}</p>
                    </div>

                    <!-- Caixas de Destaque (Tabela Segura) -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                        <tr>
                            <!-- Faturamento -->
                            <td width="32%" valign="top">
                                <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Faturamento</p>
                                            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; color: #3b82f6;">${formatCurrency(totalFaturado)}</p>
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
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Pedidos</p>
                                            <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: bold; color: #f8fafc;">${qtdePedidos}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td width="2%">&nbsp;</td> <!-- Espacador -->
                            <!-- Ticket Medio -->
                            <td width="32%" valign="top">
                                <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Ticket Médio</p>
                                            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; color: #f8fafc;">${formatCurrency(ticketMedio)}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- Top Clientes -->
                    <h3 style="margin: 0 0 15px 0; color: #f8fafc; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; display: inline-block;">🏆 Top 3 Clientes</h3>
                    ${topClientes.length > 0 ? `
                        <table width="100%" cellpadding="12" cellspacing="0" border="0" style="margin-bottom: 30px; border-collapse: collapse; background-color: #0f172a; border-radius: 6px; overflow: hidden; border: 1px solid #334155;">
                            ${topClientes.map((c, i) => `
                                <tr>
                                    <td style="border-bottom: ${i === topClientes.length - 1 ? 'none' : '1px solid #334155'}; color: #cbd5e1; font-size: 14px;">
                                        <strong style="color: #3b82f6;">#${i + 1}</strong> &nbsp;${c.nome}
                                    </td>
                                    <td style="border-bottom: ${i === topClientes.length - 1 ? 'none' : '1px solid #334155'}; text-align: right; color: #f8fafc; font-weight: bold; font-size: 14px;">
                                        ${formatCurrency(c.valor)}
                                    </td>
                                </tr>
                            `).join('')}
                        </table>
                    ` : '<p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px;">Nenhum pedido no período.</p>'}

                    <!-- Curva A -->
                    <h3 style="margin: 0 0 15px 0; color: #f8fafc; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; display: inline-block;">🔥 Curva A (Produto Mais Vendido)</h3>
                    <table width="100%" cellpadding="15" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #0f172a; border-left: 4px solid #3b82f6; border-radius: 0 4px 4px 0; border-top: 1px solid #334155; border-right: 1px solid #334155; border-bottom: 1px solid #334155;">
                        <tr>
                            <td>
                                <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: bold; color: #f8fafc;">${nomeProdutoDestaque}</p>
                                <p style="margin: 0; font-size: 13px; color: #94a3b8;">${qtdeProdutoDestaque} unidades vendidas na semana</p>
                            </td>
                        </tr>
                    </table>

                    <!-- Acumulado do Mês -->
                    <table width="100%" cellpadding="15" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155; text-align: center;">
                        <tr>
                            <td>
                                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Acumulado no Mês Atual</p>
                                <p style="margin: 8px 0 0 0; font-size: 20px; font-weight: bold; color: #f8fafc;">${formatCurrency(totalFaturadoMes)}</p>
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
</html>`;

        const emailsListStr = process.env.EMAILS_RELATORIO_SEMANAL || 'fantinirepresentacoes@gmail.com,pedidosbelmont@gmail.com';
        const emailsArray = emailsListStr.split(',').map(e => e.trim()).filter(e => e);

        if (emailsArray.length === 0) {
            console.log("Nenhum e-mail configurado em EMAILS_RELATORIO_SEMANAL.");
            return NextResponse.json({ success: true, message: 'Nenhum destinatário configurado.' });
        }

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
            to: emailsArray,
            subject: `Resumo Semanal FRPLUS (${formatDate(startOfPeriod)} a ${formatDate(now)})`,
            html: html
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'Relatório enviado com sucesso!' });
        
    } catch (error: any) {
        console.error("Erro ao enviar relatório semanal:", error);
        return NextResponse.json({ error: error.message || 'Falha ao processar relatório.' }, { status: 500 });
    }
}
