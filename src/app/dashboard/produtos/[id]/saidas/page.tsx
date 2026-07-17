/* eslint-disable */
'use client';

import Link from "next/link";
import { Package, Hash, DollarSign, TrendingUp, Calendar, ArrowLeft, Loader2, Printer, Factory, Award, BarChart3, LineChart, X } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { getProdutoSaidas, ProdutoSaidasResponse } from "@/app/actions/produtoSaidas";
import { getPerfilEmpresa } from "@/app/actions/perfilEmpresa";
import { PrintHeader } from "@/components/ui/PrintHeader";

export default function ProdutoSaidasPage({ params }: { params: { id: string } }) {
    const { isIndustria } = useAuth();
    const { showToast } = useData();
    const router = useRouter();
    const [data, setData] = useState<ProdutoSaidasResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingPDF, setLoadingPDF] = useState(false);
    const [isChurnModalOpen, setIsChurnModalOpen] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isIndustria) {
            router.push('/dashboard/produtos');
            return;
        }
        getProdutoSaidas(params.id)
            .then(setData)
            .catch((err) => {
                console.error('Erro ao carregar saídas:', err);
                showToast('Erro ao carregar dados de saídas', 'error');
            })
            .finally(() => setLoading(false));
    }, [params.id, isIndustria, router, showToast]);

    // ═══════════════════════════════════════════
    // PDF EXPORT
    // ═══════════════════════════════════════════
    const handleExportPDF = useCallback(async () => {
        if (!data?.produto) return;
        setLoadingPDF(true);

        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            const perfilEmpresa = await getPerfilEmpresa();

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;

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
                barBlue: [59, 130, 246] as [number, number, number],
                barBlueDark: [29, 78, 216] as [number, number, number],
                emerald: [16, 185, 129] as [number, number, number],
            };

            // Load logo
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
            const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            // ═══════ HEADER ═══════
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

                pageDoc.setFontSize(12);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text(`RELATÓRIO DE SAÍDAS`, pageWidth - margin.right, 13, { align: 'right' });

                pageDoc.setFontSize(8);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                pageDoc.text(`${perfilEmpresa.nomeEmpresa}`, pageWidth - margin.right, 19, { align: 'right' });
                pageDoc.text(`Gerado em: ${dataGeracao}`, pageWidth - margin.right, 24, { align: 'right' });

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text('(Continuação)', pageWidth - margin.right, 30, { align: 'right' });
                }

                return headerHeight + 5;
            };

            // ═══════ FOOTER ═══════
            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;
                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento gerado eletronicamente', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`Página ${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            let startY = drawHeader(doc, 1);

            // ═══════ DADOS DO PRODUTO ═══════
            startY += 2;
            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 20, 1.5, 1.5, 'F');
            doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            doc.setLineWidth(1);
            doc.line(margin.left, startY + 2, margin.left, startY + 18);

            doc.setFontSize(7);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('DADOS DO PRODUTO', margin.left + 5, startY + 5.5);

            doc.setFontSize(10);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`${data.produto.codigo} — ${data.produto.nome}`, margin.left + 5, startY + 10.5);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fábrica: ${data.produto.fabricaNome}  |  Categoria: ${data.produto.categoria}  |  Unidade: ${data.produto.unidade}`, margin.left + 5, startY + 15.5);

            startY += 26;

            // ═══════ RESUMO ESTATÍSTICO EXECUTIVO ═══════
            if (data.estatisticasAvancadas) {
                const st = data.estatisticasAvancadas;
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.text('RESUMO ESTATÍSTICO EXECUTIVO', margin.left, startY);
                startY += 5;

                const statBoxWidth = (contentWidth - 6) / 4;
                const statBoxes = [
                    { label: 'Positivação (6m)', value: `${st.positivacao.percentual.toFixed(1)}%`, sub: `${st.positivacao.clientesCompraram} clientes` },
                    { label: 'Abandono (Churn)', value: `${st.abandono.clientesPerdidos}`, sub: 'clientes perdidos' },
                    { label: 'Preço Médio / Min', value: `R$ ${st.precos.medio.toFixed(2)}`, sub: `Min: R$ ${st.precos.minimo.toFixed(2)}` },
                    { label: 'Share Faturamento', value: `${st.shareFaturamento.toFixed(2)}%`, sub: 'da carteira global' }
                ];

                statBoxes.forEach((box, idx) => {
                    const bx = margin.left + idx * (statBoxWidth + 2);
                    doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                    doc.setLineWidth(0.3);
                    doc.setFillColor(252, 253, 255);
                    doc.roundedRect(bx, startY, statBoxWidth, 16, 1, 1, 'FD');

                    doc.setFontSize(6);
                    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    doc.setFont('helvetica', 'normal');
                    doc.text(box.label.toUpperCase(), bx + 3, startY + 5);

                    doc.setFontSize(9);
                    doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                    doc.setFont('helvetica', 'bold');
                    doc.text(box.value, bx + 3, startY + 10);
                    
                    doc.setFontSize(5.5);
                    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    doc.setFont('helvetica', 'normal');
                    doc.text(box.sub, bx + 3, startY + 14);
                });
                
                startY += 24;
            }

            // ═══════ GRÁFICO DE BARRAS ═══════
            const chartHeight = 50;
            const chartWidth = contentWidth;
            const chartStartX = margin.left;
            const chartStartY = startY;

            // Título do gráfico
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('VOLUME DE SAÍDAS — ÚLTIMOS 12 MESES', margin.left, startY);
            startY += 5;

            // Background do gráfico
            doc.setFillColor(250, 250, 254);
            doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
            doc.setLineWidth(0.2);
            doc.roundedRect(chartStartX, startY, chartWidth, chartHeight, 1, 1, 'FD');

            // Grid lines (4 linhas horizontais)
            const maxQtd = Math.max(...data.volumesMensais.map(v => v.quantidade), 1);
            for (let i = 1; i <= 4; i++) {
                const lineY = startY + chartHeight - (chartHeight * i / 5);
                doc.setDrawColor(230, 232, 240);
                doc.setLineWidth(0.1);
                doc.line(chartStartX + 2, lineY, chartStartX + chartWidth - 2, lineY);

                // Label do eixo Y
                const labelValue = Math.round(maxQtd * i / 5);
                doc.setFontSize(5.5);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(String(labelValue), chartStartX + 3, lineY - 0.5);
            }

            // Barras
            const barCount = data.volumesMensais.length;
            const barPadding = 3;
            const totalBarArea = chartWidth - 8;
            const barSpacing = totalBarArea / barCount;
            const barWidth = Math.min(barSpacing - 2, 12);

            data.volumesMensais.forEach((vol, idx) => {
                const barH = maxQtd > 0 ? (vol.quantidade / maxQtd) * (chartHeight - 12) : 0;
                const barX = chartStartX + 4 + (idx * barSpacing) + (barSpacing - barWidth) / 2;
                const barY = startY + chartHeight - barH - 4;

                if (vol.quantidade > 0) {
                    // Barra principal
                    doc.setFillColor(colors.barBlue[0], colors.barBlue[1], colors.barBlue[2]);
                    doc.roundedRect(barX, barY, barWidth, barH, 0.5, 0.5, 'F');

                    // Valor em cima da barra
                    doc.setFontSize(5);
                    doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                    doc.setFont('helvetica', 'bold');
                    doc.text(String(vol.quantidade), barX + barWidth / 2, barY - 1, { align: 'center' });
                } else {
                    // Barra mínima para meses sem vendas
                    doc.setFillColor(230, 230, 240);
                    doc.rect(barX, startY + chartHeight - 5, barWidth, 1, 'F');
                }

                // Label do mês
                const [mesNome] = vol.mes.split('/');
                doc.setFontSize(5);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(mesNome, barX + barWidth / 2, startY + chartHeight - 0.5, { align: 'center' });
            });

            startY += chartHeight + 6;

            // ═══════ KPIS ═══════
            const kpiWidth = contentWidth / 4 - 2;
            const kpis = [
                { label: 'Total Vendido', value: `${data.totais.quantidadeTotal} ${data.produto.unidade}` },
                { label: 'Faturamento', value: `R$ ${data.totais.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                { label: 'Média Mensal', value: `${data.totais.mediaMensal} ${data.produto.unidade}` },
                { label: 'Mês Pico', value: `${data.totais.mesPico}` },
            ];

            kpis.forEach((kpi, idx) => {
                const kpiX = margin.left + idx * (kpiWidth + 2.67);
                doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
                doc.roundedRect(kpiX, startY, kpiWidth, 14, 1, 1, 'F');

                doc.setFontSize(6);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(kpi.label.toUpperCase(), kpiX + 3, startY + 5);

                doc.setFontSize(9);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(kpi.value, kpiX + 3, startY + 11);
            });

            startY += 20;

            // ═══════ TABELA DE MOVIMENTAÇÃO ═══════
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('EXTRATO DE MOVIMENTAÇÃO', margin.left, startY);
            startY += 4;

            const tableData = data.ultimasSaidas.map((saida) => [
                saida.clienteNome.length > 35 ? saida.clienteNome.substring(0, 35) + '...' : saida.clienteNome,
                String(saida.quantidadeTotal),
                `R$ ${saida.precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${saida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                new Date(saida.ultimaCompra).toLocaleDateString('pt-BR')
            ]);

            autoTable(doc, {
                startY,
                head: [['CLIENTE', 'QTD TOTAL', 'PREÇO MÉDIO', 'VALOR TOTAL', 'ÚLTIMA COMPRA']],
                body: tableData,
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
                    halign: 'center',
                    valign: 'middle',
                    lineColor: colors.tableBorder,
                    lineWidth: 0.2,
                    textColor: colors.textDark
                },
                headStyles: {
                    fillColor: colors.headerDark,
                    textColor: 255,
                    fontStyle: 'bold',
                    cellPadding: 3
                },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { halign: 'left' },
                    1: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: colors.accentBlue },
                    2: { cellWidth: 26, halign: 'right' },
                    3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: colors.emerald },
                    4: { cellWidth: 26, halign: 'center' },
                },
                margin: { top: 44, bottom: 20, left: margin.left, right: margin.right },
                didDrawPage: (pageData: { pageNumber: number }) => {
                    if (pageData.pageNumber > 1) drawHeader(doc, pageData.pageNumber);
                }
            });

            // ═══════ ANEXO DE ABANDONO (CHURN) ═══════
            if (data.estatisticasAvancadas && data.estatisticasAvancadas.abandono.lista.length > 0) {
                let currentY = (doc as any).lastAutoTable.finalY + 15;
                if (currentY > pageHeight - 40) {
                    doc.addPage();
                    drawHeader(doc, (doc as any).internal.getNumberOfPages());
                    currentY = 44;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                doc.text('ANEXO: CLIENTES EM ABANDONO (SEM RECOMPRA)', margin.left, currentY);
                currentY += 6;

                const alertaLista = data.estatisticasAvancadas.abandono.lista.filter(c => c.diasAusente >= 90 && c.diasAusente < 180);
                const criticoLista = data.estatisticasAvancadas.abandono.lista.filter(c => c.diasAusente >= 180);

                const renderChurnTable = (title: string, list: any[], colorHeader: [number, number, number]) => {
                    if (list.length === 0) return;
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(colorHeader[0], colorHeader[1], colorHeader[2]);
                    doc.text(title, margin.left, currentY);
                    currentY += 4;

                    const churnData = list.map(c => [
                        c.nomeFantasia.length > 40 ? c.nomeFantasia.substring(0, 40) + '...' : c.nomeFantasia,
                        new Date(c.dataUltimaCompra).toLocaleDateString('pt-BR'),
                        `${c.diasAusente} dias`
                    ]);

                    autoTable(doc, {
                        startY: currentY,
                        head: [['CLIENTE', 'DATA DA ÚLTIMA COMPRA', 'DIAS AUSENTE']],
                        body: churnData,
                        styles: { fontSize: 7.5, cellPadding: 2, lineColor: colors.tableBorder, lineWidth: 0.1, textColor: colors.textDark },
                        headStyles: { fillColor: colorHeader, textColor: 255, fontStyle: 'bold' },
                        alternateRowStyles: { fillColor: colors.rowEven },
                        columnStyles: {
                            0: { halign: 'left' },
                            1: { cellWidth: 40, halign: 'center' },
                            2: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
                        },
                        margin: { top: 44, bottom: 20, left: margin.left, right: margin.right },
                        didDrawPage: (pageData: { pageNumber: number }) => {
                            if (pageData.pageNumber > 1) drawHeader(doc, pageData.pageNumber);
                        }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 10;
                };

                renderChurnTable(`Alerta: 3 Meses (90 a 179 dias) - ${alertaLista.length} clientes`, alertaLista, [245, 158, 11]); // Amber
                renderChurnTable(`Crítico: 6 Meses (180+ dias) - ${criticoLista.length} clientes`, criticoLista, [225, 29, 72]); // Rose
            }

            // Apply footer to all pages
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            // Save
            const nomeArquivo = `Saidas_${data.produto.codigo}_${data.produto.nome.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;
            doc.save(nomeArquivo);
            showToast(`PDF "${nomeArquivo}" exportado com sucesso!`, 'success');

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showToast('Erro ao gerar o PDF. Tente novamente.', 'error');
        } finally {
            setLoadingPDF(false);
        }
    }, [data, showToast]);

    // ═══════════════════════════════════════════
    // LOADING STATE
    // ═══════════════════════════════════════════
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-500">Carregando dados de saídas...</p>
                </div>
            </div>
        );
    }

    if (!data?.produto) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/produtos" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Produto não encontrado</h1>
                </div>
                <p className="text-gray-400">O produto solicitado não existe ou foi removido.</p>
            </div>
        );
    }

    const { produto, volumesMensais, ultimasSaidas, totais } = data;
    const maxQtd = Math.max(...volumesMensais.map(v => v.quantidade), 1);

    return (
        <div className="max-w-6xl mx-auto space-y-6 print:space-y-4 print:max-w-none">

            {/* ═══════ HEADER ═══════ */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/produtos" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-400" />
                            Saídas do Produto
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">{produto.codigo} — {produto.nome}</p>
                    </div>
                </div>
                <button
                    onClick={handleExportPDF}
                    disabled={loadingPDF}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 active:scale-95"
                >
                    {loadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Exportar Relatório
                </button>
            </div>

            {/* ═══════ PRINT HEADER ═══════ */}
            <PrintHeader 
                titulo="Relatório de Saídas do Produto" 
                subtitulo={`${produto.codigo} — ${produto.nome}`} 
            />

            {/* ═══════ DADOS DO PRODUTO (Card) ═══════ */}
            <div className="glass-panel rounded-xl p-4 print:border print:border-gray-300 print:bg-gray-50 animate-in">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5 print:border-gray-200">
                    <Package className="h-4 w-4 text-purple-400 print:text-purple-600" />
                    <span className="text-sm font-medium text-white print:text-black">Dados do Produto</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <span className="label-compact print:text-gray-500">Código</span>
                        <p className="text-sm font-semibold text-white print:text-black">{produto.codigo}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Nome</span>
                        <p className="text-sm font-semibold text-white print:text-black">{produto.nome}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Fábrica</span>
                        <p className="text-sm text-gray-300 print:text-gray-700 flex items-center gap-1">
                            <Factory className="h-3 w-3" />
                            {produto.fabricaNome}
                        </p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Categoria</span>
                        <p className="text-sm text-gray-300 print:text-gray-700">{produto.categoria}</p>
                    </div>
                </div>
            </div>

            {/* ═══════ RESUMO ESTATÍSTICO EXECUTIVO ═══════ */}
            {data.estatisticasAvancadas && (
                <div className="glass-panel rounded-xl p-4 border border-blue-500/20 shadow-lg shadow-blue-500/5 print:border print:border-gray-300 print:bg-white print:shadow-none animate-in" style={{ animationDelay: '0.05s' }}>
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5 print:border-gray-200">
                        <LineChart className="h-4 w-4 text-blue-400 print:text-blue-600" />
                        <span className="text-sm font-bold text-white print:text-black uppercase tracking-wider">Resumo Estatístico Executivo</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 print:border-gray-200 print:bg-gray-50">
                            <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Positivação (6m)</span>
                            <div className="text-xl font-bold text-blue-400 print:text-blue-600">{data.estatisticasAvancadas.positivacao.percentual.toFixed(1)}%</div>
                            <div className="text-xs text-gray-400 mt-1">{data.estatisticasAvancadas.positivacao.clientesCompraram} clientes compram</div>
                        </div>
                        <div 
                            onClick={() => setIsChurnModalOpen(true)}
                            className="bg-white/[0.02] p-3 rounded-lg border border-white/5 print:border-gray-200 print:bg-gray-50 cursor-pointer hover:bg-white/[0.04] hover:border-rose-500/30 transition-all group"
                        >
                            <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Abandono (Churn)</span>
                            <div className="text-xl font-bold text-rose-400 print:text-rose-600 group-hover:scale-105 transition-transform origin-left">{data.estatisticasAvancadas.abandono.clientesPerdidos}</div>
                            <div className="text-xs text-rose-400/70 mt-1 font-medium group-hover:text-rose-400">Clique para ver a lista</div>
                        </div>
                        <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 print:border-gray-200 print:bg-gray-50">
                            <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Preço Médio / Mín</span>
                            <div className="text-xl font-bold text-emerald-400 print:text-emerald-600">R$ {data.estatisticasAvancadas.precos.medio.toFixed(2)}</div>
                            <div className="text-xs text-gray-400 mt-1">Mínimo: R$ {data.estatisticasAvancadas.precos.minimo.toFixed(2)}</div>
                        </div>
                        <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 print:border-gray-200 print:bg-gray-50">
                            <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Share Faturamento</span>
                            <div className="text-xl font-bold text-amber-400 print:text-amber-600">{data.estatisticasAvancadas.shareFaturamento.toFixed(2)}%</div>
                            <div className="text-xs text-gray-400 mt-1">da carteira global (12m)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ KPIs ═══════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in" style={{ animationDelay: '0.1s' }}>
                <KPICard
                    icon={<Hash className="h-4 w-4" />}
                    label="Total Vendido"
                    value={`${totais.quantidadeTotal.toLocaleString('pt-BR')}`}
                    suffix={produto.unidade}
                    color="blue"
                />
                <KPICard
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Faturamento (12m)"
                    value={`R$ ${totais.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    color="emerald"
                />
                <KPICard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Média Mensal"
                    value={`${totais.mediaMensal.toLocaleString('pt-BR')}`}
                    suffix={produto.unidade}
                    color="cyan"
                />
                <KPICard
                    icon={<Award className="h-4 w-4" />}
                    label="Mês de Pico"
                    value={totais.mesPico}
                    suffix={`${totais.mesPicoQtd} ${produto.unidade}`}
                    color="amber"
                />
            </div>

            {/* ═══════ GRÁFICO DE BARRAS ═══════ */}
            <div ref={chartRef} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-6 shadow-2xl shadow-black/40 relative overflow-hidden animate-in print:border print:border-gray-300 print:bg-white print:shadow-none" style={{ animationDelay: '0.2s' }}>
                {/* Subtle background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none print:hidden" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none print:hidden" />

                {/* Header */}
                <div className="flex items-start justify-between mb-5 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-cyan-400 print:from-blue-600 print:to-blue-600" />
                            <h3 className="text-base font-semibold text-white/90 tracking-tight print:text-black">
                                Volume de Saídas — Últimos 12 Meses
                            </h3>
                        </div>
                        <p className="text-xs text-gray-500 ml-3">
                            {volumesMensais.filter(v => v.quantidade > 0).length} meses com movimentação
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5 print:text-gray-600">Total Período</p>
                        <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tabular-nums print:text-blue-600">
                            {totais.quantidadeTotal.toLocaleString('pt-BR')} {produto.unidade}
                        </p>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="w-full rounded-xl p-3 pb-1 flex items-end justify-between gap-[3px] overflow-hidden relative bg-white/[0.02] border border-white/[0.04] print:bg-gray-50 print:border-gray-200" style={{ height: '240px' }}>
                    {/* Grid lines */}
                    <div className="absolute inset-x-0 top-3 bottom-8 flex flex-col justify-between pointer-events-none px-3">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="w-full border-t border-dashed border-white/[0.06] print:border-gray-200" />
                        ))}
                    </div>

                    {volumesMensais.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                            Sem dados de saídas
                        </div>
                    ) : (
                        volumesMensais.map((vol, i) => {
                            const heightPct = maxQtd > 0 ? Math.max((vol.quantidade / maxQtd) * 100, 2) : 2;
                            const hasValue = vol.quantidade > 0;
                            const [mesLabel] = vol.mes.split('/');

                            return (
                                <div
                                    key={i}
                                    className="relative flex-1 h-full flex flex-col justify-end items-center group"
                                    title={`${vol.mes}: ${vol.quantidade} ${produto.unidade} — R$ ${vol.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                >
                                    {/* Hover tooltip */}
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 print:hidden">
                                        <div className="bg-gray-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white whitespace-nowrap shadow-xl">
                                            <div className="font-semibold text-blue-300">{vol.mes}</div>
                                            <div>{vol.quantidade} {produto.unidade}</div>
                                            <div className="text-emerald-400">R$ {vol.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </div>

                                    {/* Bar */}
                                    <div
                                        className={`w-full max-w-[48px] min-w-[12px] rounded-t transition-all duration-300 ${
                                            hasValue
                                                ? 'bg-gradient-to-t from-blue-600/80 to-cyan-400/70 group-hover:from-blue-500 group-hover:to-cyan-300 shadow-sm shadow-blue-500/20 group-hover:shadow-blue-400/40 print:from-blue-600 print:to-blue-500'
                                                : 'bg-white/[0.04] print:bg-gray-200'
                                        }`}
                                        style={{ height: hasValue ? `${heightPct}%` : '2%' }}
                                    />

                                    {/* Quantity label on bar */}
                                    {hasValue && (
                                        <div className="absolute w-full text-center text-[9px] font-bold text-blue-300 print:text-blue-700 tabular-nums" style={{ bottom: `calc(${heightPct}% + 4px)` }}>
                                            {vol.quantidade}
                                        </div>
                                    )}

                                    {/* Month Label */}
                                    <span className="text-[9px] mt-2 block h-4 text-center w-full tabular-nums text-gray-500 print:text-gray-600 font-medium">
                                        {mesLabel}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ═══════ TABELA ÚLTIMAS SAÍDAS ═══════ */}
            <div className="glass-panel rounded-xl overflow-hidden animate-in print:border print:border-gray-300 print:bg-white" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center gap-2 p-4 pb-3 border-b border-white/5 print:border-gray-200">
                    <Calendar className="h-4 w-4 text-cyan-400 print:text-cyan-600" />
                    <span className="text-sm font-medium text-white print:text-black">Últimas Saídas</span>
                    <span className="text-xs text-gray-500 ml-auto">{ultimasSaidas.length} registro{ultimasSaidas.length !== 1 ? 's' : ''}</span>
                </div>

                {ultimasSaidas.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        Nenhuma saída registrada nos últimos 12 meses.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5 print:border-gray-200">
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider print:text-gray-500">Cliente</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider print:text-gray-500">Qtd Total</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider print:text-gray-500">Preço Médio</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider print:text-gray-500">Valor Total</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider print:text-gray-500">Última Compra</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ultimasSaidas.map((saida, idx) => (
                                    <tr
                                        key={`cliente-${idx}`}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors print:border-gray-100 print:hover:bg-transparent"
                                    >
                                        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" title={saida.clienteNome}>
                                            <Link 
                                                href={`/dashboard/clientes/${saida.clienteId}/raio-x`}
                                                className="text-blue-400 hover:text-blue-300 hover:underline print:text-black print:no-underline transition-colors"
                                            >
                                                {saida.clienteNome}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-bold text-blue-400 print:text-blue-600 tabular-nums">
                                            {saida.quantidadeTotal}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-gray-300 print:text-gray-700 tabular-nums">
                                            R$ {saida.precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-400 print:text-emerald-600 tabular-nums">
                                            R$ {saida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-gray-300 print:text-gray-700 tabular-nums whitespace-nowrap">
                                            {new Date(saida.ultimaCompra).toLocaleDateString('pt-BR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Footer totals row */}
                            <tfoot>
                                <tr className="border-t border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-semibold text-white print:text-black">
                                        Total
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-400 print:text-blue-600 tabular-nums">
                                        {ultimasSaidas.reduce((acc, s) => acc + s.quantidadeTotal, 0).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-400 print:text-gray-500">
                                        —
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-emerald-600 tabular-nums">
                                        R$ {ultimasSaidas.reduce((acc, s) => acc + s.valorTotal, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-400 print:text-gray-500">
                                        —
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══════ PRINT ONLY: ANEXO DE CHURN ═══════ */}
            {data.estatisticasAvancadas && data.estatisticasAvancadas.abandono.lista.length > 0 && (
                <div className="hidden print:block mt-12" style={{ pageBreakBefore: 'always' }}>
                    <h2 className="text-xl font-bold text-black border-b-2 border-black pb-2 mb-6">
                        Anexo: Clientes em Abandono (Sem Recompra)
                    </h2>

                    {(() => {
                        const alertaLista = data.estatisticasAvancadas.abandono.lista.filter(c => c.diasAusente >= 90 && c.diasAusente < 180);
                        const criticoLista = data.estatisticasAvancadas.abandono.lista.filter(c => c.diasAusente >= 180);

                        return (
                            <div className="space-y-8">
                                {alertaLista.length > 0 && (
                                    <div>
                                        <h3 className="text-base font-bold text-amber-600 mb-2">Alerta: 3 Meses (90 a 179 dias)</h3>
                                        <table className="w-full text-sm border-collapse border border-gray-200">
                                            <thead>
                                                <tr className="bg-amber-100">
                                                    <th className="border border-gray-300 p-2 text-left text-amber-900">Cliente</th>
                                                    <th className="border border-gray-300 p-2 text-center text-amber-900 w-32">Última Compra</th>
                                                    <th className="border border-gray-300 p-2 text-right text-amber-900 w-32">Dias Ausente</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {alertaLista.map(c => (
                                                    <tr key={c.id}>
                                                        <td className="border border-gray-200 p-2 text-black font-medium">{c.nomeFantasia}</td>
                                                        <td className="border border-gray-200 p-2 text-black text-center">{new Date(c.dataUltimaCompra).toLocaleDateString('pt-BR')}</td>
                                                        <td className="border border-gray-200 p-2 text-black text-right">{c.diasAusente}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {criticoLista.length > 0 && (
                                    <div>
                                        <h3 className="text-base font-bold text-rose-600 mb-2">Crítico: 6 Meses (180+ dias)</h3>
                                        <table className="w-full text-sm border-collapse border border-gray-200">
                                            <thead>
                                                <tr className="bg-rose-100">
                                                    <th className="border border-gray-300 p-2 text-left text-rose-900">Cliente</th>
                                                    <th className="border border-gray-300 p-2 text-center text-rose-900 w-32">Última Compra</th>
                                                    <th className="border border-gray-300 p-2 text-right text-rose-900 w-32">Dias Ausente</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criticoLista.map(c => (
                                                    <tr key={c.id}>
                                                        <td className="border border-gray-200 p-2 text-black font-medium">{c.nomeFantasia}</td>
                                                        <td className="border border-gray-200 p-2 text-black text-center">{new Date(c.dataUltimaCompra).toLocaleDateString('pt-BR')}</td>
                                                        <td className="border border-gray-200 p-2 text-black text-right font-bold">{c.diasAusente}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ═══════ CHURN MODAL ═══════ */}
            {isChurnModalOpen && data?.estatisticasAvancadas && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black/50 slide-in-from-bottom-4 animate-in duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-white/5">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-rose-500" />
                                    Clientes em Abandono
                                </h2>
                                <p className="text-sm text-gray-400 mt-0.5">{produto.nome}</p>
                            </div>
                            <button 
                                onClick={() => setIsChurnModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                            {data.estatisticasAvancadas.abandono.lista && data.estatisticasAvancadas.abandono.lista.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="pb-3 text-left font-semibold text-gray-400">Cliente</th>
                                            <th className="pb-3 text-center font-semibold text-gray-400">Última Compra</th>
                                            <th className="pb-3 text-right font-semibold text-gray-400">Dias Ausente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.estatisticasAvancadas.abandono.lista.map((c) => (
                                            <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                                <td className="py-3 font-medium">
                                                    <Link 
                                                        href={`/dashboard/clientes/${c.id}/raio-x`}
                                                        className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                                    >
                                                        {c.nomeFantasia}
                                                    </Link>
                                                </td>
                                                <td className="py-3 text-center text-gray-300 tabular-nums">
                                                    {new Date(c.dataUltimaCompra).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="py-3 text-right font-bold text-rose-400 tabular-nums">
                                                    {c.diasAusente} dias
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    Nenhum cliente em abandono encontrado para este produto.
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 border-t border-white/5 bg-white/[0.01] rounded-b-2xl flex justify-end">
                            <button 
                                onClick={() => setIsChurnModalOpen(false)}
                                className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════
// KPI Card Component
// ═══════════════════════════════════════════
function KPICard({ icon, label, value, suffix, color }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    suffix?: string;
    color: 'blue' | 'emerald' | 'cyan' | 'amber';
}) {
    const colorClasses = {
        blue: {
            iconBg: 'bg-blue-500/10',
            iconText: 'text-blue-400',
            valueText: 'text-blue-400',
            printIcon: 'print:text-blue-600',
            printValue: 'print:text-blue-700',
        },
        emerald: {
            iconBg: 'bg-emerald-500/10',
            iconText: 'text-emerald-400',
            valueText: 'text-emerald-400',
            printIcon: 'print:text-emerald-600',
            printValue: 'print:text-emerald-700',
        },
        cyan: {
            iconBg: 'bg-cyan-500/10',
            iconText: 'text-cyan-400',
            valueText: 'text-cyan-400',
            printIcon: 'print:text-cyan-600',
            printValue: 'print:text-cyan-700',
        },
        amber: {
            iconBg: 'bg-amber-500/10',
            iconText: 'text-amber-400',
            valueText: 'text-amber-400',
            printIcon: 'print:text-amber-600',
            printValue: 'print:text-amber-700',
        },
    };

    const c = colorClasses[color];

    return (
        <div className="glass-panel rounded-xl p-3.5 print:border print:border-gray-200 print:bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${c.iconBg} print:bg-gray-100`}>
                    <span className={`${c.iconText} ${c.printIcon}`}>{icon}</span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold print:text-gray-600">{label}</span>
            </div>
            <p className={`text-lg font-bold ${c.valueText} ${c.printValue} tabular-nums leading-tight`}>
                {value}
            </p>
            {suffix && (
                <p className="text-[10px] text-gray-500 mt-0.5 print:text-gray-500">{suffix}</p>
            )}
        </div>
    );
}
