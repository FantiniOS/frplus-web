import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Função para buscar e converter a imagem para Base64 (mesmo padrão do sistema)
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

// Tipo simplificado com base no RegistroPreco do page.tsx
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

export async function generateCentralPrecosPDF(data: PrecoPDFData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = { left: 14, right: 14 };

    const contentW = pageWidth - margin.left - margin.right;
    let y = 0;

    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // PALETA PREMIUM (Padrão do sistema)
    const C = {
        dark: [10, 10, 14] as [number, number, number],
        blue: [37, 99, 235] as [number, number, number],
        cyan: [6, 182, 212] as [number, number, number],
        amber: [245, 158, 11] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        border: [226, 232, 240] as [number, number, number],
        rowAlt: [248, 250, 252] as [number, number, number],
        textDark: [15, 23, 42] as [number, number, number],
        textBody: [51, 65, 85] as [number, number, number],
        textMuted: [100, 116, 139] as [number, number, number],
        textLight: [203, 213, 225] as [number, number, number],
        bgLight: [255, 255, 255] as [number, number, number],
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
        doc.text('RELATÓRIO DE MONITORAMENTO', pageWidth - margin.right, 14, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        doc.text('Central de Preços', pageWidth - margin.right, 20, { align: 'right' });

        doc.setFontSize(7);
        doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
        doc.text(`Gerado em: ${dateStr} às ${timeStr}`, pageWidth - margin.right, 26, { align: 'right' });
    };

    const drawFooter = (pageNumber: number, pageCount: number) => {
        const footerY = pageHeight - 10;
        doc.setFontSize(7);
        doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
        doc.text('FRPlus - Inteligência Comercial', margin.left, footerY);
        doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin.right, footerY, { align: 'right' });
    };

    drawHeader();
    y = 50;

    // Resumo e Filtros Aplicados
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text('RESUMO DE COLETA', margin.left, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textBody[0], C.textBody[1], C.textBody[2]);
    
    const filtrosTexto = [];
    if (data.filtros.busca) filtrosTexto.push(`Busca: ${data.filtros.busca}`);
    if (data.filtros.marca) filtrosTexto.push(`Marca: ${data.filtros.marca}`);
    if (data.filtros.coletor) filtrosTexto.push(`Coletor: ${data.filtros.coletor}`);
    
    doc.text(`Filtros: ${filtrosTexto.length ? filtrosTexto.join(' | ') : 'Nenhum filtro aplicado'}`, margin.left, y);
    y += 5;
    doc.text(`Total de Registros (nesta visualização): ${data.stats.total}`, margin.left, y);
    y += 5;
    doc.text(`Menor Preço (nesta visualização): ${data.stats.menorPreco ? formatCurrency(data.stats.menorPreco) : '-'} ${data.stats.menorLocal ? `(${data.stats.menorLocal})` : ''}`, margin.left, y);
    y += 10;

    // Tabela de Dados
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(margin.left, y, 2.5, 4.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text('HISTÓRICO DE PREÇOS', margin.left + 5, y + 4);
    y += 7;

    const tableData = data.registros.length > 0 ? data.registros.map(r => {
        const dataStr = new Date(r.dataColeta).toLocaleDateString('pt-BR');
        const clienteNome = r.cliente ? (r.cliente.nomeFantasia || r.cliente.razaoSocial) : '-';
        const vendedorNome = r.vendedor ? r.vendedor.nome : 'Admin';
        
        return [
            dataStr,
            clienteNome,
            r.produtoBase,
            r.marcaConcorrente?.nome || '',
            formatCurrency(r.precoPrateleira),
            vendedorNome
        ];
    }) : [['-', 'Nenhum registro encontrado', '-', '-', '-', '-']];

    autoTable(doc, {
        startY: y,
        head: [["DATA", "CLIENTE", "PRODUTO", "CONCORRENTE", "PREÇO", "QUEM COLETOU"]],
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
            fillColor: C.bgLight,
            textColor: C.textDark,
            fontStyle: 'bold',
            lineWidth: { bottom: 0.5 },
            lineColor: C.border,
        },
        alternateRowStyles: {
            fillColor: C.rowAlt,
        },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) {
                drawHeader();
            }
        },
        margin: { top: 45, left: margin.left, right: margin.right, bottom: 15 },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        drawFooter(i, pages);
    }

    doc.save(`central-precos-${new Date().getTime()}.pdf`);
}
