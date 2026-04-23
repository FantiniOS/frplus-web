'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Filter,
    Loader2,
    FileText,
    Users,
    Download,
    Receipt,
    FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Vendedor {
    id: string;
    nome: string;
    percentualComissao: number | string;
}

interface DetalhePedido {
    id: string;
    data: string;
    clienteNome: string;
    vendedorNome: string;
    valorVenda: number;
    valorComissao: number;
    notaFiscal: string | null;
}

interface ReportData {
    totalVendido: number;
    totalComissoes: number;
    totalPedidos: number;
    detalhamento: DetalhePedido[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

export default function ComissoesPage() {
    const [vendedores, setVendedores] = useState<Vendedor[]>([]);
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingVendedores, setLoadingVendedores] = useState(true);
    const [exportando, setExportando] = useState(false);

    // Filters
    const [vendedorId, setVendedorId] = useState('todos');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');

    // Load vendedores list
    useEffect(() => {
        fetch('/api/vendedores?ativo=true')
            .then(r => r.json())
            .then(data => {
                setVendedores(data);
                setLoadingVendedores(false);
            })
            .catch(() => setLoadingVendedores(false));
    }, []);

    // Set default dates (current month)
    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setDataInicio(firstDay.toISOString().split('T')[0]);
        setDataFim(lastDay.toISOString().split('T')[0]);
    }, []);

    const fetchReport = useCallback(async () => {
        if (!dataInicio || !dataFim) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (vendedorId !== 'todos') params.set('vendedorId', vendedorId);
            if (dataInicio) params.set('dataInicio', dataInicio);
            if (dataFim) params.set('dataFim', dataFim);

            const res = await fetch(`/api/relatorios/comissoes?${params.toString()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setReport(data);
            }
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setLoading(false);
        }
    }, [vendedorId, dataInicio, dataFim]);

    // Auto-fetch when filters change
    useEffect(() => {
        if (dataInicio && dataFim) {
            fetchReport();
        }
    }, [fetchReport, dataInicio, dataFim]);

    // Export to CSV
    const exportCSV = () => {
        if (!report || report.detalhamento.length === 0) return;

        const headers = ['Data', 'Cliente', 'Vendedor', 'Nota Fiscal', 'Valor Venda', 'Valor Comissão'];
        const rows = report.detalhamento.map(d => [
            formatDate(d.data),
            d.clienteNome,
            d.vendedorNome,
            d.notaFiscal || '',
            d.valorVenda.toFixed(2).replace('.', ','),
            d.valorComissao.toFixed(2).replace('.', ','),
        ]);

        // Add totals row
        rows.push(['', '', '', 'TOTAL', report.totalVendido.toFixed(2).replace('.', ','), report.totalComissoes.toFixed(2).replace('.', ',')]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comissoes_${dataInicio}_${dataFim}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const percentualComissaoMedia = report && report.totalVendido > 0
        ? ((report.totalComissoes / report.totalVendido) * 100).toFixed(1)
        : '0.0';

    const exportPDF = async () => {
        setExportando(true);
        if (!report || report.detalhamento.length === 0) {
            setExportando(false);
            return;
        }

        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;

            // ====== PREMIUM COLOR PALETTE ======
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

            // ====== LOGO LOADER (reusable) ======
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

            const selectedVendedor = vendedorId === 'todos' 
                ? 'Todos os Vendedores' 
                : vendedores.find(v => v.id === vendedorId)?.nome || 'Vendedor Desconhecido';

            // ====== DRAW PREMIUM HEADER ======
            const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
                const headerHeight = 38;

                // Dark gradient header background
                pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');

                // Subtle gradient band at bottom of header
                pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
                // Cyan accent fade
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
                    } catch { /* ignore logo errors */ }
                }

                // Report title
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text('Relatório de Comissões', pageWidth - margin.right, 14, { align: 'right' });

                // Date & meta info
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

                pageDoc.text(
                    `Período: ${formatDate(dataInicio)} — ${formatDate(dataFim)}`,
                    pageWidth - margin.right, 25, { align: 'right' }
                );

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text(`(Continuação)`, pageWidth - margin.right, 30, { align: 'right' });
                }

                return headerHeight + 5;
            };

            // ====== DRAW PREMIUM FOOTER ======
            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;

                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento confidencial • Comissões sujeitas à conferência', pageWidth / 2, footerY, { align: 'center' });

                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            // ====== HELPER: Draw KPI Card ======
            const drawKpiCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) => {
                doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
                doc.roundedRect(x, y, w, h, 2, 2, 'F');

                doc.setFillColor(color[0], color[1], color[2]);
                doc.rect(x, y, 2.5, h, 'F');

                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(label.toUpperCase(), x + 6, y + 6);

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.text(value, x + 6, y + 14);
            };

            let startY = drawHeader(doc, 1);

            // ---- KPI SUMMARY CARDS ----
            startY += 2;
            const gap = 4;
            const cardW = (contentWidth - gap) / 2;
            const cardH = 18;

            drawKpiCard(margin.left, startY, cardW, cardH, 'Total Vendido',
                `R$ ${report.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                colors.accentBlue);
            drawKpiCard(margin.left + cardW + gap, startY, cardW, cardH, 'Comissões a Pagar',
                `R$ ${report.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                colors.accentGold);

            startY += cardH + 6;

            // Subtitle badge for Vendedor info
            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 9, 1.5, 1.5, 'F');
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.factoryAccent[0], colors.factoryAccent[1], colors.factoryAccent[2]);
            doc.text(`Vendedor: ${selectedVendedor}`, margin.left + 5, startY + 6);
            
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.text(`Taxa Média Aplicada: ${percentualComissaoMedia}%`, pageWidth - margin.right - 5, startY + 6, { align: 'right' });
            
            startY += 12;

            // ---- TABLE DATA ----
            autoTable(doc, {
                startY,
                head: [['Data', 'Cliente', 'Vendedor', 'NF', 'Valor Venda', 'Comissão']],
                body: report.detalhamento.map(d => [
                    formatDate(d.data),
                    d.clienteNome,
                    d.vendedorNome,
                    d.notaFiscal || '—',
                    `R$ ${d.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${d.valorComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
                styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2 },
                headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 20 },
                    1: { halign: 'left' },
                    2: { halign: 'center' },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { halign: 'right', fontStyle: 'bold' },
                    5: { halign: 'right', fontStyle: 'bold', textColor: colors.accentGold }
                },
                foot: [['', '', '', 'TOTAL', 
                    `R$ ${report.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${report.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                margin: { top: startY, left: margin.left, right: margin.right },
                didDrawPage: (data: { pageNumber: number }) => {
                    if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                }
            });

            // ====== APPLY FOOTERS TO ALL PAGES ======
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            // ====== SAVE ======
            const fileName = `FRPlus_Comissoes_${selectedVendedor.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setExportando(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Relatório de Comissões</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Acompanhe vendas e comissões dos vendedores
                    </p>
                </div>
                {report && report.detalhamento.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 rounded-xl bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all border border-white/10"
                        >
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </button>
                        <button
                            onClick={exportPDF}
                            disabled={exportando}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 disabled:opacity-50"
                        >
                            <FileDown className="h-4 w-4" />
                            {exportando ? 'Gerando...' : 'Exportar PDF'}
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">Filtros</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Vendedor</label>
                        <select
                            value={vendedorId}
                            onChange={(e) => setVendedorId(e.target.value)}
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            disabled={loadingVendedores}
                        >
                            <option value="todos" className="bg-[#1a1f2e] text-white">Todos os Vendedores</option>
                            {vendedores.map(v => (
                                <option key={v.id} value={v.id} className="bg-[#1a1f2e] text-white">{v.nome}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Data Início</label>
                        <input
                            type="date"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Data Fim</label>
                        <input
                            type="date"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                    <span className="ml-3 text-sm text-gray-400">Carregando relatório...</span>
                </div>
            )}

            {/* Report Content */}
            {!loading && report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/15">
                                    <TrendingUp className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Total Vendido no Período</p>
                                    <p className="text-xl font-bold text-white">{formatCurrency(report.totalVendido)}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{report.totalPedidos} pedidos</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/15">
                                    <DollarSign className="h-5 w-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Total de Comissões a Pagar</p>
                                    <p className="text-xl font-bold text-amber-400">{formatCurrency(report.totalComissoes)}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{percentualComissaoMedia}% média</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detail Table */}
                    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-medium text-white">Detalhamento dos Pedidos</span>
                            </div>
                            <span className="text-xs text-gray-500">{report.detalhamento.length} registro(s)</span>
                        </div>

                        {report.detalhamento.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                                <Receipt className="h-10 w-10 mb-3 opacity-40" />
                                <p className="text-sm">Nenhum pedido encontrado</p>
                                <p className="text-xs text-gray-600 mt-1">Ajuste os filtros acima para visualizar resultados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Data
                                            </th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Cliente
                                            </th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Vendedor
                                            </th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                NF
                                            </th>
                                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Valor da Venda
                                            </th>
                                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Comissão
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {report.detalhamento.map(item => (
                                            <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="px-5 py-3 text-sm text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                                                        {formatDate(item.data)}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-sm text-white font-medium max-w-[200px] truncate">
                                                    {item.clienteNome}
                                                </td>
                                                <td className="px-5 py-3 text-sm text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-xs font-bold">
                                                            {item.vendedorNome.charAt(0)}
                                                        </div>
                                                        {item.vendedorNome}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-sm text-gray-500">
                                                    {item.notaFiscal || '—'}
                                                </td>
                                                <td className="px-5 py-3 text-sm text-right text-white font-medium">
                                                    {formatCurrency(item.valorVenda)}
                                                </td>
                                                <td className="px-5 py-3 text-sm text-right">
                                                    <span className="text-amber-400 font-semibold">
                                                        {formatCurrency(item.valorComissao)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-white/10 bg-white/[0.02]">
                                            <td colSpan={4} className="px-5 py-3 text-sm font-bold text-white text-right">
                                                TOTAL
                                            </td>
                                            <td className="px-5 py-3 text-sm text-right font-bold text-white">
                                                {formatCurrency(report.totalVendido)}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-right font-bold text-amber-400">
                                                {formatCurrency(report.totalComissoes)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
