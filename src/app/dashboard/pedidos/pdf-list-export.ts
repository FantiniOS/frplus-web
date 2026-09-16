import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Função para buscar e converter a imagem da logo para Base64
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

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'Sem data';
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
        return 'Sem data';
    }
}

export interface PedidosListPDFData {
  periodName: string;
  usuarioNome: string;
  stats: { total: number; vendas: number; bonificacoes: number; valorTotal: number };
  orders: any[];
}

export async function generatePedidosListPDF(data: PedidosListPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 14, right: 14 };
  const contentW = pageWidth - margin.left - margin.right;
  let y = 0;

  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // PALETA PREMIUM (Baseada no padrão existente)
  const C = {
    dark: [10, 10, 14] as [number, number, number],
    primary: [37, 99, 235] as [number, number, number],
    cyan: [6, 182, 212] as [number, number, number],
    gray: [113, 113, 122] as [number, number, number],
    lightGray: [244, 244, 245] as [number, number, number],
    border: [228, 228, 231] as [number, number, number],
    bonif: [245, 158, 11] as [number, number, number],
    venda: [16, 185, 129] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    textLight: [203, 213, 225] as [number, number, number],
    rowAlt: [248, 250, 252] as [number, number, number],
  };

  const logoBase64 = await getBase64Image('/logo.png');

  // Desenha o cabeçalho
  const drawHeader = () => {
    // Fundo do cabeçalho
    doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    // Logo
    if (logoBase64 && logoBase64.data) {
      doc.addImage(logoBase64.data, 'PNG', margin.left, 8, 40, (40 * logoBase64.height) / logoBase64.width);
    }
    
    // Textos do cabeçalho
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.text('LISTAGEM DE PEDIDOS DE VENDA', pageWidth - margin.right, 14, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text(`Período Selecionado: ${data.periodName}`, pageWidth - margin.right, 20, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.text(`Gerado por: ${data.usuarioNome} em ${dateStr} às ${timeStr}`, pageWidth - margin.right, 32, { align: 'right' });
    
    // Linha de detalhe
    doc.setFillColor(C.primary[0], C.primary[1], C.primary[2]);
    doc.rect(0, 38, pageWidth * 0.5, 2, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.5, 38, pageWidth * 0.5, 2, 'F');
    
    return 48;
  };

  y = drawHeader();

  // Desenha os KPIs / Resumo
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text('RESUMO DO PERÍODO', margin.left, y);
  y += 6;

  // Caixa de Resumo
  doc.setFillColor(C.lightGray[0], C.lightGray[1], C.lightGray[2]);
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.roundedRect(margin.left, y, contentW, 16, 2, 2, 'FD');

  const valorVendas = data.orders.reduce((acc, o) => acc + (o.tipo !== 'Bonificacao' ? Number(o.valorTotal) : 0), 0);
  const valorBonificacoes = data.orders.reduce((acc, o) => acc + (o.tipo === 'Bonificacao' ? Number(o.valorTotal) : 0), 0);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  
  // Linha 1: Contagens
  doc.text('Vendas Emitidas:', margin.left + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.vendas), margin.left + 30, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Bonificações:', margin.left + 65, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.bonificacoes), margin.left + 85, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Total de Registros:', margin.left + 120, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.total), margin.left + 145, y + 6);

  // Linha 2: Valores
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Faturamento (Vendas):', margin.left + 5, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.venda[0], C.venda[1], C.venda[2]);
  doc.text(formatCurrency(valorVendas), margin.left + 39, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Custo (Bonificações):', margin.left + 75, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.bonif[0], C.bonif[1], C.bonif[2]);
  doc.text(formatCurrency(valorBonificacoes), margin.left + 107, y + 12);

  y += 24;

  // Prepara os dados para a tabela
  const tableData = data.orders.map((o) => {
    const rawDate = o.dataPedido || o.data || o.createdAt;
    
    return [
      formatDate(rawDate),
      o.notaFiscal || '-',
      o.nomeCliente || 'Sem Cliente',
      o.tipo === 'Bonificacao' ? 'BONIF' : 'VENDA',
      formatCurrency(Number(o.valorTotal))
    ];
  });

  if (tableData.length === 0) {
    tableData.push(['-', '-', 'Nenhum pedido encontrado no período selecionado.', '-', '-']);
  }

  // Tabela de Pedidos usando autotable
  autoTable(doc, {
    startY: y,
    head: [["DATA", "NOTA FISCAL", "CLIENTE", "TIPO", "VALOR TOTAL (R$)"]],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 8,
      minCellHeight: 7,
      valign: 'middle',
      textColor: C.dark,
      lineColor: C.border,
      lineWidth: 0.1, // Bordas sutis
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 7,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: C.rowAlt
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto', fontStyle: "bold" },
      3: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didParseCell: function(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 3) {
             const type = hookData.cell.raw;
             if (type === 'BONIF') {
                 hookData.cell.styles.textColor = C.bonif;
             } else if (type === 'VENDA') {
                 hookData.cell.styles.textColor = C.venda;
             }
        }
        if (hookData.section === 'body' && hookData.column.index === 4) {
             const rowRaw = hookData.row.raw as string[];
             const type = rowRaw[3];
             if (type === 'BONIF') {
                 hookData.cell.styles.textColor = C.bonif;
             }
        }
    },
    margin: { left: margin.left, right: margin.right, bottom: 15 },
  });

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const fY = pageHeight - 10;
    
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.rect(margin.left, fY - 3, contentW, 0.3, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
    doc.text('FRPlus - Gestão Comercial', margin.left, fY);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin.right, fY, { align: 'right' });
  }

  // Sanitiza o nome do arquivo
  const safeName = data.periodName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Listagem_Pedidos_${safeName}.pdf`);
}
