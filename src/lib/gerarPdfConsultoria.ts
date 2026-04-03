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

export interface PayloadConsultoria {
    fabrica: string;
    perfil: string;
    bonusPorcentagem: number;
    data: string;
    itensPagos: Array<{
        nome: string;
        codigo: string;
        unidade: string;
        precoUnitario: number;
        quantidade: number;
        subtotal: number;
        coberturaDias: number;
        lucroEstimado?: number;
    }>;
    itemBonificado: {
        nome: string;
        unidade: string;
        quantidade: number;
    } | null;
    totalPedido: number;
    verbaGerada: number;
    lucroImediato: number;
    lucroEstimadoRevenda?: number;
    clienteNovo?: string;
    comprador?: string;
}

export async function gerarPdfConsultoria(payload: PayloadConsultoria) {
    try {
        console.log('[PDF Consultoria] Iniciando geração...', {
            fabrica: payload.fabrica, perfil: payload.perfil,
            itens: payload.itensPagos.length, temBonificado: !!payload.itemBonificado,
        });

        const doc = new jsPDF('p', 'mm', 'a4') as jsPDFCustom;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = { left: 14, right: 14 };

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
        };

        const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
            const headerHeight = 38;
            const extraHeader = (payload.clienteNovo ? 5 : 0) + (payload.comprador ? 5 : 0);

            pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
            pageDoc.rect(0, 0, pageWidth, headerHeight + extraHeader, 'F');

            pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            pageDoc.rect(0, headerHeight + extraHeader, pageWidth, 1.5, 'F');
            pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
            pageDoc.rect(pageWidth * 0.4, headerHeight + extraHeader, pageWidth * 0.6, 1.5, 'F');

            // Title
            pageDoc.setFontSize(13);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.setTextColor(255, 255, 255);
            pageDoc.text("CONSULTORIA DE PRIMEIRO PEDIDO", pageWidth - margin.right, 14, { align: 'right' });

            // Date
            pageDoc.setFontSize(7);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

            // Metadata
            let currentHeaderY = 25;
            if (payload.clienteNovo) {
                pageDoc.text(`Cliente: ${payload.clienteNovo}`, pageWidth - margin.right, currentHeaderY, { align: 'right' });
                currentHeaderY += 5;
            }
            if (payload.comprador) {
                pageDoc.text(`A/C: ${payload.comprador}`, pageWidth - margin.right, currentHeaderY, { align: 'right' });
            }

            if (pageNum > 1) {
                pageDoc.setFontSize(7);
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text(`(Continuação)`, pageWidth - margin.right, currentHeaderY + 5, { align: 'right' });
            }

            return headerHeight + extraHeader + 5;
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
            pageDoc.text('Documento confidencial • Preços sujeitos a alteração sem aviso prévio', pageWidth / 2, footerY, { align: 'center' });

            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
        };

        const logoResult = await getBase64Image('/logo.png');

        let startY = drawHeader(doc, 1);

        if (logoResult) {
            try {
                const logoH = 19.5; 
                const logoRatio = logoH / logoResult.height;
                const logoW = logoResult.width * logoRatio;
                doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
            } catch (logoErr) {}
        }

        startY += 2;

        const tableBody = payload.itensPagos.map((item) => [
            `${item.nome} (${item.unidade})`,
            `${item.quantidade}`,
            formatBRL(item.precoUnitario),
            formatBRL(item.subtotal),
            item.coberturaDias > 0 ? `${item.coberturaDias} dias` : 'S/ Ref.',
            item.lucroEstimado ? formatBRL(item.lucroEstimado) : '-',
        ]);

        if (payload.itemBonificado && payload.itemBonificado.quantidade > 0) {
            tableBody.push([
                payload.itemBonificado.nome,
                `${payload.itemBonificado.quantidade}`,
                'R$ 0,00',
                'R$ 0,00',
                'Verba Inteira',
                '-'
            ]);
        }

        autoTable(doc, {
            startY,
            head: [['Produto', 'Quantidade', 'Preço Unitário', 'Total Item', 'Cobertura', 'Lucro Previsto']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 3, halign: 'left', lineColor: colors.tableBorder, lineWidth: 0.2 },
            headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4, halign: 'left' },
            alternateRowStyles: { fillColor: colors.rowEven },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: colors.textDark, cellWidth: 'auto' },
                1: { halign: 'center', textColor: colors.textMuted },
                2: { halign: 'right', textColor: colors.textMuted },
                3: { halign: 'right', fontStyle: 'bold', textColor: colors.textDark },
                4: { halign: 'center', textColor: colors.textMuted },
                5: { halign: 'right', textColor: colors.greenAccent }
            },
            margin: { left: margin.left, right: margin.right },
            didDrawPage: (data: { pageNumber: number }) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc, data.pageNumber);
                    if (logoResult) {
                        try {
                            const logoH = 19.5; 
                            const logoRatio = logoH / logoResult.height;
                            const logoW = logoResult.width * logoRatio;
                            doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
                        } catch (logoErr) {}
                    }
                }
            },
            didParseCell: (data: any) => {
                if (payload.itemBonificado && data.row.index === tableBody.length - 1 && data.section === 'body') {
                    data.cell.styles.textColor = colors.greenAccent;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        startY = doc.lastAutoTable.finalY + 15;

        // Financial Summary Block
        if (startY > pageHeight - 50) {
            doc.addPage();
            startY = drawHeader(doc, doc.getNumberOfPages());
        }

        doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
        doc.roundedRect(margin.left, startY, pageWidth - margin.left - margin.right, 30, 1.5, 1.5, 'F');
        doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
        doc.rect(margin.left, startY, 3, 30, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        
        let blockY = startY + 8;
        doc.text("Investimento Total:", margin.left + 8, blockY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(formatBRL(payload.totalPedido), margin.left + 45, blockY);

        blockY += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        doc.text("Lucro Estimado Total:", margin.left + 8, blockY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
        const lucroTotal = payload.lucroEstimadoRevenda || 0;
        doc.text(formatBRL(lucroTotal), margin.left + 48, blockY);

        blockY += 7;
        if (payload.verbaGerada > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text("Verba Gerada:", margin.left + 8, blockY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            doc.text(formatBRL(payload.verbaGerada), margin.left + 35, blockY);
        }

        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            drawFooter(doc, i, pageCount);
        }

        const dataClean = payload.data.replace(/\//g, '-');
        const fabricaClean = payload.fabrica.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Consultoria_Primeiro_Pedido_${fabricaClean}_${dataClean}.pdf`);

        console.log('[PDF Consultoria] Gerado com sucesso.');

    } catch (error) {
        console.error('[PDF Consultoria] ERRO FATAL:', error);
        throw error;
    }
}
