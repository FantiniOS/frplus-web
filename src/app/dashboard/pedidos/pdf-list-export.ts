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

  // PALETA CLARA/CORPORATIVA
  const C = {
    dark: [24, 24, 27] as [number, number, number],
    primary: [37, 99, 235] as [number, number, number],
    gray: [113, 113, 122] as [number, number, number],
    lightGray: [244, 244, 245] as [number, number, number],
    border: [228, 228, 231] as [number, number, number],
    bonif: [245, 158, 11] as [number, number, number],
    venda: [16, 185, 129] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  };

  const logoBase64 = await getBase64Image('/logo.png');

  // Desenha o cabeçalho
  const drawHeader = () => {
    // Fundo do cabeçalho
    doc.setFillColor(C.lightGray[0], C.lightGray[1], C.lightGray[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Logo
    if (logoBase64 && logoBase64.data) {
      doc.addImage(logoBase64.data, 'PNG', margin.left, 5, 35, (35 * logoBase64.height) / logoBase64.width);
    }
    
    // Textos do cabeçalho
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.text('LISTAGEM DE PEDIDOS DE VENDA', pageWidth - margin.right, 12, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
    doc.text(`Período: ${data.periodName}`, pageWidth - margin.right, 18, { align: 'right' });
    
    doc.setFontSize(8);
    doc.text(`Gerado por: ${data.usuarioNome}`, pageWidth - margin.right, 24, { align: 'right' });
    doc.text(`Emissão: ${dateStr} às ${timeStr}`, pageWidth - margin.right, 29, { align: 'right' });
    
    // Linha de detalhe
    doc.setFillColor(C.primary[0], C.primary[1], C.primary[2]);
    doc.rect(0, 35, pageWidth, 1, 'F');
    
    return 45;
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

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  
  // Coluna 1
  doc.text('Total de Registros:', margin.left + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.total), margin.left + 35, y + 6);

  // Coluna 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Vendas:', margin.left + 60, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.vendas), margin.left + 75, y + 6);

  // Coluna 3
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Bonificações:', margin.left + 100, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text(String(data.stats.bonificacoes), margin.left + 122, y + 6);

  // Faturamento Total (Linha de baixo ou ao lado)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.gray[0], C.gray[1], C.gray[2]);
  doc.text('Faturamento (Apenas Vendas):', margin.left + 5, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.venda[0], C.venda[1], C.venda[2]);
  doc.text(formatCurrency(data.stats.valorTotal), margin.left + 53, y + 12);

  y += 24;

  // Prepara os dados para a tabela
  const tableData = data.orders.map((o) => {
    const rawDate = o.dataPedido || o.data || o.createdAt;
    
    return [
      formatDate(rawDate),
      formatDate(o.dataNotaFiscal || o.dataFaturamento) || '-',
      o.notaFiscal || '-',
      o.nomeCliente || 'Sem Cliente',
      o.tipo === 'Bonificacao' ? 'BONIF' : 'VENDA',
      formatCurrency(Number(o.valorTotal))
    ];
  });

  if (tableData.length === 0) {
    tableData.push(['-', '-', '-', 'Nenhum pedido encontrado no período selecionado.', '-', '-']);
  }

  // Tabela de Pedidos usando autotable
  autoTable(doc, {
    startY: y,
    head: [["DATA", "DATA NF", "NOTA FISCAL", "CLIENTE", "TIPO", "VALOR TOTAL (R$)"]],
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
      fillColor: C.lightGray,
      textColor: C.dark,
      fontStyle: "bold",
      fontSize: 8,
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: C.border
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 25 },
      3: { cellWidth: 'auto', fontStyle: "bold" },
      4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didParseCell: function(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 4) {
             const type = hookData.cell.raw;
             if (type === 'BONIF') {
                 hookData.cell.styles.textColor = C.bonif;
             } else if (type === 'VENDA') {
                 hookData.cell.styles.textColor = C.venda;
             }
        }
        if (hookData.section === 'body' && hookData.column.index === 5) {
             const rowRaw = hookData.row.raw as string[];
             const type = rowRaw[4];
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
