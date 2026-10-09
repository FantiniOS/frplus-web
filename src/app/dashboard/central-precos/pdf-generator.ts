import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PrecoPDFData {
    registros: any[];
    filtros: {
        busca: string;
        marca: string;
        coletor: string;
    };
    stats: {
        total: number;
        ultimos7: number;
        menorPreco: number;
        menorLocal: string;
    };
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

export async function generateCentralPrecosPDF(data: PrecoPDFData) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = { left: 14, right: 14 };
    const contentWidth = pageWidth - margin.left - margin.right;

    // ====== PREMIUM COLOR PALETTE ======
    const colors = {
        headerDark: [10, 10, 14] as [number, number, number],
        headerMid: [18, 18, 26] as [number, number, number],
        accentBlue: [37, 99, 235] as [number, number, number],
        accentCyan: [6, 182, 212] as [number, number, number],
        accentGold: [245, 158, 11] as [number, number, number],
        textDark: [20, 20, 30] as [number, number, number],
        textMuted: [120, 120, 140] as [number, number, number],
        textLight: [200, 200, 220] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        rowEven: [250, 251, 254] as [number, number, number],
        rowOdd: [255, 255, 255] as [number, number, number],
        factoryBg: [235, 238, 248] as [number, number, number],
        factoryAccent: [30, 64, 175] as [number, number, number],
        greenAccent: [16, 185, 129] as [number, number, number],
        purpleAccent: [124, 58, 237] as [number, number, number],
        tableBorder: [226, 232, 240] as [number, number, number],
    };

    // ====== LOGO LOADER ======
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
            let url = '/logo.png';
            if (url.startsWith('/')) {
                url = window.location.origin + url;
            }
            logoImg.src = url;
        });
    };

    const logoResult = await loadLogo();
    const logoData = logoResult?.data || null;

    // ====== DRAW PREMIUM HEADER ======
    const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
        const headerHeight = 38;

        // Dark gradient header background
        pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
        pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');

        // Subtle gradient band at bottom of header
        pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
        pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
        // Cyan accent fade
        pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
        pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

        // Logo
        if (logoData) {
            try {
                const logoH = 19.5;
                let logoW = 19.5;
                if (logoResult) {
                    const aspect = logoResult.width / logoResult.height;
                    logoW = logoH * aspect;
                }
                pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
            } catch { /* ignore logo errors */ }
        }

        // Report title
        pageDoc.setFontSize(13);
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setTextColor(255, 255, 255);
        pageDoc.text('Relatório da Central de Preços', pageWidth - margin.right, 14, { align: 'right' });

        // Date & meta info
        pageDoc.setFontSize(7);
        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

        if (pageNum > 1) {
            pageDoc.setFontSize(7);
            pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            pageDoc.text(`(Continuação)`, pageWidth - margin.right, 25, { align: 'right' });
        }

        return headerHeight + 5;
    };

    // ====== DRAW PREMIUM FOOTER ======
    const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 12;

        pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
        pageDoc.setLineWidth(0.3);
        pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

        pageDoc.setFontSize(7);
        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
        pageDoc.text('Documento confidencial • Central de Preços', pageWidth / 2, footerY, { align: 'center' });

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
    };

    // ====== HELPER: Draw KPI Card ======
    const drawKpiCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number], subvalue?: string) => {
        doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
        doc.roundedRect(x, y, w, h, 2, 2, 'F');

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y, 2.5, h, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        doc.text(label.toUpperCase(), x + 6, y + 6);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
        doc.text(value, x + 6, y + 13);
        
        if (subvalue) {
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.accentGold[0], colors.accentGold[1], colors.accentGold[2]);
            const splitSubvalue = doc.splitTextToSize(subvalue, w - 10);
            doc.text(splitSubvalue, x + 6, y + 17);
        }
    };

    let startY = drawHeader(doc, 1);

    // ---- KPI SUMMARY CARDS ----
    startY += 2;
    const gap = 4;
    const cardW = (contentWidth - gap * 2) / 3;
    const cardH = 22; // Slightly taller to fit subvalue

    drawKpiCard(margin.left, startY, cardW, cardH, 'Total de Coletas',
        `${data.stats.total}`,
        colors.accentBlue);
        
    drawKpiCard(margin.left + cardW + gap, startY, cardW, cardH, 'Últimos 7 dias',
        `${data.stats.ultimos7}`,
        colors.greenAccent);
        
    drawKpiCard(margin.left + (cardW + gap) * 2, startY, cardW, cardH, 'Menor Preço',
        data.stats.menorPreco ? formatCurrency(data.stats.menorPreco) : '-',
        colors.accentGold,
        data.stats.menorLocal ? `em ${data.stats.menorLocal}` : '');

    startY += cardH + 6;

    // Subtitle badge for Filters info
    doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
    doc.roundedRect(margin.left, startY, contentWidth, 9, 1.5, 1.5, 'F');
    doc.setFontSize(8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.factoryAccent[0], colors.factoryAccent[1], colors.factoryAccent[2]);
    
    const filtrosAtivos = [];
    if (data.filtros.busca) filtrosAtivos.push(`Busca: ${data.filtros.busca}`);
    if (data.filtros.marca) filtrosAtivos.push(`Marca: ${data.filtros.marca}`);
    if (data.filtros.coletor) filtrosAtivos.push(`Coletor: ${data.filtros.coletor}`);
    
    const filtrosStr = filtrosAtivos.length > 0 ? filtrosAtivos.join('  |  ') : 'Nenhum filtro aplicado';
    doc.text(`Filtros: ${filtrosStr}`, margin.left + 5, startY + 6);
    
    startY += 12;

    // ---- TABLE DATA ----
    autoTable(doc, {
        startY,
        head: [['Data', 'Cliente', 'Produto Base', 'Concorrente', 'Preço', 'Coletor']],
        body: data.registros.map(d => [
            formatDate(d.dataColeta),
            d.cliente ? (d.cliente.nomeFantasia || d.cliente.razaoSocial) : '-',
            d.produtoBase,
            d.marcaConcorrente?.nome || '',
            d.precoPrateleira ? formatCurrency(d.precoPrateleira) : '-',
            d.vendedor ? d.vendedor.nome : 'Admin'
        ]),
        styles: { fontSize: 8, cellPadding: 3, halign: 'left', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2 },
        headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4, halign: 'center' },
        alternateRowStyles: { fillColor: colors.rowEven },
        columnStyles: {
            0: { halign: 'center', cellWidth: 20 },
            1: { halign: 'left', cellWidth: 40 },
            2: { halign: 'left', cellWidth: 40 },
            3: { halign: 'left' },
            4: { halign: 'right', fontStyle: 'bold', textColor: colors.accentBlue },
            5: { halign: 'center' }
        },
        margin: { top: startY, left: margin.left, right: margin.right },
        didDrawPage: (dataObj: { pageNumber: number }) => {
            if (dataObj.pageNumber > 1) drawHeader(doc, dataObj.pageNumber);
        }
    });

    // FOOTERS
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        drawFooter(doc, i, pages);
    }

    doc.save(`central-precos-${new Date().getTime()}.pdf`);
}
