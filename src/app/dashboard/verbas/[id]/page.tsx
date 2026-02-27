/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Wallet, ArrowLeft, DollarSign, Link2, FileDown, Trash2, X, Check, Package } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface PedidoVinculado {
    id: string;
    data: string;
    valorTotal: number;
    condicaoPagamento: string;
    observacoes?: string;
}

interface VerbaDetail {
    id: string;
    clienteId: string;
    clienteNome: string;
    titulo: string;
    valorTotal: number;
    consumido: number;
    saldo: number;
    status: string;
    createdAt: string;
    pedidos: PedidoVinculado[];
}

export default function VerbaDetailPage() {
    const params = useParams();
    const router = useRouter();
    const verbaId = params.id as string;

    const [verba, setVerba] = useState<VerbaDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Vincular modal
    const [showVincular, setShowVincular] = useState(false);
    const [pedidosDisponiveis, setPedidosDisponiveis] = useState<PedidoVinculado[]>([]);
    const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());
    const [loadingPedidos, setLoadingPedidos] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exportando, setExportando] = useState(false);

    const fetchVerba = async () => {
        try {
            const res = await fetch(`/api/verbas/${verbaId}`);
            if (!res.ok) { router.push('/dashboard/verbas'); return; }
            const data = await res.json();
            setVerba(data);
        } catch (e) {
            console.error('Error fetching verba:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVerba(); }, [verbaId]);

    const openVincular = async () => {
        setShowVincular(true);
        setLoadingPedidos(true);
        setSelectedPedidos(new Set());
        try {
            const res = await fetch(`/api/verbas/${verbaId}/vincular`);
            const data = await res.json();
            setPedidosDisponiveis(data.pedidos || []);
        } catch (e) {
            console.error('Error fetching pedidos:', e);
        } finally {
            setLoadingPedidos(false);
        }
    };

    const togglePedido = (id: string) => {
        setSelectedPedidos(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleVincular = async () => {
        if (selectedPedidos.size === 0) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/verbas/${verbaId}/vincular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidoIds: Array.from(selectedPedidos) })
            });
            if (res.ok) {
                setShowVincular(false);
                fetchVerba();
            }
        } catch (e) {
            console.error('Error linking pedidos:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            await fetch(`/api/verbas/${verbaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchVerba();
        } catch (e) {
            console.error('Error updating status:', e);
        }
    };

    // ====== PDF EXPORT — Reusing jsPDF + autoTable engine ======
    const handleExportPDF = async () => {
        if (!verba) return;
        setExportando(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;

            // Same premium color palette from relatorios
            const colors = {
                headerDark: [10, 10, 14] as [number, number, number],
                accentBlue: [37, 99, 235] as [number, number, number],
                accentCyan: [6, 182, 212] as [number, number, number],
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
                textLight: [200, 200, 220] as [number, number, number],
                white: [255, 255, 255] as [number, number, number],
                rowEven: [250, 251, 254] as [number, number, number],
                greenAccent: [16, 185, 129] as [number, number, number],
                purpleAccent: [124, 58, 237] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                accentGold: [245, 158, 11] as [number, number, number],
            };

            // ====== LOGO LOADER (same as relatorios) ======
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

            // ====== DRAW PREMIUM HEADER (same as relatorios) ======
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

                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text('Relatório de Verba', pageWidth - margin.right, 14, { align: 'right' });

                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text('(Continuação)', pageWidth - margin.right, 25, { align: 'right' });
                }

                return headerHeight + 5;
            };

            // ====== DRAW FOOTER (same as relatorios) ======
            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;
                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento confidencial', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            // ====== KPI Card Helper (same as relatorios) ======
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

            // ====== BUILD PDF ======
            let startY = drawHeader(doc, 1);
            startY += 2;

            // Verba info
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.text(`Cliente: ${verba.clienteNome}`, margin.left, startY);
            doc.text(`Título: ${verba.titulo}`, margin.left, startY + 5);
            startY += 12;

            // KPI Cards
            const cardW = (contentWidth - 6) / 3;
            const cardH = 18;
            const gap = 3;

            drawKpiCard(margin.left, startY, cardW, cardH, 'Valor Liberado',
                `R$ ${verba.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                colors.purpleAccent);
            drawKpiCard(margin.left + cardW + gap, startY, cardW, cardH, 'Valor Consumido',
                `R$ ${verba.consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                colors.accentGold);
            drawKpiCard(margin.left + (cardW + gap) * 2, startY, cardW, cardH, 'Saldo Atual',
                `R$ ${verba.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                colors.greenAccent);

            startY += cardH + 8;

            // Extrato table
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('Extrato de Pedidos Vinculados', margin.left, startY);
            startY += 4;

            autoTable(doc, {
                startY,
                head: [['#', 'Data', 'Nº Pedido', 'Valor Abatido']],
                body: verba.pedidos.map((p, i) => [
                    (i + 1).toString(),
                    new Date(p.data).toLocaleDateString('pt-BR'),
                    `#${p.id.slice(-6)}`,
                    `R$ ${p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
                styles: { fontSize: 8, cellPadding: 3, halign: 'center', lineColor: colors.tableBorder, lineWidth: 0.2 },
                headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { cellWidth: 12, fontStyle: 'bold' },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 30, fontStyle: 'bold' },
                    3: { halign: 'right', fontStyle: 'bold', textColor: colors.greenAccent }
                },
                foot: [['', '', 'TOTAL', `R$ ${verba.consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                margin: { left: margin.left, right: margin.right },
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

            doc.save(`FRPlus_Verba_${verba.titulo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setExportando(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-6 w-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!verba) return null;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ATIVA': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'ESGOTADA': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'CANCELADA': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">

            {/* ═══════════ HEADER ═══════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/verbas">
                        <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                            <ArrowLeft className="h-4 w-4 text-gray-400" />
                        </button>
                    </Link>
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
                        <Wallet className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">{verba.titulo}</h1>
                        <p className="text-xs text-gray-500">{verba.clienteNome}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(verba.status)}`}>
                        {verba.status}
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {verba.status === 'ATIVA' && (
                        <button
                            onClick={openVincular}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <Link2 className="h-3.5 w-3.5" />
                            Vincular Pedidos
                        </button>
                    )}
                    <button
                        onClick={handleExportPDF}
                        disabled={exportando}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                    >
                        <FileDown className="h-3.5 w-3.5" />
                        {exportando ? 'Gerando...' : 'Exportar Relatório'}
                    </button>
                    {verba.status === 'ATIVA' && (
                        <>
                            <button
                                onClick={() => handleStatusChange('ESGOTADA')}
                                className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-all"
                            >
                                Marcar Esgotada
                            </button>
                            <button
                                onClick={() => handleStatusChange('CANCELADA')}
                                className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all"
                            >
                                Cancelar Verba
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ═══════════ KPI CARDS ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <DollarSign className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Valor Liberado</p>
                            <p className="text-lg font-bold text-white">R$ {verba.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <DollarSign className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Valor Consumido</p>
                            <p className="text-lg font-bold text-amber-400">R$ {verba.consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <DollarSign className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Saldo Restante</p>
                            <p className={`text-lg font-bold ${verba.saldo > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                R$ {verba.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════ PEDIDOS VINCULADOS TABLE ═══════════ */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-cyan-500"></div>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Pedidos Vinculados</span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{verba.pedidos.length} pedidos</span>
                    </div>
                </div>

                <div className="overflow-auto" style={{ maxHeight: '400px' }}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">#</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Data</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Nº Pedido</th>
                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Valor Abatido</th>
                            </tr>
                        </thead>
                        <tbody>
                            {verba.pedidos.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-600">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum pedido vinculado ainda</p>
                                        {verba.status === 'ATIVA' && (
                                            <button onClick={openVincular} className="text-blue-400 text-xs mt-2 hover:underline">
                                                Vincular pedidos de bonificação →
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {verba.pedidos.map((p, idx) => (
                                        <tr key={p.id} className={`border-b border-white/[0.03] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] text-gray-600 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-mono text-gray-400">{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-sm text-gray-200 font-medium">#{p.id.slice(-6)}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-sm text-emerald-400 font-bold font-mono">
                                                    R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Total Row */}
                                    <tr className="bg-white/[0.03] border-t border-white/[0.08]">
                                        <td colSpan={3} className="px-3 py-2.5">
                                            <span className="text-xs text-gray-500 uppercase font-semibold">Total Consumido</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-base text-amber-400 font-bold">R$ {verba.consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════ MODAL — Vincular Pedidos ═══════════ */}
            <AnimatePresence>
                {showVincular && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowVincular(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-blue-500/10 p-2 text-blue-500">
                                        <Link2 className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Vincular Pedidos</h3>
                                </div>
                                <button onClick={() => setShowVincular(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-4 max-h-[400px] overflow-auto">
                                <p className="text-xs text-gray-500 mb-3">
                                    Pedidos de Bonificação de <span className="text-white font-medium">{verba.clienteNome}</span> disponíveis para vínculo:
                                </p>

                                {loadingPedidos ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="h-5 w-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : pedidosDisponiveis.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum pedido de bonificação disponível</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {pedidosDisponiveis.map(p => (
                                            <label
                                                key={p.id}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${selectedPedidos.has(p.id)
                                                    ? 'bg-blue-500/10 border border-blue-500/30'
                                                    : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05]'
                                                    }`}
                                            >
                                                <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${selectedPedidos.has(p.id)
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-white/20 bg-transparent'
                                                    }`}>
                                                    {selectedPedidos.has(p.id) && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPedidos.has(p.id)}
                                                    onChange={() => togglePedido(p.id)}
                                                    className="hidden"
                                                />
                                                <div className="flex-1 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-sm text-gray-200 font-medium">#{p.id.slice(-6)}</span>
                                                        <span className="text-xs text-gray-500 ml-2">{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-amber-400 tabular-nums">
                                                        R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pedidosDisponiveis.length > 0 && (
                                <div className="flex items-center justify-between p-4 border-t border-white/10">
                                    <span className="text-xs text-gray-500">
                                        {selectedPedidos.size} selecionado(s) • R$ {pedidosDisponiveis.filter(p => selectedPedidos.has(p.id)).reduce((acc, p) => acc + p.valorTotal, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <button
                                        onClick={handleVincular}
                                        disabled={saving || selectedPedidos.size === 0}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Vinculando...' : 'Vincular Selecionados'}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
