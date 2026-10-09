---
name: Padrão Premium de Exportação de PDF
description: Define o layout, cores, funções auxiliares e boas práticas que devem ser estritamente seguidas ao implementar exportações para PDF em todo o ERP FRPlus.
---

# Padrão Premium de Exportação de PDF (FRPlus)

Ao criar ou refatorar funcionalidades de exportação para PDF (utilizando `jspdf` e `jspdf-autotable`), você DEVE seguir estritamente o layout corporativo "Premium" do ERP.

## 1. Importações e Inicialização
```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Para relatórios verticais (A4):
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

// Para relatórios horizontais (A4):
const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
```

## 2. Paleta de Cores Premium (Obrigatória)
Sempre adicione e utilize este dicionário de cores:
```typescript
const colors = {
    headerDark: [10, 10, 14] as [number, number, number],
    headerMid: [18, 18, 26] as [number, number, number],
    accentBlue: [37, 99, 235] as [number, number, number],
    accentCyan: [6, 182, 212] as [number, number, number],
    accentGold: [245, 158, 11] as [number, number, number],
    textDark: [20, 20, 30] as [number, number, number],
    textMuted: [120, 120, 140] as [number, number, number],
    textLight: [200, 200, 220] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    rowEven: [250, 251, 254] as [number, number, number],
    rowOdd: [255, 255, 255] as [number, number, number],
    factoryBg: [235, 238, 248] as [number, number, number],
    factoryAccent: [30, 64, 175] as [number, number, number],
    greenAccent: [16, 185, 129] as [number, number, number],
    purpleAccent: [124, 58, 237] as [number, number, number],
    tableBorder: [226, 232, 240] as [number, number, number],
};
```

## 3. Função Helper para Carregamento da Logo
```typescript
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
        
        let url = '/logo.png';
        if (url.startsWith('/')) {
            url = window.location.origin + url;
        }
        logoImg.src = url;
    });
};
// Uso: const logoResult = await loadLogo(); const logoData = logoResult?.data || null;
```

## 4. O Cabeçalho (drawHeader)
```typescript
const drawHeader = (pageDoc: jsPDF, pageNum: number, reportTitle: string) => {
    const headerHeight = 38;

    // Fundo escuro do header
    pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
    pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Filetes de detalhe (gradiente sutil simulado)
    pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
    pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
    pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
    pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

    // Logo
    if (logoData) {
        try {
            const logoH = 19.5;
            let logoW = 19.5;
            if (logoResult) {
                const aspect = logoResult.width / logoResult.height;
                logoW = logoH * aspect;
            }
            pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
        } catch { /* erro na logo */ }
    }

    // Título do Relatório
    pageDoc.setFontSize(13);
    pageDoc.setFont('helvetica', 'bold');
    pageDoc.setTextColor(255, 255, 255);
    pageDoc.text(reportTitle, pageWidth - margin.right, 14, { align: 'right' });

    // Informações de Emissão
    pageDoc.setFontSize(7);
    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

    if (pageNum > 1) {
        pageDoc.setFontSize(7);
        pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        pageDoc.text(`(Continuação)`, pageWidth - margin.right, 25, { align: 'right' });
    }

    return headerHeight + 5;
};
```

## 5. Rodapé (drawFooter)
Sempre adicione no final do script um loop percorrendo todas as páginas para injetar o rodapé.
```typescript
const drawFooter = (pageDoc: jsPDF, pageNum: number, totalPages: number, docName: string) => {
    const footerY = pageHeight - 12;

    pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
    pageDoc.setLineWidth(0.3);
    pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

    pageDoc.setFontSize(7);
    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
    pageDoc.text(`Documento confidencial • ${docName}`, pageWidth / 2, footerY, { align: 'center' });

    pageDoc.setFont('helvetica', 'bold');
    pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
};

// ... após a geração de todo o documento ...
const pages = doc.getNumberOfPages();
for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pages, 'Nome do Relatório');
}
```

## 6. O Padrão da Tabela (autoTable)
Sempre implemente com a configuração `headStyles` em `headerDark` e `alternateRowStyles` ativadas:
```typescript
autoTable(doc, {
    startY: currentY,
    head: [['COLUNA 1', 'COLUNA 2']],
    body: dados,
    styles: { 
        fontSize: 8, 
        cellPadding: 3, 
        halign: 'left', 
        valign: 'middle', 
        lineColor: colors.tableBorder, 
        lineWidth: 0.2 
    },
    headStyles: { 
        fillColor: colors.headerDark, 
        textColor: 255, 
        fontStyle: 'bold', 
        cellPadding: 4, 
        halign: 'center' 
    },
    alternateRowStyles: { 
        fillColor: colors.rowEven 
    },
    // Chame o drawHeader no evento didDrawPage para repintar as páginas seguintes
    didDrawPage: (dataObj: any) => {
        if (dataObj.pageNumber > 1) drawHeader(doc, dataObj.pageNumber, 'Nome');
    }
});
```

## 7. Cards KPI (Opcional, mas Recomendado)
Use este helper para desenhar cartões de resumo (Total Vendido, Comissões, etc.) de forma elegante acima da tabela:
```typescript
const drawKpiCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, 2.5, h, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    doc.text(label.toUpperCase(), x + 6, y + 6);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
    doc.text(value, x + 6, y + 13);
};
```
