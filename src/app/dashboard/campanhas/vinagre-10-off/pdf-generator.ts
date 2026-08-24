import { ApuracaoDashboardData, HitListClient } from '@/app/actions/apuracaoVinagre';

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
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text('RELATORIO GERENCIAL DE ANDAMENTO', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Campanha 10% OFF Vinagre de Alcool', pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('Periodo: Ano vigente ate a data de hoje | Emitido em ' + dateStr, pageWidth - margin.right, 26, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (campanhaAtiva) {
        doc.setTextColor(C.green[0], C.green[1], C.green[2]);
        doc.text('STATUS: EM ANDAMENTO', pageWidth - margin.right, 32, { align: 'right' });
    } else {
        doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.text('STATUS: ENCERRADA', pageWidth - margin.right, 32, { align: 'right' });
    }
    
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(0, 38, pageWidth * 0.5, 2, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.5, 38, pageWidth * 0.5, 2, 'F');
    
    return 46;
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

  const cardH = 22;
  const cardGap = 4;
  const cardCount = 4;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  const kpis = [
    { label: 'CLIENTES ATIVOS', value: String(totalElegiveis), sub: 'Atacadistas base', color: C.blue },
    { label: 'CONVERSAO', value: String(totalConvertidos), sub: String(taxaConversao) + '% da base', color: C.cyan },
    { label: 'VOLUME ESCOADO', value: volumeTotal.toLocaleString('pt-BR') + ' cx', sub: 'Escoamento', color: C.green },
    { label: 'RECEITA GERADA', value: 'R$ ' + receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), sub: 'Faturamento', color: C.purple },
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
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text(kpi.value, cx + 5, y + 14);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.sub, cx + 5, y + 19);
  });

  y += cardH + 5;

  const barOuterH = 12;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(margin.left, y, contentW, barOuterH, 2, 2, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
  doc.text('PROGRESSO DA CONVERSAO (CLIENTES ATINGIRAM A META)', margin.left + 5, y + 5);

  const barX = margin.left + 5;
  const barY = y + 7.5;
  const barW = contentW - 55;
  const barH = 3;
  doc.setFillColor(40, 40, 55);
  doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');

  const fillW = Math.min(barW, barW * (taxaConversao / 100));
  if (fillW > 0) {
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(barX, barY, fillW, barH, 1, 1, 'F');
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(String(taxaConversao) + '%', pageWidth - margin.right - 5, y + 8.5, { align: 'right' });

  y += barOuterH + 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(String(totalConvertidos) + ' de ' + String(totalElegiveis) + ' clientes atingiram a meta (+50% de volume da ultima compra)', margin.left, y);
  y += 6;

  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(margin.left, y, 2.5, 4.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text('DETALHAMENTO POR CLIENTE', margin.left + 5, y + 4);
  y += 7;

  // Lógica Dinâmica para não deixar espaços em branco
  const startTableY = y;
  const maxTableHeight = pageHeight - startTableY - 14; 
  
  // Limite razoável para caber bem em uma página
  const maxRows = 28;
  let hitListLimited = data.hitList || [];
  const exceedsOnePage = hitListLimited.length > maxRows;
  
  if (exceedsOnePage) {
    hitListLimited = hitListLimited.slice(0, maxRows);
  }

  // Preenche a página expandindo as células se houver poucos dados (considerando +1 row do foot)
  const totalItems = hitListLimited.length + (exceedsOnePage ? 2 : 1) + 1;
  const dynamicCellHeight = Math.min(10, Math.max(5, maxTableHeight / totalItems));
  const dynamicFontSize = Math.min(7.5, Math.max(6, dynamicCellHeight * 0.7));

  let totalVolumeBase = 0;
  let totalMeta = 0;
  let totalVolumeRealizado = 0;

  (data.hitList || []).forEach(c => {
    totalVolumeBase += c.volumeBase ?? 0;
    totalMeta += c.meta ?? 0;
    totalVolumeRealizado += c.volumeRealizado ?? 0;
  });

  const tableData = hitListLimited.map((c, i) => {
    const va = c.volumeBase ?? 0;
    const m = c.meta ?? 0;
    const vc = c.volumeRealizado ?? 0;

    let statusText = "Pendente";
    if (vc > 0 && m > 0 && vc < m) statusText = "Insuficiente";
    if (m > 0 && vc >= m) statusText = "10% OFF Liberado";
    if (vc > 0 && m === 0) statusText = "Comprou";

    return [
      String(i + 1),
      toTitleCase(c.razaoSocial || c.nomeFantasia || ""),
      statusText,
      String(va),
      m > 0 ? String(m) : "-",
      vc > 0 ? String(vc) : "-",
    ];
  });

  if (exceedsOnePage) {
    tableData.push([
      "-",
      `+ ${data.hitList.length - maxRows} clientes ocultos...`,
      "-",
      "-",
      "-",
      "-"
    ]);
  }

  autoTable(doc, {
    startY: startTableY,
    head: [["#", "CLIENTE", "STATUS", "ULT. COMPRA", "META", "VOL. CAMPANHA"]],
    body: tableData,
    foot: [["", "TOTAIS DA CAMPANHA", "", String(totalVolumeBase), String(totalMeta), String(totalVolumeRealizado)]],
    theme: "plain",
    styles: {
      fontSize: dynamicFontSize,
      minCellHeight: dynamicCellHeight,
      valign: 'middle',
      cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
      textColor: C.textBody,
      lineColor: C.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: Math.max(5, dynamicFontSize - 0.5),
      valign: 'middle',
    },
    footStyles: {
      fillColor: C.border,
      textColor: C.textDark,
      fontStyle: "bold",
      fontSize: Math.max(5.5, dynamicFontSize - 0.5),
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center", fontStyle: "bold", textColor: C.textMuted },
      1: { cellWidth: 78, fontStyle: "bold" },
      2: { cellWidth: 26, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "center", cellWidth: 25, fontStyle: "bold", textColor: C.blue },
    },
    didParseCell: (hookData: any) => {
        // Alinhamento forçado para garantir centralização em todas as sessões (head, body, foot)
        if (hookData.column.index >= 3) {
            hookData.cell.styles.halign = 'center';
        }
        
        // Formatação de cores do Status
        if (hookData.section === "body" && hookData.column.index === 2) {
            const rawStatus = hookData.cell.raw;
            if (rawStatus === "10% OFF Liberado") hookData.cell.styles.textColor = C.green;
            else if (rawStatus === "Insuficiente") hookData.cell.styles.textColor = C.orange;
            else if (rawStatus === "Pendente") hookData.cell.styles.textColor = C.amber;
            else if (rawStatus === "Comprou") hookData.cell.styles.textColor = C.blue;
        }

        // Alinhar o texto "TOTAIS DA CAMPANHA" à direita
        if (hookData.section === "foot" && hookData.column.index === 1) {
            hookData.cell.styles.halign = 'right';
        }
    },
    didDrawPage: (pageData: any) => {
      // Impede header/footer duplicados se vazar
    },
    margin: { top: 30, left: margin.left, right: margin.right, bottom: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save("Relatorio_Campanha_Vinagre_Atacado.pdf");
}

export async function generatePropostaVinagrePDF(cliente: HitListClient, campanhaAtiva: boolean) {
  const { jsPDF } = await import('jspdf');
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

  const drawHeader = () => {
    doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    if (logoBase64 && logoBase64.data) {
      doc.addImage(logoBase64.data, 'PNG', margin.left, 8, 40, (40 * logoBase64.height) / logoBase64.width);
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text('PROPOSTA COMERCIAL EXCLUSIVA', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Campanha 10% OFF Vinagre de Alcool', pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('Emissao: ' + dateStr, pageWidth - margin.right, 28, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (campanhaAtiva) {
        doc.setTextColor(C.green[0], C.green[1], C.green[2]);
        doc.text('VIGENCIA: EM ANDAMENTO', pageWidth - margin.right, 34, { align: 'right' });
    } else {
        doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.text('VIGENCIA: ENCERRADA', pageWidth - margin.right, 34, { align: 'right' });
    }
    
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(0, 42, pageWidth * 0.5, 2.5, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.5, 42, pageWidth * 0.5, 2.5, 'F');
    
    return 54;
  };

  const drawFooter = () => {
    const fY = pageHeight - 10;
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.rect(margin.left, fY - 4, contentW, 0.3, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('FRPlus - Gestao Comercial Inteligente', margin.left, fY);
    doc.text('Documento gerado automaticamente. Proposta sujeita a aprovacao comercial.', pageWidth / 2, fY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('1 / 1', pageWidth - margin.right, fY, { align: 'right' });
  };

  y = drawHeader();

  // SECTION: CLIENTE
  doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
  doc.roundedRect(margin.left, y, contentW, 26, 2, 2, 'F');
  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(margin.left, y, 2.5, 26, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text('DADOS DO CLIENTE', margin.left + 7, y + 6);
  
  doc.setFontSize(11);
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text(toTitleCase(cliente.razaoSocial || cliente.nomeFantasia || 'Nao informado'), margin.left + 7, y + 12);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textBody[0], C.textBody[1], C.textBody[2]);
  doc.text('CNPJ: ' + (cliente.cnpj || 'Nao informado'), margin.left + 7, y + 18);
  
  doc.text('Comprador: ' + (cliente.comprador || 'Nao informado'), margin.left + 80, y + 18);
  doc.text('Localidade: ' + (cliente.cidade || '-'), margin.left + 140, y + 18);

  y += 32;

  const va = cliente.volumeBase || 0;
  const m = cliente.meta || 0;
  const vc = cliente.volumeRealizado || 0;
  
  const precoBase = cliente.precoTabela || 0;

  const showFinance = precoBase > 0 && m > 0;
  
  const fmtBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  let economiaFormatada = "";
  let custoNormal = 0;
  let valorComDesconto = 0;
  let economia = 0;

  if (showFinance) {
    custoNormal = m * precoBase;
    valorComDesconto = custoNormal * 0.9;
    economia = custoNormal - valorComDesconto;
    economiaFormatada = fmtBRL(economia);
  }

  // SECTION: PROPOSTA HIGHLIGHT
  const highlightBoxH = showFinance ? 108 : 40;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(margin.left, y, contentW, highlightBoxH, 2, 2, 'F');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.text('10% DE DESCONTO ADICIONAL', pageWidth / 2, y + 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
  doc.text('Para garantir o desconto de 10% no Vinagre de Alcool, o volume do seu', pageWidth / 2, y + 25, { align: 'center' });
  doc.text('proximo pedido precisa superar a sua ultima compra em 50%.', pageWidth / 2, y + 31, { align: 'center' });

  if (showFinance) {
    // 1. Gatilho
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.amber[0], C.amber[1], C.amber[2]);
    doc.text(`Economia imediata estimada de ${economiaFormatada} na compra da meta!`, pageWidth / 2, y + 41, { align: 'center' });

    // 2. Receipt Box (Memória de Cálculo)
    const rx = margin.left + 15;
    const rw = contentW - 30;
    const ry = y + 48;
    const rh = 50;

    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(rx, ry, rw, rh, 2, 2, 'F');

    const leftX = rx + 8;
    const rightX = rx + rw - 8;
    let lineY = ry + 8;

    doc.setFontSize(9);
    
    // Line 1: Volume
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Volume Meta:', leftX, lineY);
    doc.text(`${m} cx`, rightX, lineY, { align: 'right' });
    lineY += 7;

    // Line 2: Preço Unitário
    doc.text('Preco Unitario Estimado:', leftX, lineY);
    doc.text(fmtBRL(precoBase), rightX, lineY, { align: 'right' });
    lineY += 7;

    // Line 3: Total sem desconto
    doc.text('Total sem desconto:', leftX, lineY);
    doc.text(fmtBRL(custoNormal), rightX, lineY, { align: 'right' });
    lineY += 7;

    // Line 4: Desconto
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('(-) Desconto de 10%:', leftX, lineY);
    doc.text(fmtBRL(economia), rightX, lineY, { align: 'right' });
    
    // Separator line
    lineY += 4;
    doc.setDrawColor(71, 85, 105); // slate-600
    doc.setLineWidth(0.2);
    doc.line(rx + 5, lineY, rx + rw - 5, lineY);

    // Line 5: Total com desconto
    lineY += 8;
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // emerald-500 (C.green)
    doc.text('INVESTIMENTO FINAL:', leftX, lineY);
    doc.text(fmtBRL(valorComDesconto), rightX, lineY, { align: 'right' });
  }

  y += highlightBoxH + 6;

  // SECTION: KPI CARDS
  const cardH = 28;
  const cardGap = 5;
  const cardCount = 3;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  let statusText = 'PENDENTE';
  let statusColor = C.amber;
  let statusSub = 'Aguardando pedido';
  
  if (vc > 0 && m > 0 && vc < m) {
      statusText = 'INSUFICIENTE';
      statusColor = C.orange;
      statusSub = 'Faltam ' + String(m - vc) + ' cx';
  } else if (m > 0 && vc >= m) {
      statusText = 'LIBERADO';
      statusColor = C.green;
      statusSub = 'Desconto garantido';
  } else if (vc > 0 && m === 0) {
      statusText = 'COMPROU';
      statusColor = C.blue;
      statusSub = 'Sem meta anterior base';
  }

  const kpis = [
    { label: 'VOLUME ULTIMA COMPRA', value: String(va) + ' cx', sub: 'Base para calculo', color: C.blue },
    { label: m > 0 ? 'META PARA 10% OFF' : 'META INDISPONIVEL', value: m > 0 ? String(m) + ' cx' : '-', sub: m > 0 ? '+50% sobre ultima compra' : 'Fale com consultor', color: C.cyan },
    { label: 'STATUS DA META', value: statusText, sub: statusSub, color: statusColor },
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

  y += cardH + 12;



  drawFooter();
  
  // Safe filename
  const safeName = (cliente.nomeFantasia || cliente.razaoSocial || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Proposta_Vinagre_${safeName}.pdf`);
}
