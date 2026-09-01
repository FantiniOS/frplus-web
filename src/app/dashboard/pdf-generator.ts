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
  topClients: { name: string; qtd: number; total: number }[];
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
    doc.text('RELATÓRIO EXECUTIVO DE DESEMPENHO', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Painel Central de Indicadores', pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(`Período Selecionado: ${data.periodName}`, pageWidth - margin.right, 26, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.text(`Gerado por: ${data.usuarioNome} em ${dateStr} às ${timeStr}`, pageWidth - margin.right, 32, { align: 'right' });
    
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
    doc.text('FRPlus - Gestão Comercial Inteligente', margin.left, fY);
    doc.text('Documento gerado automaticamente.', pageWidth / 2, fY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(String(pageNum) + ' / ' + String(totalPages), pageWidth - margin.right, fY, { align: 'right' });
  };

  y = drawHeader();

  // HEURÍSTICA AVANÇADA
  const crescFaturamento = data.faturamentoAnoAnterior > 0 
    ? ((data.faturamentoData.total - data.faturamentoAnoAnterior) / data.faturamentoAnoAnterior) * 100 
    : 0;
  
  const crescYTD = data.ytdData.previousYtd > 0 
    ? ((data.ytdData.currentYtd - data.ytdData.previousYtd) / data.ytdData.previousYtd) * 100 
    : 0;

  const ticketMedio = data.faturamentoData.count > 0 
    ? data.faturamentoData.total / data.faturamentoData.count 
    : 0;

  const ticketMedioVendas = data.stats.totalOrders > 0 
    ? data.stats.totalSales / data.stats.totalOrders 
    : 0;

  const gapFaturamento = data.stats.totalSales - data.faturamentoData.total;
  const eficienciaFaturamento = data.stats.totalSales > 0 
    ? (data.faturamentoData.total / data.stats.totalSales) * 100 
    : 0;

  const insights = [];
  
  // 1. Análise Macro: Desempenho e Tendência
  if (crescFaturamento > 10 && crescYTD > 5) {
    insights.push(`A operação registra um momento de tração vigorosa. O avanço de +${crescFaturamento.toFixed(1)}% neste período consolida uma expansão sustentável ao longo do ano (+${crescYTD.toFixed(1)}% YTD), indicando forte adesão das campanhas comerciais e ganhos massivos de market share.`);
  } else if (crescFaturamento > 0 && crescYTD < 0) {
    insights.push(`Um claro ponto de inflexão: o crescimento isolado de +${crescFaturamento.toFixed(1)}% neste ciclo ajuda a romper o histórico anual negativo (${crescYTD.toFixed(1)}% YTD). O momento exige capitalizar sobre as estratégias recentes para blindar essa trajetória de recuperação.`);
  } else if (crescFaturamento < 0 && crescYTD > 0) {
    insights.push(`Apesar da robustez acumulada no ano (+${crescYTD.toFixed(1)}%), o período atual sinaliza uma desaceleração estratégica (${crescFaturamento.toFixed(1)}%). É recomendada uma revisão tática no pipeline de prospecção para retomar o tracionamento do trimestre.`);
  } else if (crescFaturamento < -5) {
    insights.push(`Cenário de atenção executiva. A retração de ${Math.abs(crescFaturamento).toFixed(1)}% no ciclo atual, somada ao cenário anual desafiador, exige intervenção imediata nas políticas de precificação e resgate intensivo de carteira inativa.`);
  } else {
    insights.push(`Comportamento de estabilidade transacional. A variação suave de ${crescFaturamento.toFixed(1)}% aponta para um cenário conservador, necessitando de ações disruptivas de upsell para inflamar novamente a agressividade nas vendas.`);
  }

  // 2. Risco de Portfólio e Curva ABC
  if (data.topProducts.length > 0) {
    const shareProd = data.faturamentoData.total > 0 ? (data.topProducts[0].total / data.faturamentoData.total) * 100 : 0;
    if (shareProd > 35) {
        insights.push(`Vulnerabilidade de mix identificada: o item "${data.topProducts[0].name}" concentra alarmantes ${shareProd.toFixed(1)}% da receita. Estratégias de pulverização e cross-sell são vitais para mitigar o risco dessa dependência isolada.`);
    }
  }

  if (data.topClients && data.topClients.length > 0) {
    const shareClient = data.faturamentoData.total > 0 ? (data.topClients[0].total / data.faturamentoData.total) * 100 : 0;
    if (shareClient > 25) {
        insights.push(`Alerta de key-account: ${shareClient.toFixed(1)}% de todo o volume financeiro gerado está atrelado a um único cliente ("${data.topClients[0].name}"). Reforçar as trincheiras de relacionamento corporativo com esta conta é imperativo.`);
    }
  }

  let insightText = insights.join(' ');
  if (!insightText) {
      insightText = "O período não apresentou desvios estatísticos significativos que acionassem alertas de intervenção. O volume de operações se manteve dentro das margens e faixas de segurança padrão.";
  }

  // INSIGHTS BOX (Dark Premium)
  // Aumentando a altura da caixa para caber um texto mais robusto
  const insightH = 34;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin.left, y, contentW, insightH, 2, 2, 'F');
  doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.rect(margin.left, y, 2, insightH, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.text('INTELIGÊNCIA HEURÍSTICA (INSIGHTS)', margin.left + 5, y + 6);
  
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(insightText, margin.left + 5, y + 11, { maxWidth: contentW - 10, lineHeightFactor: 1.4 });

  y += insightH + 6;

  // KPIs - 4 CARDS REPLICANDO EXATAMENTE O VISUAL DO SISTEMA
  const cardH = 28;
  const cardGap = 4;
  const cardCount = 4;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  // Extrair o ano atual para as legendas
  const currYear = new Date().getFullYear();
  const prevYear = currYear - 1;

  // Card 1: VENDAS TOTAIS
  const cx1 = margin.left;
  doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
  doc.roundedRect(cx1, y, cardW, cardH, 2, 2, 'F');
  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(cx1, y, 2, cardH, 'F');
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text('VENDAS TOTAIS', cx1 + 5, y + 6);
  
  doc.setFontSize(11);
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text(formatCurrency(data.stats.totalSales), cx1 + 5, y + 14);
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(`${data.stats.totalOrders} pedidos emitidos`, cx1 + 5, y + 22);

  // Card 2: FATURAMENTO
  const cx2 = cx1 + cardW + cardGap;
  doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
  doc.roundedRect(cx2, y, cardW, cardH, 2, 2, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(cx2, y, 2, cardH, 'F');
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text('FATURAMENTO', cx2 + 5, y + 6);
  
  doc.setFontSize(11);
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text(formatCurrency(data.faturamentoData.total), cx2 + 5, y + 14);
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(`${data.faturamentoData.count} pedidos faturados`, cx2 + 5, y + 22);

  // Card 3: COMPARAÇÃO ANO ANTERIOR
  const cx3 = cx2 + cardW + cardGap;
  doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
  doc.roundedRect(cx3, y, cardW, cardH, 2, 2, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(cx3, y, 2, cardH, 'F');
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text('COMPARAÇÃO ANO ANTERIOR', cx3 + 5, y + 6);
  
  doc.setFontSize(14);
  const colorYoy = crescFaturamento >= 0 ? C.green : [239, 68, 68]; // red-500
  doc.setTextColor(colorYoy[0], colorYoy[1], colorYoy[2]);
  doc.text(`${crescFaturamento > 0 ? '+' : ''}${crescFaturamento.toFixed(1)}%`, cx3 + 5, y + 16);
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(`Período atual vs ${prevYear}`, cx3 + 5, y + 22);
  
  // Desenhar os mini-gráficos de barra
  const barW = 6;
  const maxBarH = 8;
  const barBaseY = y + 20;
  const barRightMargin = cx3 + cardW - 5;
  
  // Valores normalizados para o gráfico
  const maxVal = Math.max(data.faturamentoData.total, data.faturamentoAnoAnterior, 1);
  const h1 = (data.faturamentoAnoAnterior / maxVal) * maxBarH;
  const h2 = (data.faturamentoData.total / maxVal) * maxBarH;
  
  // Barra Ano Anterior (Cinza claro)
  doc.setFillColor(C.border[0], C.border[1], C.border[2]);
  doc.rect(barRightMargin - barW * 2 - 3, barBaseY - h1, barW, h1, 'F');
  doc.setFontSize(4);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(String(prevYear), barRightMargin - barW * 2 - 3 + (barW/2), barBaseY + 3, { align: 'center' });
  
  // Barra Ano Atual (Verde ou Vermelho)
  doc.setFillColor(colorYoy[0], colorYoy[1], colorYoy[2]);
  doc.rect(barRightMargin - barW, barBaseY - h2, barW, h2, 'F');
  doc.text(String(currYear), barRightMargin - barW + (barW/2), barBaseY + 3, { align: 'center' });

  // Card 4: ACUMULADO DO ANO (YTD)
  const cx4 = cx3 + cardW + cardGap;
  doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
  doc.roundedRect(cx4, y, cardW, cardH, 2, 2, 'F');
  doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.rect(cx4, y, 2, cardH, 'F');
  
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text('ACUMULADO DO ANO (YTD)', cx4 + 5, y + 6);
  
  doc.setFontSize(11);
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text(formatCurrency(data.ytdData.currentYtd), cx4 + 5, y + 12);
  
  // Indicador de queda/alta logo abaixo do valor
  const colorYtd = crescYTD >= 0 ? C.green : [239, 68, 68];
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colorYtd[0], colorYtd[1], colorYtd[2]);
  doc.text(`${crescYTD > 0 ? '+' : ''}${crescYTD.toFixed(1)}% vs ano anterior`, cx4 + 5, y + 16);
  
  // Linha divisória do rodapé do card
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.2);
  doc.line(cx4 + 5, y + 20, cx4 + cardW - 5, y + 20);
  
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(`${currYear} vs ${prevYear}`, cx4 + 5, y + 24);
  doc.text(`${formatCurrency(data.ytdData.previousYtd)} no anterior`, cx4 + cardW - 5, y + 24, { align: 'right' });

  y += cardH + 8;

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

  y = (doc as any).lastAutoTable.finalY + 8;

  // TABELA MELHORES CLIENTES DO MÊS
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(margin.left, y, 2.5, 4.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text('MELHORES CLIENTES DO MÊS', margin.left + 5, y + 4);
  y += 7;

  const tableClientsData = data.topClients.map((c, i) => [
    String(i + 1),
    c.name,
    String(c.qtd),
    formatCurrency(c.total)
  ]);

  if (tableClientsData.length === 0) {
    tableClientsData.push(['-', 'Nenhum dado encontrado para o periodo', '-', '-']);
  }

  autoTable(doc, {
    startY: y,
    head: [["#", "CLIENTE", "PEDIDOS", "TOTAL (R$)"]],
    body: tableClientsData,
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
      3: { halign: "right", cellWidth: 47, fontStyle: "bold", textColor: C.green },
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
