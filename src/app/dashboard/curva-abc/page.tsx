"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    Filter,
    Search,
    TrendingUp,
    Package,
    DollarSign,
    Download,
    FileDown
} from "lucide-react";

import { MonthSelector } from "@/components/ui/MonthSelector";
import { buscarClientesParaSelect } from "./actions";

interface Cliente {
    id: string;
    nomeFantasia: string;
    cnpj: string;
}

interface CurvaItem {
    posicao: number;
    produtoId: string;
    nomeProduto: string;
    marca: string;
    quantidade: number;
    valorTotal: number;
    curva: string;
}

interface CurvaSummary {
    totalCaixas: number;
    totalFaturado: number;
}

export default function CurvaABCPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [selectedCliente, setSelectedCliente] = useState<string>('');

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    const [loading, setLoading] = useState(false);
    const [exportando, setExportando] = useState(false);
    const [resultados, setResultados] = useState<CurvaItem[]>([]);
    const [summary, setSummary] = useState<CurvaSummary | null>(null);

    // Fetch clients on mount
    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const data = await buscarClientesParaSelect();
                if (Array.isArray(data)) {
                    setClientes(data);
                }
            } catch (error) {
                console.error("Erro ao carregar clientes", error);
            }
        };
        fetchClientes();
    }, []);

    const handleGerarAnalise = async () => {
        if (!selectedCliente) {
            alert("Selecione um cliente para gerar a Curva ABC.");
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('clienteId', selectedCliente);

            if (selectedMonth) {
                const [yearStr, monthStr] = selectedMonth.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr) - 1; // JS months are 0-indexed

                const startOfMonth = new Date(year, month, 1);
                const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

                params.append('dataInicio', startOfMonth.toISOString());
                params.append('dataFim', endOfMonth.toISOString());
            }

            const res = await fetch(`/api/curva-abc?${params.toString()}`);
            if (!res.ok) {
                throw new Error("Erro na busca da Curva ABC");
            }

            const data = await res.json();
            setResultados(data.data || []);
            setSummary(data.summary || null);

        } catch (error) {
            console.error(error);
            alert("Falha ao gerar o relatório.");
        } finally {
            setLoading(false);
        }
    };

    const getCurvaBadgeColor = (curva: string) => {
        switch (curva) {
            case 'A': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'B': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'C': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
            default: return 'bg-zinc-500/10 text-zinc-400';
        }
    }

    // ====== PREMIUM PDF EXPORT ENGINE ======
    const handleExportPDF = async () => {
        if (!summary || resultados.length === 0) return;
        setExportando(true);

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
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
                textLight: [200, 200, 220] as [number, number, number],
                white: [255, 255, 255] as [number, number, number],
                rowEven: [250, 251, 254] as [number, number, number],
                greenAccent: [16, 185, 129] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
            };

            // ====== LOGO LOADER ======
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

            // Header Helper
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
                            logoW = logoH * (logoResult.width / logoResult.height);
                        }
                        pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
                    } catch { }
                }

                const logoRenderedW = (logoData && logoResult) ? (19.5 * logoResult.width / logoResult.height) : 0;
                const titleX = logoData ? margin.left + logoRenderedW + 6 : margin.left;
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.setFontSize(18);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text('FRPlus', titleX, 16);

                pageDoc.setFontSize(7.5);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                pageDoc.text('Gestão Comercial Inteligente', titleX, 21.5);

                const clientName = clientes.find(c => c.id === selectedCliente)?.nomeFantasia || 'Cliente Desconhecido';

                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text('Análise de Curva ABC', pageWidth - margin.right, 14, { align: 'right' });

                pageDoc.setFontSize(9);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                pageDoc.text(clientName, pageWidth - margin.right, 20, { align: 'right' });

                pageDoc.setFontSize(7);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Mês Referência: ${selectedMonth.split('-').reverse().join('/')}  •  Emitido em ${dateStr}`, pageWidth - margin.right, 25, { align: 'right' });

                if (pageNum > 1) {
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text(`(Continuação)`, pageWidth - margin.right, 30, { align: 'right' });
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
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento gerado pelo módulo analítico', pageWidth / 2, footerY, { align: 'center' });

                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

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
            startY += 2;

            // KPI CARDS
            const cardW = (contentWidth - 4) / 2;
            const cardH = 18;
            drawKpiCard(margin.left, startY, cardW, cardH, 'Volume Físico Total Escoado', `${summary.totalCaixas.toLocaleString('pt-BR')} caixas/unid.`, colors.accentBlue);
            drawKpiCard(margin.left + cardW + 4, startY, cardW, cardH, 'Faturamento Global', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalFaturado), colors.greenAccent);

            startY += cardH + 6;

            // TABLE DATA
            autoTable(doc, {
                startY,
                head: [['Pos.', 'Produto', 'Marca', 'Curva', 'Volume', 'Total Faturado']],
                body: resultados.map(item => [
                    `${item.posicao}º`,
                    item.nomeProduto,
                    item.marca || '-',
                    item.curva,
                    item.quantidade.toLocaleString('pt-BR'),
                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)
                ]),
                styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2 },
                headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
                    1: { halign: 'left' },
                    2: { halign: 'left' },
                    3: { halign: 'center', fontStyle: 'bold' },
                    4: { halign: 'right', fontStyle: 'bold', textColor: colors.accentBlue },
                    5: { halign: 'right', fontStyle: 'bold', textColor: colors.greenAccent }
                },
                foot: [['', '', '', 'TOTAL', summary.totalCaixas.toLocaleString('pt-BR'), new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalFaturado)]],
                footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                margin: { top: startY, left: margin.left, right: margin.right },
                didDrawPage: (data: { pageNumber: number }) => {
                    if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                }
            });

            // Footers
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            const clientName = clientes.find(c => c.id === selectedCliente)?.nomeFantasia || 'Cliente';
            doc.save(`CurvaABC_${clientName.replace(/ /g, '_')}_${selectedMonth}.pdf`);

        } catch (error) {
            console.error('Erro ao exportar PDF Curva ABC:', error);
            alert("Erro ao processar PDF.");
        } finally {
            setExportando(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Filter className="h-6 w-6 text-emerald-400" />
                        Curva ABC de Vendas
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Analise o ranking de volume (caixas/unidades) transacionado por um cliente específico.
                    </p>
                </div>

                {resultados.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportPDF}
                            disabled={exportando}
                            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                        >
                            <FileDown className="h-4 w-4" />
                            {exportando ? 'Gerando...' : 'Exportar PDF'}
                        </button>
                    </div>
                )}
            </div>

            {/* FILTROS */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 lg:p-6 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Cliente *
                        </label>
                        <select
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={selectedCliente}
                            onChange={(e) => setSelectedCliente(e.target.value)}
                        >
                            <option value="" disabled className="bg-zinc-900">Selecione um cliente...</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id} className="bg-zinc-900">
                                    {`${c.nomeFantasia} - ${c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Puxar referencial (Mês / Ano)
                        </label>
                        <div>
                            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-4 mt-2">
                        <button
                            onClick={handleGerarAnalise}
                            disabled={loading || !selectedCliente}
                            className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            Gerar Análise Volumétrica
                        </button>
                    </div>
                </div>
            </div>

            {/* RESULTS AREA */}
            {summary && resultados.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* TOTALIZADORES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Package className="h-16 w-16" />
                            </div>
                            <p className="text-sm font-medium text-indigo-300">Volume Total Escoado (Curva Principal)</p>
                            <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
                                {summary.totalCaixas.toLocaleString('pt-BR')} <span className="text-lg text-gray-400 font-normal">unid.</span>
                            </h3>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <DollarSign className="h-16 w-16" />
                            </div>
                            <p className="text-sm font-medium text-emerald-300">Faturamento Global do Período</p>
                            <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalFaturado)}
                            </h3>
                        </div>
                    </div>

                    {/* TABELA DE RANKING */}
                    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Posição</th>
                                        <th className="px-6 py-4 font-medium">Produto</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Marca</th>
                                        <th className="px-6 py-4 font-medium text-center">Classificação</th>
                                        <th className="px-6 py-4 font-medium text-right">Volume</th>
                                        <th className="px-6 py-4 font-medium text-right">Total Faturado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resultados.map((item) => (
                                        <tr key={item.produtoId} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                                {item.posicao}º
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">
                                                {item.nomeProduto}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">
                                                {item.marca}
                                            </td>
                                            <td className="px-6 py-4 justify-center flex">
                                                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getCurvaBadgeColor(item.curva)}`}>
                                                    Curva {item.curva}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-400 font-semibold">
                                                {item.quantidade.toLocaleString('pt-BR')} <span className="text-xs text-gray-500 font-normal">cx/un</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-300">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {!loading && summary && resultados.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
                    <Package className="mx-auto h-12 w-12 text-gray-500 mb-3 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Nenhum dado volumétrico encontrado</h3>
                    <p className="text-gray-400 mt-1">Este cliente não possui histórico de faturamento neste período.</p>
                </div>
            )}

        </div>
    );
}
