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
        precoUnitario: number;  // Custo NF (preço seco de fábrica)
        custoReal: number;      // Custo NF + imposto
        quantidade: number;
        subtotal: number;
        sugestaoRevenda: number;
        margemPercent: number;
        lucroProjetado: number;
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
    // B2B Fields
    percentualImposto: number;
    custoMedioCargaSemVerba: number;
    custoMedioCargaComVerba: number;
    totalCaixasPagas: number;
    totalCaixasBonificadas: number;
    investimentoBruto: number;
    impostoEstimado: number;
    faturamentoPonta: number;
    lucroLiquidoEsperado: number;
}

export async function gerarPdfConsultoria(payload: PayloadConsultoria) {
    try {
        console.log('[PDF Consultoria B2B] Iniciando geração...', {
            fabrica: payload.fabrica, perfil: payload.perfil,
            itens: payload.itensPagos.length, temBonificado: !!payload.itemBonificado,
        });

        const doc = new jsPDF('l', 'mm', 'a4') as jsPDFCustom; // Landscape for 7 columns
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = { left: 12, right: 12 };

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
            redAccent: [239, 68, 68] as [number, number, number],
        };

        const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
            const headerHeight = 34;
            const extraHeader = (payload.clienteNovo ? 5 : 0) + (payload.comprador ? 5 : 0);

            pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
            pageDoc.rect(0, 0, pageWidth, headerHeight + extraHeader, 'F');

            pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            pageDoc.rect(0, headerHeight + extraHeader, pageWidth, 1.5, 'F');
            pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
            pageDoc.rect(pageWidth * 0.4, headerHeight + extraHeader, pageWidth * 0.6, 1.5, 'F');

            // Title
            pageDoc.setFontSize(12);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.setTextColor(255, 255, 255);
            pageDoc.text("CONSULTORIA COMERCIAL — PRIMEIRO PEDIDO", pageWidth - margin.right, 13, { align: 'right' });

            // Subtitle with factory and profile
            pageDoc.setFontSize(8);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            pageDoc.text(`${payload.fabrica} | Perfil: ${payload.perfil} | Imposto: ${payload.percentualImposto}%`, pageWidth - margin.right, 19, { align: 'right' });

            // Date
            pageDoc.setFontSize(7);
            const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 24, { align: 'right' });

            // Metadata
            let currentHeaderY = 28;
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

            return headerHeight + extraHeader + 4;
        };

        const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
            const footerY = pageHeight - 10;

            pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
            pageDoc.setLineWidth(0.3);
            pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

            pageDoc.setFontSize(6.5);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
            pageDoc.text(`Valores estimados. Imposto de ${payload.percentualImposto}% (ICMS SP→MG) sobre Custo NF. Preços sujeitos a alteração.`, pageWidth / 2, footerY, { align: 'center' });

            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
        };

        const logoResult = await getBase64Image('/logo.png');

        let startY = drawHeader(doc, 1);

        if (logoResult) {
            try {
                const logoH = 17;
                const logoRatio = logoH / logoResult.height;
                const logoW = logoResult.width * logoRatio;
                doc.addImage(logoResult.data, 'PNG', margin.left, 5, logoW, logoH);
            } catch (logoErr) { /* silently fail */ }
        }

        startY += 2;

        // === TABELA PRINCIPAL — 7 COLUNAS ===
        const tableBody = payload.itensPagos.map((item) => [
            `${item.nome}`,
            `${item.quantidade}`,
            formatBRL(item.precoUnitario),
            formatBRL(item.custoReal),
            formatBRL(item.sugestaoRevenda),
            `${item.margemPercent.toFixed(0)}%`,
            formatBRL(item.lucroProjetado),
        ]);

        autoTable(doc, {
            startY,
            head: [['Produto', 'Vol. (CX)', 'Custo NF', 'Custo Real', 'Sug. Revenda', 'Margem', 'Lucro Projetado']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'left', lineColor: colors.tableBorder, lineWidth: 0.2 },
            headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 3.5, halign: 'left', fontSize: 7 },
            alternateRowStyles: { fillColor: colors.rowEven },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: colors.textDark, cellWidth: 'auto' },
                1: { halign: 'center', textColor: colors.textMuted, cellWidth: 22 },
                2: { halign: 'right', textColor: colors.textMuted, cellWidth: 30 },
                3: { halign: 'right', textColor: colors.orangeAccent, fontStyle: 'bold', cellWidth: 30 },
                4: { halign: 'right', textColor: colors.accentBlue, fontStyle: 'bold', cellWidth: 30 },
                5: { halign: 'center', textColor: colors.textMuted, cellWidth: 20 },
                6: { halign: 'right', textColor: colors.greenAccent, fontStyle: 'bold', cellWidth: 32 }
            },
            margin: { left: margin.left, right: margin.right },
            didDrawPage: (data: { pageNumber: number }) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc, data.pageNumber);
                    if (logoResult) {
                        try {
                            const logoH = 17;
                            const logoRatio = logoH / logoResult.height;
                            const logoW = logoResult.width * logoRatio;
                            doc.addImage(logoResult.data, 'PNG', margin.left, 5, logoW, logoH);
                        } catch (logoErr) { /* silently fail */ }
                    }
                }
            },
        });

        startY = doc.lastAutoTable.finalY + 10;

        // === SEÇÃO "EFEITO DA VERBA" (DILUIÇÃO DE BONIFICAÇÃO) ===
        if (payload.itemBonificado && payload.itemBonificado.quantidade > 0) {
            if (startY > pageHeight - 55) {
                doc.addPage();
                startY = drawHeader(doc, doc.getNumberOfPages());
                if (logoResult) {
                    try {
                        const logoH = 17;
                        const logoRatio = logoH / logoResult.height;
                        const logoW = logoResult.width * logoRatio;
                        doc.addImage(logoResult.data, 'PNG', margin.left, 5, logoW, logoH);
                    } catch { /* silently fail */ }
                }
                startY += 2;
            }

            const verbaBlockWidth = pageWidth - margin.left - margin.right;
            const verbaBlockHeight = 38;

            // Background
            doc.setFillColor(6, 78, 59); // emerald-900
            doc.roundedRect(margin.left, startY, verbaBlockWidth, verbaBlockHeight, 2, 2, 'F');

            // Left accent bar
            doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            doc.rect(margin.left, startY, 3, verbaBlockHeight, 'F');

            // Title
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            doc.text('EFEITO DA VERBA — INTELIGÊNCIA DE DILUIÇÃO', margin.left + 8, startY + 7);

            // Bonification details
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(255, 255, 255);
            doc.text(
                `${payload.itemBonificado.quantidade} CX de ${payload.itemBonificado.nome.replace('[BONIFICAÇÃO] ', '')} incorporadas à carga (Custo Zero)`,
                margin.left + 8, startY + 14
            );

            // Dilution metrics
            const metricsY = startY + 22;
            doc.setFontSize(7);
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);

            // Metric 1: Custo Médio ANTES
            doc.text('Custo Médio/CX (sem verba):', margin.left + 8, metricsY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(formatBRL(payload.custoMedioCargaSemVerba), margin.left + 60, metricsY);

            // Arrow
            doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            doc.text('→', margin.left + 85, metricsY);

            // Metric 2: Custo Médio DEPOIS
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text('Com verba:', margin.left + 92, metricsY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            doc.text(formatBRL(payload.custoMedioCargaComVerba), margin.left + 112, metricsY);

            // Metric 3: Economia
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text('|  Economia/CX:', margin.left + 140, metricsY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
            const economia = payload.custoMedioCargaSemVerba - payload.custoMedioCargaComVerba;
            doc.text(formatBRL(economia), margin.left + 168, metricsY);

            // Summary line
            const summaryY = metricsY + 7;
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text(
                `Ao diluir ${payload.totalCaixasBonificadas} CX bonificadas na carga de ${payload.totalCaixasPagas} CX pagas, o custo médio da carga cai, gerando poder de negociação na ponta.`,
                margin.left + 8, summaryY
            );

            startY += verbaBlockHeight + 10;
        }

        // === RESUMO DO FECHAMENTO (EXECUTIVE SUMMARY) ===
        if (startY > pageHeight - 50) {
            doc.addPage();
            startY = drawHeader(doc, doc.getNumberOfPages());
            if (logoResult) {
                try {
                    const logoH = 17;
                    const logoRatio = logoH / logoResult.height;
                    const logoW = logoResult.width * logoRatio;
                    doc.addImage(logoResult.data, 'PNG', margin.left, 5, logoW, logoH);
                } catch { /* silently fail */ }
            }
            startY += 2;
        }

        const summaryBlockWidth = pageWidth - margin.left - margin.right;
        const summaryBlockHeight = 42;

        // Background
        doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
        doc.roundedRect(margin.left, startY, summaryBlockWidth, summaryBlockHeight, 2, 2, 'F');

        // Title bar
        doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
        doc.rect(margin.left, startY, summaryBlockWidth, 10, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('RESUMO DO FECHAMENTO', margin.left + summaryBlockWidth / 2, startY + 7, { align: 'center' });

        // 4 Metrics in columns
        const metricStartY = startY + 15;
        const colWidth = summaryBlockWidth / 4;

        // Helper to draw a metric
        const drawMetric = (x: number, label: string, value: string, valueColor: [number, number, number], subtitle?: string) => {
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
            doc.text(label, x, metricStartY);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            doc.text(value, x, metricStartY + 8);

            if (subtitle) {
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(subtitle, x, metricStartY + 13);
            }
        };

        const col1X = margin.left + 8;
        const col2X = margin.left + colWidth + 8;
        const col3X = margin.left + colWidth * 2 + 8;
        const col4X = margin.left + colWidth * 3 + 8;

        drawMetric(col1X, 'INVESTIMENTO BRUTO (NF)', formatBRL(payload.investimentoBruto), colors.white, 'Preço seco de fábrica');
        drawMetric(col2X, `IMPACTO TRIBUTÁRIO (${payload.percentualImposto}%)`, formatBRL(payload.impostoEstimado), colors.orangeAccent, 'ICMS SP→MG estimado');
        drawMetric(col3X, 'FATURAMENTO PROJETADO PONTA', formatBRL(payload.faturamentoPonta), colors.accentCyan, 'Com margem sugerida');
        drawMetric(col4X, 'LUCRO LÍQUIDO ESPERADO', formatBRL(payload.lucroLiquidoEsperado), colors.greenAccent, 'Faturamento - (NF + Imposto)');

        // Disclaimer
        startY += summaryBlockHeight + 5;
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        doc.text(
            `* Valores estimados com base em margem sugerida (10% Álcool/Gel, 15% Compostos). Imposto de ${payload.percentualImposto}% (ICMS SP→MG) aplicado sobre custo NF. Consulte seu contador para apuração fiscal oficial.`,
            margin.left, startY
        );

        // Draw footers
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            drawFooter(doc, i, pageCount);
        }

        const dataClean = payload.data.replace(/\//g, '-');
        const fabricaClean = payload.fabrica.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Consultoria_Primeiro_Pedido_${fabricaClean}_${dataClean}.pdf`);

        console.log('[PDF Consultoria B2B] Gerado com sucesso.');

    } catch (error) {
        console.error('[PDF Consultoria B2B] ERRO FATAL:', error);
        throw error;
    }
}
