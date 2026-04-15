import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFCustom extends jsPDF {
    lastAutoTable: { finalY: number };
}

async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        let finalUrl = url;
        if (url.startsWith('/') && typeof window !== 'undefined') {
            finalUrl = window.location.origin + url;
        }
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height });
            } else resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = finalUrl;
    });
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface PedidoHistorico {
    id: string;
    data: string;
    numeroPedido: string;
    volumeCaixas: number;
    valorFaturado: number;
    isBonificacao: boolean;
}

export interface PayloadHistoricoCompras {
    clienteNome: string;
    periodoInicio: string;
    periodoFim: string;
    pedidos: PedidoHistorico[];
    totais: {
        totalPedidos: number;
        volumeTotalCaixas: number;
        valorTotalFaturado: number;
    };
}

export async function gerarPdfHistoricoCompras(payload: PayloadHistoricoCompras) {
    try {
        console.log('[PDF Histórico Compras] Iniciando geração...', {
            cliente: payload.clienteNome,
            pedidos: payload.pedidos.length,
        });

        const doc = new jsPDF('p', 'mm', 'a4') as jsPDFCustom; // Portrait for 4 columns
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = { left: 14, right: 14 };
        const contentWidth = pageWidth - margin.left - margin.right;

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
            greenAccent: [16, 185, 129] as [number, number, number],
            orangeAccent: [249, 115, 22] as [number, number, number],
        };

        // Format period for display
        const formatDateBR = (isoStr: string) => {
            const d = new Date(isoStr);
            return d.toLocaleDateString('pt-BR');
        };
        const periodoLabel = `${formatDateBR(payload.periodoInicio)} — ${formatDateBR(payload.periodoFim)}`;

        // ====== HEADER ======
        const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
            const headerHeight = 38;

            // Dark background
            pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
            pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');

            // Accent bars at bottom of header
            pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
            pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
            pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

            // Title — right aligned
            pageDoc.setFontSize(13);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.setTextColor(255, 255, 255);
            pageDoc.text('HISTÓRICO DE COMPRAS', pageWidth - margin.right, 14, { align: 'right' });

            // Client name
            pageDoc.setFontSize(8);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            pageDoc.text(`Cliente: ${payload.clienteNome}`, pageWidth - margin.right, 20, { align: 'right' });

            // Period
            pageDoc.setFontSize(7);
            pageDoc.text(`Período: ${periodoLabel}`, pageWidth - margin.right, 25, { align: 'right' });

            // Emission date
            const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 30, { align: 'right' });

            if (pageNum > 1) {
                pageDoc.setFontSize(7);
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('(Continuação)', pageWidth - margin.right, 35, { align: 'right' });
            }

            return headerHeight + 5;
        };

        // ====== FOOTER ======
        const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
            const footerY = pageHeight - 12;

            // Separator line
            pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
            pageDoc.setLineWidth(0.3);
            pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

            pageDoc.setFontSize(7);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);

            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
        };

        // ====== LOGO ======
        const logoResult = await getBase64Image('/logo.png');

        let startY = drawHeader(doc, 1);

        if (logoResult) {
            try {
                const logoH = 19.5;
                const logoRatio = logoH / logoResult.height;
                const logoW = logoResult.width * logoRatio;
                doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
            } catch { /* silently fail */ }
        }

        startY += 2;

        // ====== MAIN TABLE ======
        // Dynamically adjust font size based on number of rows to fit on 1 page
        const rowCount = payload.pedidos.length;
        let fontSize = 8;
        let cellPadding = 3;

        if (rowCount > 25) {
            fontSize = 6;
            cellPadding = 1.5;
        } else if (rowCount > 18) {
            fontSize = 6.5;
            cellPadding = 2;
        } else if (rowCount > 12) {
            fontSize = 7;
            cellPadding = 2.5;
        }

        const tableBody = payload.pedidos.map((p) => [
            formatDateBR(p.data),
            p.isBonificacao ? `${p.numeroPedido}  [BONIFICAÇÃO]` : p.numeroPedido,
            p.isBonificacao ? `${p.volumeCaixas}` : `${p.volumeCaixas}`,
            p.isBonificacao ? 'R$ 0,00' : formatBRL(p.valorFaturado),
        ]);

        autoTable(doc, {
            startY,
            head: [['Data', 'Nº do Pedido', 'Vol. Faturado (CX)', 'Valor Faturado']],
            body: tableBody,
            theme: 'striped',
            styles: {
                fontSize,
                cellPadding,
                halign: 'center',
                valign: 'middle',
                lineColor: colors.tableBorder,
                lineWidth: 0.2,
                textColor: colors.textDark,
                overflow: 'ellipsize',
            },
            headStyles: {
                fillColor: colors.headerDark,
                textColor: 255,
                fontStyle: 'bold',
                cellPadding: 3,
                halign: 'center',
                fontSize: 7,
            },
            alternateRowStyles: { fillColor: colors.rowEven },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center', textColor: colors.textMuted },
                1: { cellWidth: 55, halign: 'center', fontStyle: 'bold', textColor: colors.textDark },
                2: { cellWidth: 35, halign: 'center', textColor: colors.textMuted },
                3: { halign: 'right', fontStyle: 'bold', textColor: colors.greenAccent },
            },
            margin: { left: margin.left, right: margin.right },
            didParseCell: (data: any) => {
                // Style bonificação rows with orange text
                if (data.section === 'body') {
                    const rowIndex = data.row.index;
                    const pedido = payload.pedidos[rowIndex];
                    if (pedido && pedido.isBonificacao) {
                        data.cell.styles.textColor = colors.orangeAccent;
                        data.cell.styles.fontStyle = 'italic';
                    }
                }
            },
            didDrawPage: (data: { pageNumber: number }) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc, data.pageNumber);
                    if (logoResult) {
                        try {
                            const logoH = 19.5;
                            const logoRatio = logoH / logoResult.height;
                            const logoW = logoResult.width * logoRatio;
                            doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
                        } catch { /* silently fail */ }
                    }
                }
            },
        });

        startY = doc.lastAutoTable.finalY + 6;

        // ====== RESUMO DO FECHAMENTO (BLACK BOX) ======
        // Page-break safety
        if (startY > pageHeight - 55) {
            doc.addPage();
            startY = drawHeader(doc, doc.getNumberOfPages());
            if (logoResult) {
                try {
                    const logoH = 19.5;
                    const logoRatio = logoH / logoResult.height;
                    const logoW = logoResult.width * logoRatio;
                    doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
                } catch { /* silently fail */ }
            }
            startY += 2;
        }

        const summaryBlockHeight = 38;

        // Background
        doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
        doc.roundedRect(margin.left, startY, contentWidth, summaryBlockHeight, 2, 2, 'F');

        // Blue title bar
        doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
        doc.rect(margin.left, startY, contentWidth, 10, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('RESUMO DO FECHAMENTO', margin.left + contentWidth / 2, startY + 7, { align: 'center' });

        // 3 Metrics in columns
        const metricStartY = startY + 15;
        const colWidth = contentWidth / 3;

        const drawMetric = (x: number, label: string, value: string, valueColor: [number, number, number]) => {
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text(label, x, metricStartY);

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            doc.text(value, x, metricStartY + 9);
        };

        const col1X = margin.left + 10;
        const col2X = margin.left + colWidth + 10;
        const col3X = margin.left + colWidth * 2 + 10;

        drawMetric(col1X, 'TOTAL DE PEDIDOS', `${payload.totais.totalPedidos}`, colors.white);
        drawMetric(col2X, 'VOLUME REAL FATURADO (CX)', `${payload.totais.volumeTotalCaixas}`, colors.accentCyan);
        drawMetric(col3X, 'INVESTIMENTO TOTAL', formatBRL(payload.totais.valorTotalFaturado), colors.greenAccent);

        // ====== DRAW FOOTERS ON ALL PAGES ======
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            drawFooter(doc, i, pageCount);
        }

        // ====== SAVE ======
        const clienteClean = payload.clienteNome.replace(/[^a-zA-Z0-9À-ú ]/g, '').replace(/\s+/g, '_').slice(0, 30);
        const dataClean = new Date().toISOString().split('T')[0];
        doc.save(`Historico_Compras_${clienteClean}_${dataClean}.pdf`);

        console.log('[PDF Histórico Compras] Gerado com sucesso.');

    } catch (error) {
        console.error('[PDF Histórico Compras] ERRO FATAL:', error);
        throw error;
    }
}
