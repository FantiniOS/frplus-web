/* eslint-disable */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Clock, Factory, Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useData } from '@/contexts/DataContext';
import { getHistoricoTabela, registrarEnvioTabela } from '@/app/actions/tabelaPreco';

const TABELA_PRECO_MAP: Record<string, { field: string; label: string }> = {
    '50a199': { field: 'preco50a199', label: '50 a 199 CX' },
    '200a699': { field: 'preco200a699', label: '200 a 699 CX' },
    'atacado': { field: 'precoAtacado', label: 'Atacado' },
    'atacadoAVista': { field: 'precoAtacadoAVista', label: 'Atacado à Vista' },
    'redes': { field: 'precoRedes', label: 'Redes' },
};

interface HistoricoItem {
    representadaId: string;
    representadaNome: string;
    dataGeracao: Date | string;
}

interface TabelaPDFSectionProps {
    clienteId: string;
    clienteNome: string;
    clienteRazaoSocial: string;
    tabelaPreco: string;
}

export default function TabelaPDFSection({ clienteId, clienteNome, clienteRazaoSocial, tabelaPreco }: TabelaPDFSectionProps) {
    const { fabricas, showToast } = useData();

    const [historico, setHistorico] = useState<HistoricoItem[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(true);
    const [showModalPDF, setShowModalPDF] = useState(false);
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [comunicado, setComunicado] = useState('');
    const [loadingPDF, setLoadingPDF] = useState(false);

    const formatDate = (d: Date | string) => {
        const date = new Date(d);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fetchHistorico = useCallback(async () => {
        if (!clienteId) return;
        setLoadingHistorico(true);
        try {
            const res = await getHistoricoTabela(clienteId);
            if (res.success && res.historicos) {
                setHistorico(res.historicos);
            }
        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
        } finally {
            setLoadingHistorico(false);
        }
    }, [clienteId]);

    useEffect(() => { fetchHistorico(); }, [fetchHistorico]);

    // ===== PDF GENERATION (same pattern as relatorios/verbas) =====
    const handleGerarPDF = async () => {
        if (!selectedFabricaId) {
            showToast("Selecione uma Representada", "error");
            return;
        }

        const fabrica = fabricas.find(f => f.id === selectedFabricaId);
        if (!fabrica) {
            showToast("Representada não encontrada", "error");
            return;
        }

        const tabelaConfig = TABELA_PRECO_MAP[tabelaPreco || '50a199'];
        if (!tabelaConfig) {
            showToast("Tabela de preço do cliente não configurada", "error");
            return;
        }

        setLoadingPDF(true);
        try {
            const res = await fetch(`/api/products/by-fabrica?fabricaId=${selectedFabricaId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Erro ao buscar produtos');
            const produtos = await res.json();

            if (!produtos.length) {
                showToast("Nenhum produto ativo encontrado para esta Representada", "error");
                setLoadingPDF(false);
                return;
            }

            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

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
                greenAccent: [16, 185, 129] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                factoryBg: [235, 238, 248] as [number, number, number],
                factoryAccent: [30, 64, 175] as [number, number, number],
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
                pageDoc.text(`Tabela de Preços — ${fabrica.nome}`, pageWidth - margin.right, 14, { align: 'right' });

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

            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;
                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento confidencial • Preços sujeitos a alteração sem aviso prévio', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            let startY = drawHeader(doc, 1);
            const displayName = clienteNome || clienteRazaoSocial || 'Cliente';

            // Comunicado
            if (comunicado.trim()) {
                startY += 2;
                doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
                doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.setFontSize(9);
                const commLines = doc.splitTextToSize(comunicado.trim(), contentWidth - 20);
                const commBoxHeight = Math.max(16, (commLines.length * 4.5) + 12);
                doc.roundedRect(margin.left, startY, contentWidth, commBoxHeight, 2, 2, 'FD');
                doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.rect(margin.left, startY, 3, commBoxHeight, 'F');
                doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('COMUNICADO', margin.left + 7, startY + 5);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(commLines, margin.left + 7, startY + 10.5);
                startY += commBoxHeight + 4;
            }

            // Destinatário
            startY += 1;
            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 14, 1.5, 1.5, 'F');
            doc.setFontSize(7);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('PREPARADO EXCLUSIVAMENTE PARA', margin.left + 5, startY + 5);
            doc.setFontSize(11);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(displayName, margin.left + 5, startY + 11);

            doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            const badgeText = `Tabela: ${tabelaConfig.label}`;
            doc.setFontSize(7);
            const badgeWidth = doc.getTextWidth(badgeText) + 8;
            doc.roundedRect(pageWidth - margin.right - badgeWidth - 2, startY + 3, badgeWidth + 1, 8, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(badgeText, pageWidth - margin.right - badgeWidth + 2, startY + 8.5);
            startY += 18;

            // Tabela de Produtos
            const priceField = tabelaConfig.field as string;
            const tableData = produtos.map((p: any) => [
                p.codigo,
                p.nome,
                p.categoria || 'Geral',
                `R$ ${Number(p[priceField]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY,
                head: [['CÓDIGO', 'PRODUTO', 'CATEGORIA', 'PREÇO UNIT.']],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2, textColor: colors.textDark },
                headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
                    1: { halign: 'left' },
                    2: { cellWidth: 30, halign: 'center', fontSize: 7, textColor: colors.textMuted },
                    3: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: colors.factoryAccent },
                },
                foot: [['', `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`, fabrica.nome, tabelaConfig.label]],
                footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                margin: { left: margin.left, right: margin.right },
                didDrawPage: (data: { pageNumber: number }) => {
                    if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                }
            });

            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            const nomeArquivo = `Tabela_${fabrica.nome.replace(/\s+/g, '_')}_${displayName.replace(/\s+/g, '_')}.pdf`;
            doc.save(nomeArquivo);
            showToast(`PDF "${nomeArquivo}" gerado com sucesso!`, "success");

            const agora = new Date();
            setHistorico(prev => {
                const filtered = prev.filter(h => h.representadaId !== selectedFabricaId);
                return [...filtered, { representadaId: selectedFabricaId, representadaNome: fabrica.nome, dataGeracao: agora }];
            });
            registrarEnvioTabela(clienteId, selectedFabricaId).catch(console.error);

            setShowModalPDF(false);
            setSelectedFabricaId('');
            setComunicado('');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showToast("Erro ao gerar o PDF. Tente novamente.", "error");
        } finally {
            setLoadingPDF(false);
        }
    };

    return (
        <>
            {/* ===== INLINE: Badges + Botão ===== */}
            <div className="space-y-3 mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Tabela de Preços</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowModalPDF(true); }}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/30"
                    >
                        <Download className="h-3.5 w-3.5" /> Gerar PDF
                    </button>
                </div>

                {/* Badges */}
                {loadingHistorico ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {fabricas.map(fab => {
                            const entry = historico.find(h => h.representadaId === fab.id);
                            const hasEntry = !!entry;
                            return (
                                <div
                                    key={fab.id}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${hasEntry
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-white/5 text-gray-500 border border-white/5'
                                    }`}
                                >
                                    <Factory className="h-2.5 w-2.5" />
                                    <span className={hasEntry ? 'text-emerald-300' : 'text-gray-400'}>{fab.nome}:</span>
                                    <span>{hasEntry ? formatDate(entry.dataGeracao) : 'Nunca'}</span>
                                    {hasEntry && <Clock className="h-2.5 w-2.5 opacity-50" />}
                                </div>
                            );
                        })}
                        {fabricas.length === 0 && (
                            <span className="text-gray-500 text-[10px]">Nenhuma representada cadastrada</span>
                        )}
                    </div>
                )}
            </div>

            {/* ===== MODAL GERAR PDF ===== */}
            {showModalPDF && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loadingPDF && setShowModalPDF(false)} />
                    <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                                    <FileText className="h-5 w-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Gerar Tabela de Preço</h3>
                                    <p className="text-xs text-gray-400">
                                        {clienteNome || clienteRazaoSocial || 'Cliente'} — {TABELA_PRECO_MAP[tabelaPreco || '50a199']?.label || '50 a 199 CX'}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => !loadingPDF && setShowModalPDF(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-300">Representada *</label>
                                <select value={selectedFabricaId} onChange={(e) => setSelectedFabricaId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
                                    <option value="">Selecione a representada...</option>
                                    {fabricas.map(f => (
                                        <option key={f.id} value={f.id} className="bg-[#0f1729] text-white">{f.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedFabricaId && (() => {
                                const entry = historico.find(h => h.representadaId === selectedFabricaId);
                                return (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${entry ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        <Clock className="h-3.5 w-3.5" />
                                        {entry ? `Último envio: ${formatDate(entry.dataGeracao)}` : 'Nenhuma tabela enviada para esta representada'}
                                    </div>
                                );
                            })()}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-300">Comunicado / Motivo <span className="text-gray-500">(Opcional)</span></label>
                                <textarea
                                    rows={3}
                                    value={comunicado}
                                    onChange={(e) => setComunicado(e.target.value)}
                                    placeholder="Ex: Novos preços válidos a partir de abril/2026..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none placeholder:text-gray-600"
                                />
                                {comunicado.trim() && (
                                    <p className="text-[10px] text-cyan-400/60 flex items-center gap-1">✦ O comunicado aparecerá em destaque no topo do PDF</p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20 rounded-b-2xl">
                            <button type="button" onClick={() => !loadingPDF && setShowModalPDF(false)} disabled={loadingPDF} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleGerarPDF}
                                disabled={loadingPDF || !selectedFabricaId}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/30"
                            >
                                {loadingPDF ? (<><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF...</>) : (<><Download className="h-4 w-4" /> Gerar e Baixar PDF</>)}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
