export interface PrePedidoPDFData {
    id: string;
    createdAt: string | Date;
    data?: string | Date;
    status: string;
    motivoRejeicao?: string | null;
    valorTotal: number | string;
    cliente: {
        id?: string;
        razaoSocial: string;
        nomeFantasia?: string | null;
        cnpj: string;
        endereco?: string | null;
        numero?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        estado?: string | null;
        cep?: string | null;
        telefone?: string | null;
        celular?: string | null;
    };
    vendedor: {
        nome: string;
    };
    itens: Array<{
        id?: string;
        quantidade: number;
        precoUnitario: number | string;
        produto: {
            id?: string;
            codigo?: string;
            nome: string;
            unidade?: string | null;
        };
    }>;
}

export async function gerarPdfPrePedido(prePedido: PrePedidoPDFData) {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = { left: 14, right: 14 };
    const contentWidth = pageWidth - margin.left - margin.right;

    // PALETA DE CORES OFICIAL FRPLUS
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
        factoryBg: [235, 238, 248] as [number, number, number],
    };

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
            logoImg.src = '/logo.png';
        });
    };

    const logoResult = await loadLogo();
    const logoData = logoResult?.data || null;

    const dataPedidoReal = prePedido.data || prePedido.createdAt;
    const dataEmissao = dataPedidoReal ? new Date(dataPedidoReal).toLocaleDateString('pt-BR') : 'Sem data';
    const horaEmissao = dataPedidoReal ? new Date(dataPedidoReal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const pedidoNumero = prePedido.id.slice(-6).toUpperCase();
    const vendedorNome = prePedido.vendedor?.nome || 'Não informado';

    // HEADER
    const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
        const headerHeight = 38;
        pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
        pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');
        pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
        pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
        pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
        pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

        if (logoData) {
            try {
                const logoH = 19.5;
                let logoW = 19.5;
                if (logoResult) {
                    const aspect = logoResult.width / logoResult.height;
                    logoW = logoH * aspect;
                }
                pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
            } catch { /* ignore */ }
        }

        pageDoc.setFontSize(13);
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setTextColor(255, 255, 255);
        pageDoc.text(`PRÉ-PEDIDO #${pedidoNumero}`, pageWidth - margin.right, 13, { align: 'right' });

        pageDoc.setFontSize(8);
        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        pageDoc.text(`Emissão: ${dataEmissao} ${horaEmissao}`, pageWidth - margin.right, 19, { align: 'right' });
        pageDoc.text(`Vendedor(a): ${vendedorNome}`, pageWidth - margin.right, 24, { align: 'right' });

        const statusLabel = prePedido.status ? `Status: ${prePedido.status}` : 'Status: PENDENTE';
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.text(statusLabel, pageWidth - margin.right, 29, { align: 'right' });

        if (pageNum > 1) {
            pageDoc.setFontSize(7);
            pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            pageDoc.text('(Continuação)', pageWidth - margin.right, 34, { align: 'right' });
        }

        return headerHeight + 5;
    };

    const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 12;
        pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
        pageDoc.setLineWidth(0.3);
        pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
        pageDoc.setFontSize(7);
        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        pageDoc.text('FRPlus — Central de Captação B2B', margin.left, footerY);
        pageDoc.text('Documento gerado eletronicamente', pageWidth / 2, footerY, { align: 'center' });
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.text(`Página ${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
    };

    let startY = drawHeader(doc, 1);

    // DADOS DO CLIENTE
    startY += 2;
    const cliente = prePedido.cliente;
    doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
    doc.roundedRect(margin.left, startY, contentWidth, 23, 1.5, 1.5, 'F');
    doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
    doc.setLineWidth(1);
    doc.line(margin.left, startY + 2, margin.left, startY + 21);

    doc.setFontSize(7);
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('DADOS DO CLIENTE', margin.left + 5, startY + 5.5);

    doc.setFontSize(10);
    doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
    doc.setFont('helvetica', 'bold');
    const razaoSocial = cliente?.razaoSocial || 'Cliente não identificado';
    const fantasia = cliente?.nomeFantasia ? ` (${cliente.nomeFantasia})` : '';
    doc.text(`${razaoSocial}${fantasia}`, margin.left + 5, startY + 10.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const cnpjFormatado = cliente?.cnpj || 'Não informado';
    const telefone = cliente?.telefone || cliente?.celular || '';
    const contatoStr = telefone ? ` | Tel: ${telefone}` : '';
    doc.text(`CNPJ: ${cnpjFormatado}${contatoStr}`, margin.left + 5, startY + 15);

    let enderecoCompleto = 'Endereço não informado';
    if (cliente && cliente.endereco) {
        enderecoCompleto = `${cliente.endereco}`;
        if (cliente.numero) enderecoCompleto += `, ${cliente.numero}`;
        if (cliente.bairro) enderecoCompleto += ` - ${cliente.bairro}`;
        if (cliente.cidade) enderecoCompleto += ` - ${cliente.cidade}`;
        if (cliente.estado) enderecoCompleto += `/${cliente.estado}`;
        if (cliente.cep) enderecoCompleto += ` - CEP: ${cliente.cep}`;
    }
    doc.text(`${enderecoCompleto}`, margin.left + 5, startY + 19.5);

    startY += 28;

    // TABELA DE ITENS
    const tableData = prePedido.itens.map((item, index) => {
        const unit = item.produto?.unidade || 'CX';
        const qtd = Number(item.quantidade);
        const preco = Number(item.precoUnitario);
        const total = qtd * preco;
        const nomeProd = item.produto?.codigo 
            ? `[${item.produto.codigo}] ${item.produto.nome}` 
            : item.produto?.nome || 'Produto';

        return [
            String(index + 1).padStart(2, '0'),
            nomeProd,
            String(qtd),
            unit,
            `R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ];
    });

    autoTable(doc, {
        startY,
        head: [['#', 'PRODUTO', 'QTD', 'UNID', 'PREÇO UNIT.', 'TOTAL ITEM']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2, textColor: colors.textDark },
        headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
        alternateRowStyles: { fillColor: colors.rowEven },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
            1: { halign: 'left' },
            2: { cellWidth: 15, halign: 'center', fontStyle: 'bold', textColor: colors.accentBlue },
            3: { cellWidth: 15, halign: 'center', textColor: colors.textMuted },
            4: { cellWidth: 28, halign: 'right' },
            5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] as [number, number, number] },
        },
        margin: { top: 30, bottom: 20, left: margin.left, right: margin.right },
        didDrawPage: (data: { pageNumber: number }) => {
            if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
        }
    });

    // TOTAIS E OBSERVAÇÕES
    let finalY = (doc as any).lastAutoTable.finalY + 6;

    const totalVolumes = prePedido.itens.reduce((acc, item) => acc + Number(item.quantidade), 0);
    const valorCalculado = prePedido.itens.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.precoUnitario)), 0);

    const totalsWidth = 70;
    const totalsX = pageWidth - margin.right - totalsWidth;

    // Se a página estiver quase no fim, adiciona nova página para os totais
    if (finalY + 30 > pageHeight - 15) {
        doc.addPage();
        drawHeader(doc, (doc as any).internal.getNumberOfPages());
        finalY = 45;
    }

    doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
    doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsX, finalY, totalsWidth, 24, 1.5, 1.5, 'FD');

    let currentY = finalY + 6.5;

    // Total de Volumes
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    doc.text('Total de Volumes:', totalsX + 5, currentY);
    doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${totalVolumes}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });

    currentY += 6;

    // Quantidade de Itens
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    doc.text('Total de Itens:', totalsX + 5, currentY);
    doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
    doc.text(`${prePedido.itens.length}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });

    currentY += 7.5;

    // VALOR TOTAL
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
    doc.text('VALOR TOTAL:', totalsX + 5, currentY);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`R$ ${valorCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });

    // Observações ou Motivo da Rejeição se houver
    if (prePedido.motivoRejeicao) {
        doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
        const obsLines = doc.splitTextToSize(`Motivo da Rejeição: ${prePedido.motivoRejeicao}`, totalsX - margin.left - 10);
        const obsHeight = Math.max(14, obsLines.length * 4 + 6);
        doc.roundedRect(margin.left, finalY, totalsX - margin.left - 5, obsHeight, 1.5, 1.5, 'F');

        doc.setDrawColor(239, 68, 68); // Red
        doc.setLineWidth(1);
        doc.line(margin.left, finalY + 2, margin.left, finalY + obsHeight - 2);

        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'normal');
        doc.text(obsLines, margin.left + 4, finalY + 6);
    }

    // Rodapé em todas as páginas
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawFooter(doc, i, pageCount);
    }

    const clienteNomeClean = (cliente?.razaoSocial || 'Cliente').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const nomeArquivo = `PrePedido_${pedidoNumero}_${clienteNomeClean}.pdf`;
    doc.save(nomeArquivo);

    return nomeArquivo;
}
