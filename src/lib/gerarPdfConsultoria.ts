import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Re-declare jsPDF autotable interface so typescript doesn't complain
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface jsPDFCustom extends jsPDF {
    lastAutoTable: { finalY: number };
}

// === Image helper para PDF ===
async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        let finalUrl = url;
        if (url.startsWith('/')) {
            // Em client-side
            if (typeof window !== 'undefined') {
                finalUrl = window.location.origin + url;
            }
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
        precoUnitario: number;
        quantidade: number;
        subtotal: number;
        coberturaDias: number;
    }>;
    itemBonificado: {
        nome: string;
        unidade: string;
        quantidade: number;
    } | null;
    totalPedido: number;
    verbaGerada: number;
    lucroImediato: number;
}

export async function gerarPdfConsultoria(payload: PayloadConsultoria) {
    const doc = new jsPDF('p', 'mm', 'a4') as jsPDFCustom;
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabeçalho de Autoridade Corporativo (Preto Absoluto)
    doc.setFillColor(0, 0, 0); // Preto Absoluto
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Logo
    const logoResult = await getBase64Image('/logo.png');
    if (logoResult) {
        try {
            const maxLogoW = 40;
            const maxLogoH = 20;
            const logoRatio = Math.min(maxLogoW / logoResult.width, maxLogoH / logoResult.height);
            doc.addImage(logoResult.data, 'PNG', 15, 10, logoResult.width * logoRatio, logoResult.height * logoRatio);
        } catch (e) { /* ignore */ }
    }

    // Título Frontal
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("PLANO DE ABASTECIMENTO ESTRATÉGICO", pageWidth - 15, 18, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Para contrastar perfeitamente sobre o fundo preto, os textos secundários ficam branco ou cinza bem claro
    doc.setTextColor(230, 240, 250); 
    doc.text(`Parceria Comercial: ${payload.fabrica}`, pageWidth - 15, 25, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Perfil do Negócio: ${payload.perfil}`, pageWidth - 15, 30, { align: 'right' });
    doc.text(`Data da Simulação: ${payload.data}`, pageWidth - 15, 35, { align: 'right' });

    // 2. Subtítulo Seção Curva A
    let yCursor = 55;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Mapeamento do Mix Ideal (Curva A de Curto a Médio Prazo)", 15, yCursor);
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, yCursor + 3, pageWidth - 15, yCursor + 3);
    yCursor += 10;

    // 3. Tabela AutoTable Zebrada Oficial
    const tableBody = payload.itensPagos.map((item) => [
        item.nome,
        `${item.quantidade}`,
        item.unidade,
        formatBRL(item.precoUnitario),
        formatBRL(item.subtotal),
        item.coberturaDias > 0 ? `${item.coberturaDias} dias` : 'S/ Ref.'
    ]);

    autoTable(doc, {
        startY: yCursor,
        head: [['Produto', 'Qtd Sugerida', 'Embalagem', 'Preço Unit.', 'Subtotal', 'Cobertura Estimada']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: 50, fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 70 }, // Produto
            1: { halign: 'center' }, // Qtd
            2: { halign: 'center' }, // Emb
            3: { halign: 'right' }, // Preco Unit
            4: { halign: 'right' }, // Subtotal
            5: { halign: 'center' }, // Cobertura
        },
        margin: { left: 15, right: 15 }
    });

    yCursor = (doc as any).lastAutoTable.finalY + 15;

    if (yCursor > 220) {
        doc.addPage();
        yCursor = 20;
    }

    // 4. Destaque de Bonificação (O 'Cheque' do Cliente) - CÓDIGO DA DIRETRIZ
    doc.setFillColor(245, 247, 250); // Fundo Cinza Geral
    doc.setDrawColor(220, 226, 230);
    doc.roundedRect(15, yCursor, pageWidth - 30, 45, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185); 
    doc.setFontSize(12);
    doc.text("RESUMO DO INVESTIMENTO", 20, yCursor + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); 
    
    // Totais
    doc.text(`Valor Total em Produtos:`, 20, yCursor + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); 
    doc.text(formatBRL(payload.totalPedido), 80, yCursor + 16);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Verba de Introdução (${payload.bonusPorcentagem}%):`, 20, yCursor + 23);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185); 
    doc.text(formatBRL(payload.verbaGerada), 80, yCursor + 23);

    // Bloco Superior de Destaque da DIRETRIZ EXATA
    if (payload.itemBonificado) {
        doc.setFillColor(240, 240, 240); // Fundo cinza claro da DIRETRIZ
        doc.setDrawColor(200, 200, 200);
        doc.rect(20, yCursor + 28, pageWidth - 40, 12, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        
        const iscaName = payload.itemBonificado.nome.replace('[BONIFICAÇÃO] ', '');
        const fraseQtde = `${payload.itemBonificado.quantidade} Caixas de ${iscaName}`;
        
        // Separa impacto e grito em duas fontes ou concatena
        doc.text(fraseQtde, 25, yCursor + 35.5);
        
        doc.setTextColor(41, 128, 185);
        doc.setFontSize(10);
        const custoZeroLabel = "(CUSTO ZERO PARA O CLIENTE)";
        doc.text(custoZeroLabel, pageWidth - 25 - doc.getTextWidth(custoZeroLabel), yCursor + 35.5);
    }

    // Disclaimer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    const disclaimer = `* A métrica de cobertura de dias é uma estimativa estatística de probabilidade preditiva baseada nos últimos 180 dias de histórico da tabela do cliente alvo. Valores finais sujeitos a análise da indústria e disponibilidade de estoque.`;
    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 30);
    doc.text(splitDisclaimer, 15, yCursor + 60);

    // Save PDF
    const dataClean = payload.data.replace(/\//g, '-');
    const fabricaClean = payload.fabrica.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Plano_Estrategico_${fabricaClean}_${dataClean}.pdf`);
}
