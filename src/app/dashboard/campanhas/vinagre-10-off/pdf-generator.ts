import { ApuracaoDashboardData } from '@/app/actions/apuracaoVinagre';

async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    let finalUrl = url;
    if (url.startsWith('/')) {
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
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = finalUrl;
  });
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, function(match) {
    return match.toUpperCase();
  });
}

export async function generateRelatorioVinagrePDF(data: ApuracaoDashboardData) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 14, right: 14 };
  const contentW = pageWidth - margin.left - margin.right;
  let y = 0;

  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // PALETA PREMIUM (Baseada no Belmont)
  const C = {
    dark: [10, 10, 14] as [number, number, number],
    darkCard: [24, 24, 32] as [number, number, number],
    blue: [37, 99, 235] as [number, number, number],
    cyan: [6, 182, 212] as [number, number, number],
    green: [16, 185, 129] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    orange: [234, 88, 12] as [number, number, number],
    purple: [139, 92, 246] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    rowAlt: [248, 250, 252] as [number, number, number],
    bgLight: [255, 255, 255] as [number, number, number],
    textDark: [15, 23, 42] as [number, number, number],
    textBody: [51, 65, 85] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    textLight: [203, 213, 225] as [number, number, number],
  };

  const logoBase64 = await getBase64Image('/logo.png');

  let campanhaAtiva = data.campanhaAtiva ?? true;

  const totalElegiveis = data.clientesAtacadistasBase ?? 0;
  const totalConvertidos = data.clientesConvertidos ?? 0;
  const taxaConversao = data.taxaConversao ?? 0;
  const volumeTotal = data.volumeTotalEscoado ?? 0;
  const receitaTotal = data.receitaTotalGerada ?? 0;

  const drawHeader = () => {
    doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    if (logoBase64 && logoBase64.data) {
      doc.addImage(logoBase64.data, 'PNG', margin.left, 8, 40, (40 * logoBase64.height) / logoBase64.width);
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text('RELATORIO GERENCIAL DE ANDAMENTO', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Campanha 10% OFF Vinagre de Alcool', pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('Periodo: Ano vigente ate a data de hoje | Emitido em ' + dateStr, pageWidth - margin.right, 28, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (campanhaAtiva) {
        doc.setTextColor(C.green[0], C.green[1], C.green[2]);
        doc.text('STATUS: EM ANDAMENTO', pageWidth - margin.right, 34, { align: 'right' });
    } else {
        doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.text('STATUS: ENCERRADA', pageWidth - margin.right, 34, { align: 'right' });
    }
    
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(0, 42, pageWidth * 0.5, 2.5, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.5, 42, pageWidth * 0.5, 2.5, 'F');
    
    return 54;
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const fY = pageHeight - 10;
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.rect(margin.left, fY - 4, contentW, 0.3, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('FRPlus - Gestao Comercial Inteligente', margin.left, fY);
    doc.text('Documento gerado automaticamente.', pageWidth / 2, fY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(String(pageNum) + ' / ' + String(totalPages), pageWidth - margin.right, fY, { align: 'right' });
  };

  y = drawHeader();

  const cardH = 28;
  const cardGap = 5;
  const cardCount = 4;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  const kpis = [
    { label: 'CLIENTES ATIVOS', value: String(totalElegiveis), sub: 'Atacadistas base', color: C.blue },
    { label: 'CONVERSAO', value: String(totalConvertidos), sub: String(taxaConversao) + '% da base', color: C.cyan },
    { label: 'VOLUME ESCOADO', value: volumeTotal.toLocaleString('pt-BR') + ' cx', sub: 'Escoamento da campanha', color: C.green },
    { label: 'RECEITA GERADA', value: 'R$ ' + receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), sub: 'Faturamento extra', color: C.purple },
  ];

  kpis.forEach((kpi, i) => {
    const cx = margin.left + i * (cardW + cardGap);
    doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cx, y, 2.5, cardH, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.label, cx + 7, y + 7);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text(kpi.value, cx + 7, y + 17);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.sub, cx + 7, y + 23);
  });

  y += cardH + 6;

  const barOuterH = 14;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(margin.left, y, contentW, barOuterH, 2, 2, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
  doc.text('PROGRESSO DA CONVERSAO (CLIENTES ATINGIRAM A META)', margin.left + 6, y + 5.5);

  const barX = margin.left + 6;
  const barY = y + 8;
  const barW = contentW - 70;
  const barH = 3.5;
  doc.setFillColor(40, 40, 55);
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');

  const fillW = Math.min(barW, barW * (taxaConversao / 100));
  if (fillW > 0) {
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(barX, barY, fillW, barH, 1.5, 1.5, 'F');
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(String(taxaConversao) + '%', pageWidth - margin.right - 6, y + 9, { align: 'right' });

  y += barOuterH + 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(String(totalConvertidos) + ' de ' + String(totalElegiveis) + ' clientes atingiram a meta (+50% de volume da ultima compra)', margin.left, y);
  y += 7;

  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(margin.left, y, 3, 5, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text('DETALHAMENTO POR CLIENTE', margin.left + 6, y + 4);
  y += 9;

  const tableData = (data.hitList || []).map((c, i) => {
    const va = c.volumeAnterior ?? 0;
    const m = c.metaCaixas ?? 0;
    const vc = c.volumeComprado ?? 0;

    let statusText = "Pendente";
    if (vc > 0 && m > 0 && vc < m) statusText = "Insuficiente";
    if (m > 0 && vc >= m) statusText = "10% OFF Liberado";
    if (vc > 0 && m === 0) statusText = "Comprou";

    return [
      String(i + 1),
      toTitleCase(c.razaoSocial || c.nomeFantasia || ""),
      c.cidade || "-",
      statusText,
      String(va),
      m > 0 ? String(m) : "-",
      vc > 0 ? String(vc) : "-",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "CLIENTE", "LOCALIDADE", "STATUS", "ULT. COMPRA", "META", "VOL. CAMPANHA"]],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      textColor: C.textBody,
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 6,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center", fontStyle: "bold", textColor: C.textMuted },
      1: { cellWidth: 50, fontStyle: "bold" },
      2: { cellWidth: 28 },
      3: { cellWidth: 26, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "right", cellWidth: 25, fontStyle: "bold", textColor: C.blue },
    },
    didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
            const rawStatus = hookData.cell.raw;
            if (rawStatus === "10% OFF Liberado") hookData.cell.styles.textColor = C.green;
            else if (rawStatus === "Insuficiente") hookData.cell.styles.textColor = C.orange;
            else if (rawStatus === "Pendente") hookData.cell.styles.textColor = C.amber;
            else if (rawStatus === "Comprou") hookData.cell.styles.textColor = C.blue;
        }
    },
    didDrawPage: (pageData: any) => {
      if (pageData.pageNumber > 1) {
        drawHeader();
      }
    },
    margin: { top: 44, left: margin.left, right: margin.right, bottom: 16 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save("Relatorio_Campanha_Vinagre_Atacado.pdf");
}