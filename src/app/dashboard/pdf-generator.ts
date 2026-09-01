import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Reutilizamos a mesma função de logo do outro relatório
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

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export interface DashboardPDFData {
  periodName: string;
  usuarioNome: string;
  stats: { totalSales: number; totalOrders: number; newClients: number; totalProducts: number };
  faturamentoData: { total: number; count: number };
  ytdData: { currentYtd: number; previousYtd: number };
  faturamentoAnoAnterior: number;
  topProducts: { name: string; qtd: number; total: number }[];
}

export async function generateDashboardPDF(data: DashboardPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 14, right: 14 };
  const contentW = pageWidth - margin.left - margin.right;
  let y = 0;

  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // PALETA PREMIUM (Baseada no padrão existente Belmont)
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

  const drawHeader = () => {
    doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    if (logoBase64 && logoBase64.data) {
      doc.addImage(logoBase64.data, 'PNG', margin.left, 8, 40, (40 * logoBase64.height) / logoBase64.width);
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text('RELATORIO EXECUTIVO DE DESEMPENHO', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Painel Central de Indicadores', pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(`Periodo Selecionado: ${data.periodName}`, pageWidth - margin.right, 26, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.text(`Gerado por: ${data.usuarioNome} em ${dateStr} as ${timeStr}`, pageWidth - margin.right, 32, { align: 'right' });
    
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(0, 38, pageWidth * 0.5, 2, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.5, 38, pageWidth * 0.5, 2, 'F');
    
    return 48;
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const fY = pageHeight - 8;
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.rect(margin.left, fY - 3, contentW, 0.3, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('FRPlus - Gestao Comercial Inteligente', margin.left, fY);
    doc.text('Documento gerado automaticamente.', pageWidth / 2, fY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(String(pageNum) + ' / ' + String(totalPages), pageWidth - margin.right, fY, { align: 'right' });
  };

  y = drawHeader();

  // HEURÍSTICA
  const crescFaturamento = data.faturamentoAnoAnterior > 0 
    ? ((data.faturamentoData.total - data.faturamentoAnoAnterior) / data.faturamentoAnoAnterior) * 100 
    : 0;
  
  const crescYTD = data.ytdData.previousYtd > 0 
    ? ((data.ytdData.currentYtd - data.ytdData.previousYtd) / data.ytdData.previousYtd) * 100 
    : 0;

  const insights = [];
  if (crescFaturamento > 15) {
    insights.push(`Crescimento expressivo no faturamento (+${crescFaturamento.toFixed(1)}%), demonstrando forte tracao comercial e superacao historica.`);
  } else if (crescFaturamento < -10) {
    insights.push(`Atencao: Retracao de ${Math.abs(crescFaturamento).toFixed(1)}% no faturamento em relacao ao mesmo periodo base.`);
  } else {
    insights.push(`Desempenho estavel frente ao ano anterior, variacao de ${crescFaturamento.toFixed(1)}%.`);
  }

  if (data.topProducts.length > 0) {
    const share = data.faturamentoData.total > 0 ? (data.topProducts[0].total / data.faturamentoData.total) * 100 : 0;
    if (share > 25) {
        insights.push(`Concentracao de receita: "${data.topProducts[0].name}" rep. ${share.toFixed(1)}% do total.`);
    } else {
        insights.push(`Portfolio diversificado liderado por "${data.topProducts[0].name}".`);
    }
  }

  if (crescYTD !== 0) {
    insights.push(`Acumulado do ano (YTD): ${crescYTD > 0 ? '+' : ''}${crescYTD.toFixed(1)}% contra o periodo anterior.`);
  }

  const insightText = insights.join(' | ');

  // INSIGHTS BOX (Dark Premium)
  const insightH = 18;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin.left, y, contentW, insightH, 2, 2, 'F');
  doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.rect(margin.left, y, 2, insightH, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.text('INTELIGENCIA HEURISTICA (INSIGHTS)', margin.left + 5, y + 6);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(insightText, margin.left + 5, y + 12, { maxWidth: contentW - 10 });

  y += insightH + 6;

  // KPIs
  const cardH = 22;
  const cardGap = 4;
  const cardCount = 4;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  const kpis = [
    { label: 'VENDAS TOTAIS', value: formatCurrency(data.stats.totalSales), sub: String(data.stats.totalOrders) + ' pedidos', color: C.blue },
    { label: 'FATURAMENTO', value: formatCurrency(data.faturamentoData.total), sub: String(data.faturamentoData.count) + ' pedidos', color: C.green },
    { label: 'YTD (ANO)', value: formatCurrency(data.ytdData.currentYtd), sub: 'Acumulado base', color: C.purple },
    { label: 'YTD ANTERIOR', value: formatCurrency(data.ytdData.previousYtd), sub: 'Periodo anterior', color: C.orange },
  ];

  kpis.forEach((kpi, i) => {
    const cx = margin.left + i * (cardW + cardGap);
    doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cx, y, 2, cardH, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.label, cx + 5, y + 6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text(kpi.value, cx + 5, y + 14);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.sub, cx + 5, y + 19);
  });

  y += cardH + 6;

  // TABELA TOP PRODUTOS
  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(margin.left, y, 2.5, 4.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text('PRODUTOS DE MAIOR DESTAQUE', margin.left + 5, y + 4);
  y += 7;

  const tableData = data.topProducts.map((p, i) => [
    String(i + 1),
    p.name,
    String(p.qtd),
    formatCurrency(p.total)
  ]);

  if (tableData.length === 0) {
    tableData.push(['-', 'Nenhum dado encontrado para o periodo', '-', '-']);
  }

  autoTable(doc, {
    startY: y,
    head: [["#", "PRODUTO", "QTD", "TOTAL (R$)"]],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 8,
      minCellHeight: 8,
      valign: 'middle',
      textColor: C.textBody,
      lineColor: C.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 7,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold", textColor: C.textMuted },
      1: { cellWidth: 100, fontStyle: "bold" },
      2: { cellWidth: 25, halign: "center" },
      3: { halign: "right", cellWidth: 47, fontStyle: "bold", textColor: C.blue },
    },
    margin: { top: 30, left: margin.left, right: margin.right, bottom: 15 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  const safeName = data.periodName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Relatorio_Executivo_${safeName}.pdf`);
}
