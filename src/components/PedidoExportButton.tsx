'use client';

import { useState, useCallback, useEffect } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Order } from '@/contexts/DataContext';

interface PedidoExportButtonProps {
    order: Order;
}

export function PedidoExportButton({ order }: PedidoExportButtonProps) {
    const { clients, showToast } = useData();
    const [loadingPDF, setLoadingPDF] = useState(false);
    const [vendedorNome, setVendedorNome] = useState<string>('Não informado');

    // Tentar buscar o nome do vendedor se o cliente tiver vendedorId
    useEffect(() => {
        const fetchVendedor = async () => {
            const cliente = clients.find(c => c.id === order.clienteId);
            if (cliente?.vendedorId) {
                try {
                    const res = await fetch('/api/vendedores?ativo=true');
                    if (res.ok) {
                        const vendedores = await res.json();
                        const v = vendedores.find((v: any) => v.id === cliente.vendedorId);
                        if (v) {
                            setVendedorNome(v.nome);
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        };
        fetchVendedor();
    }, [order.clienteId, clients]);

    const handleGerarPDF = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadingPDF(true);

        try {
            const cliente = clients.find(c => c.id === order.clienteId);
            
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;

            // PREMIUM COLOR PALETTE
            const colors = {
                headerDark: [10, 10, 14] as [number, number, number],
                accentBlue: [37, 99, 235] as [number, number, number],
                accentCyan: [6, 182, 212] as [number, number, number],
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
                textLight: [200, 200, 220] as [number, number, number],
                white: [255, 255, 255] as [number, number, number],
                rowEven: [250, 251, 254] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                factoryBg: [235, 238, 248] as [number, number, number],
            };

            const loadLogo = (): Promise<{ data: string; width: number; height: number } | null> => {
                return new Promise((resolve) => {
                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    logoImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(logoImg, 0, 0);
                        resolve({ data: canvas.toDataURL('image/png'), width: logoImg.width, height: logoImg.height });
                    };
                    logoImg.onerror = () => resolve(null);
                    logoImg.src = '/logo.png';
                });
            };

            const logoResult = await loadLogo();
            const logoData = logoResult?.data || null;

            const dataPedidoReal = order.dataPedido || order.data || order.createdAt;
            const dataEmissao = dataPedidoReal ? new Date(dataPedidoReal).toLocaleDateString('pt-BR') : 'Sem data';
            const pedidoNumero = order.id.slice(-6).toUpperCase();

            // HEADER
            const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
                const headerHeight = 38;
                pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');
                pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
                pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
                pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

                if (logoData) {
                    try {
                        const logoH = 19.5;
                        let logoW = 19.5;
                        if (logoResult) {
                            const aspect = logoResult.width / logoResult.height;
                            logoW = logoH * aspect;
                        }
                        pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
                    } catch { /* ignore */ }
                }

                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text(`PEDIDO DE VENDA #${pedidoNumero}`, pageWidth - margin.right, 14, { align: 'right' });

                pageDoc.setFontSize(8);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                pageDoc.text(`Emissão: ${dataEmissao}`, pageWidth - margin.right, 20, { align: 'right' });
                pageDoc.text(`Vendedor(a): ${vendedorNome}`, pageWidth - margin.right, 25, { align: 'right' });

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text('(Continuação)', pageWidth - margin.right, 30, { align: 'right' });
                }

                return headerHeight + 5;
            };

            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;
                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento gerado eletronicamente', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`Página ${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            let startY = drawHeader(doc, 1);

            // DADOS DO CLIENTE
            startY += 2;
            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 22, 1.5, 1.5, 'F');
            doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            doc.setLineWidth(1);
            doc.line(margin.left, startY + 2, margin.left, startY + 20);

            doc.setFontSize(7);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('DADOS DO CLIENTE', margin.left + 5, startY + 6);
            
            doc.setFontSize(10);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            const razaoSocial = cliente?.razaoSocial || order.nomeCliente || 'Cliente não encontrado';
            doc.text(razaoSocial, margin.left + 5, startY + 11);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const cnpjFormatado = cliente?.cnpj ? cliente.cnpj : 'Não informado';
            
            let enderecoCompleto = 'Endereço não informado';
            if (cliente && cliente.endereco) {
                enderecoCompleto = `${cliente.endereco}`;
                if (cliente.numero) enderecoCompleto += `, ${cliente.numero}`;
                if (cliente.bairro) enderecoCompleto += ` - ${cliente.bairro}`;
                if (cliente.cidade) enderecoCompleto += ` - ${cliente.cidade}`;
                if (cliente.estado) enderecoCompleto += `/${cliente.estado}`;
                if (cliente.cep) enderecoCompleto += ` - CEP: ${cliente.cep}`;
            }

            doc.text(`CNPJ: ${cnpjFormatado}`, margin.left + 5, startY + 15.5);
            doc.text(`${enderecoCompleto}`, margin.left + 5, startY + 19.5);

            startY += 28;

            // TABELA DE ITENS
            const tableData = order.itens.map((item, index) => [
                String(index + 1).padStart(2, '0'),
                item.nomeProduto,
                String(item.quantidade),
                item.unidade || 'UN',
                `R$ ${Number(item.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `R$ ${Number(item.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY,
                head: [['#', 'PRODUTO', 'QTD', 'UNID', 'PREÇO UNIT.', 'TOTAL ITEM']],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2, textColor: colors.textDark },
                headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
                    1: { halign: 'left' },
                    2: { cellWidth: 15, halign: 'center', fontStyle: 'bold', textColor: colors.accentBlue },
                    3: { cellWidth: 15, halign: 'center', textColor: colors.textMuted },
                    4: { cellWidth: 28, halign: 'right' },
                    5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] as [number, number, number] }, // emerald-500
                },
                margin: { top: 30, bottom: 20, left: margin.left, right: margin.right },
                didDrawPage: (data: { pageNumber: number }) => {
                    if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                }
            });

            // TOTAIS E OBSERVAÇÕES
            let finalY = (doc as any).lastAutoTable.finalY + 6;

            // Calcular volumes, bruto e desconto
            const totalVolumes = order.itens.reduce((acc, item) => acc + Number(item.quantidade), 0);
            const valorBruto = order.itens.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
            const desconto = valorBruto - Number(order.valorTotal);
            const temDesconto = desconto > 0.01;

            const totalsWidth = 70;
            const totalsX = pageWidth - margin.right - totalsWidth;
            
            // Container Totals (altura ajustada para acomodar linha de volumes)
            doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
            doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
            doc.setLineWidth(0.3);
            doc.roundedRect(totalsX, finalY, totalsWidth, temDesconto ? 34 : 28, 1.5, 1.5, 'FD');

            doc.setFontSize(8);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            
            // Simulando flexDirection: 'column' com espaçamento vertical correto
            let currentY = finalY + 7;

            // Linha 1: Total de Volumes
            doc.setFont('helvetica', 'normal');
            doc.text('Total de Volumes:', totalsX + 5, currentY);
            doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`${totalVolumes}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });

            currentY += 6;
            
            if (temDesconto) {
                // Linha 2: Valor Bruto
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text('Valor Bruto:', totalsX + 5, currentY);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.text(`R$ ${valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
                
                // Linha 3: Desconto
                currentY += 6;
                doc.setFontSize(8);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text('Desconto:', totalsX + 5, currentY);
                doc.setTextColor(239, 68, 68); // Red
                doc.text(`- R$ ${desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
                
                // Espaço extra antes do total
                currentY += 9;
            } else {
                // Linha 2: Valor Bruto
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text('Valor Bruto:', totalsX + 5, currentY);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.text(`R$ ${valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
                
                // Espaço extra antes do total
                currentY += 9;
            }

            // Linha Final: VALOR TOTAL (em negrito e verde)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('VALOR TOTAL:', totalsX + 5, currentY);
            doc.setTextColor(16, 185, 129); // Emerald
            doc.text(`R$ ${Number(order.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });


            // Observações
            if (order.observacoes) {
                doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
                const obsLines = doc.splitTextToSize(`Observações: ${order.observacoes}`, totalsX - margin.left - 10);
                const obsHeight = Math.max(14, obsLines.length * 4 + 6);
                doc.roundedRect(margin.left, finalY, totalsX - margin.left - 5, obsHeight, 1.5, 1.5, 'F');
                
                doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.setLineWidth(1);
                doc.line(margin.left, finalY + 2, margin.left, finalY + obsHeight - 2);

                doc.setFontSize(8);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(obsLines, margin.left + 4, finalY + 6);
            }

            // Aplicar Footer a todas as páginas
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            // Salvar e Toast
            const clienteNomeClean = (order.nomeCliente || 'Cliente').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            const nomeArquivo = `Pedido_${pedidoNumero}_${clienteNomeClean}.pdf`;
            doc.save(nomeArquivo);
            showToast(`PDF "${nomeArquivo}" exportado com sucesso!`, "success");

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showToast("Erro ao gerar o PDF. Tente novamente.", "error");
        } finally {
            setLoadingPDF(false);
        }
    };

    return (
        <button
            onClick={handleGerarPDF}
            disabled={loadingPDF}
            className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
            title="Exportar Pedido em PDF"
        >
            {loadingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Exportar PDF</span>
        </button>
    );
}
