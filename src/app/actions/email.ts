'use server';

import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

export async function enviarPedidoPorEmail(pedidoId: string) {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error("As credenciais de e-mail (EMAIL_USER / EMAIL_PASS) não estão configuradas no servidor.");
        }

        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
                cliente: true,
                itens: {
                    include: {
                        produto: {
                            include: {
                                fabrica: true
                            }
                        }
                    }
                }
            }
        });

        if (!pedido) {
            throw new Error("Pedido não encontrado.");
        }

        if (!pedido.itens || pedido.itens.length === 0) {
            throw new Error("O pedido não possui itens.");
        }

        // Try to identify the 'Fabrica' (Representada) from the order's items
        // Wait, all items in an order usually belong to a single factory.
        // Let's get the factory from the first valid item
        const firstProductWithFactory = pedido.itens.find(item => item.produto && item.produto.fabrica);
        
        if (!firstProductWithFactory || !firstProductWithFactory.produto.fabrica) {
            throw new Error("Não foi possível identificar a Representada (Fábrica) atrelada aos produtos deste pedido.");
        }

        const fabrica = firstProductWithFactory.produto.fabrica;

        if (!fabrica.emailFaturamento) {
            throw new Error("Cadastre o e-mail da fábrica primeiro.");
        }

        // Set up Nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Format Date (DD/MM/YYYY only)
        const dataPedido = new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short'
        }).format(new Date(pedido.data));

        // Format Currency (R$ 0.00 right-aligned)
        const formatCurrency = (val: number) => 
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Build HTML Email Table Rows
        const itensHtml = pedido.itens.map(item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 13px;">${item.produto?.codigo || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.produto.nome}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${item.quantidade}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(Number(item.precoUnitario))}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(Number(item.total))}</td>
            </tr>
        `).join('');

        const endereco = pedido.cliente ? 
            `${pedido.cliente.endereco || '-'}, ${pedido.cliente.numero || 'S/N'}<br/>${pedido.cliente.bairro || '-'} - CEP: ${pedido.cliente.cep || '-'}<br/>${pedido.cliente.cidade || '-'} - ${pedido.cliente.estado || '-'}` 
            : 'Endereço Indisponível';

        const html = `
            <div style="max-width: 800px; margin: 0 auto; font-family: Arial, sans-serif; color: #333; border: 1px solid #ddd; padding: 20px;">
                
                <!-- HEADER (2 Columns) -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td width="50%" valign="top">
                            <!-- <img src="URL_DA_LOGO_AQUI" alt="Logo" style="max-height: 60px;"> -->
                            <h2 style="margin: 0; color: #1e40af; font-size: 24px;">${fabrica.nome}</h2>
                        </td>
                        <td width="50%" valign="top" style="text-align: right;">
                            <h3 style="margin: 0 0 5px 0; color: #333; font-size: 20px;">Pedido #${pedido.notaFiscal || pedido.id.slice(-6).toUpperCase()}</h3>
                            <p style="margin: 0; color: #666;"><strong>Data:</strong> ${dataPedido}</p>
                            <p style="margin: 5px 0 0 0; color: #666;"><strong>Tipo:</strong> ${pedido.tipo}</p>
                            <p style="margin: 0; color: #666;"><strong>Pagamento:</strong> ${pedido.condicaoPagamento || '-'}</p>
                        </td>
                    </tr>
                </table>

                <!-- CLIENT BLOCK (Gray Card) -->
                <div style="background-color: #f9f9f9; border: 1px solid #eee; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Dados do Cliente e Entrega</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                        <tr>
                            <td width="50%" valign="top" style="padding-right: 15px;">
                                <p style="margin: 0 0 5px 0;"><strong>Razão Social:</strong> ${pedido.cliente?.razaoSocial || '-'}</p>
                                <p style="margin: 0 0 5px 0;"><strong>Fantasia:</strong> ${pedido.cliente?.nomeFantasia || '-'}</p>
                                <p style="margin: 0 0 5px 0;"><strong>CNPJ/CPF:</strong> ${pedido.cliente?.cnpj || '-'}</p>
                                <p style="margin: 0 0 5px 0;"><strong>Telefone:</strong> ${pedido.cliente?.telefone || '-'}</p>
                            </td>
                            <td width="50%" valign="top" style="padding-left: 15px; border-left: 1px solid #ddd;">
                                <p style="margin: 0 0 5px 0;"><strong>Endereço de Entrega:</strong><br/>
                                ${endereco}
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>

                ${pedido.observacoes ? `
                <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 10px 15px; margin-top: 20px;">
                    <strong>Observações do Pedido:</strong><br/>
                    ${pedido.observacoes}
                </div>
                ` : ''}

                <!-- ITEMS TABLE (NF Style) -->
                <h3 style="margin-top: 30px; margin-bottom: 10px; color: #2563eb;">Produtos Solicitados</h3>
                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                    <thead>
                        <tr>
                            <th style="background-color: #2563eb; color: white; border: 1px solid #2563eb; text-align: left;">Cód.</th>
                            <th style="background-color: #2563eb; color: white; border: 1px solid #2563eb; text-align: left;">Produto</th>
                            <th style="background-color: #2563eb; color: white; border: 1px solid #2563eb; text-align: right;">Qtd.</th>
                            <th style="background-color: #2563eb; color: white; border: 1px solid #2563eb; text-align: right;">Val. Unit</th>
                            <th style="background-color: #2563eb; color: white; border: 1px solid #2563eb; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itensHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="padding: 15px 10px; text-align: right; font-size: 16px; color: #333;"><strong>VALOR TOTAL DO PEDIDO:</strong></td>
                            <td style="padding: 15px 10px; text-align: right; font-size: 18px; font-weight: bold; color: #16a34a;">
                                ${formatCurrency(Number(pedido.valorTotal))}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
                    Documento auxiliar de pedido gerado via <strong>Fantini Express</strong>.<br/>
                    Representada responsável pelo faturamento: ${fabrica.nome}
                </div>
            </div>
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: fabrica.emailFaturamento,
            subject: `Novo Pedido #${pedido.notaFiscal || pedido.id.slice(-6)} - Cliente: ${pedido.cliente?.nomeFantasia || pedido.cliente?.razaoSocial}`,
            html: html
        };

        const result = await transporter.sendMail(mailOptions);
        
        return { success: true, message: "E-mail enviado com sucesso!" };
        
    } catch (error: any) {
        console.error("Erro ao enviar e-mail:", error);
        return { success: false, error: error.message || "Falha ao enviar e-mail." };
    }
}
