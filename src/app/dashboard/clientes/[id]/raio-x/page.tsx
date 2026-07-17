'use client';

import Link from "next/link";
import { ArrowLeft, Printer, Loader2, UserCircle, DollarSign, Activity, Clock, FileText, BarChart3, Package } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { getClienteRaioX, ClienteRaioXResponse } from "@/app/actions/clienteRaioX";
import { getPerfilEmpresa } from "@/app/actions/perfilEmpresa";
import { PrintHeader } from "@/components/ui/PrintHeader";

interface Props {
    params: { id: string };
}

export default function ClienteRaioXPage({ params }: Props) {
    const router = useRouter();
    const { usuario, loading: authLoading } = useAuth();
    const { showToast } = useData();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ClienteRaioXResponse | null>(null);
    const [loadingPDF, setLoadingPDF] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!authLoading && !usuario) router.push('/api/auth/login');
    }, [usuario, authLoading, router]);

    useEffect(() => {
        const fetchDados = async () => {
            try {
                const result = await getClienteRaioX(params.id);
                setData(result);
            } catch (error) {
                console.error("Erro ao buscar raio-x do cliente:", error);
                showToast("Erro ao carregar dados do cliente.", "error");
            } finally {
                setLoading(false);
            }
        };

        if (usuario) fetchDados();
    }, [params.id, usuario, showToast]);

    // ═══════════════════════════════════════════
    // PDF GENERATION
    // ═══════════════════════════════════════════
    const handleExportPDF = useCallback(async () => {
        if (!data?.cliente) return;
        setLoadingPDF(true);

        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;
            let startY = 20;

            const colors = {
                headerDark: [15, 23, 42] as [number, number, number],
                textDark: [30, 41, 59] as [number, number, number],
                textMuted: [100, 116, 139] as [number, number, number],
                accentBlue: [59, 130, 246] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                rowEven: [248, 250, 252] as [number, number, number],
                emerald: [16, 185, 129] as [number, number, number],
                factoryBg: [248, 250, 252] as [number, number, number],
                barBlue: [59, 130, 246] as [number, number, number]
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
            const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const perfilEmpresa = await getPerfilEmpresa();

            // ═══════ HEADER ═══════
            const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
                const headerHeight = 38;
                pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');
                pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
                pageDoc.setFillColor(colors.emerald[0], colors.emerald[1], colors.emerald[2]);
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
                pageDoc.text(`RAIO-X DO CLIENTE`, pageWidth - margin.right, 13, { align: 'right' });

                pageDoc.setFontSize(8);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
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
                const footerY = pageDoc.internal.pageSize.getHeight() - 12;
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

            drawHeader(doc, 1);
            startY += 26;

            // ═══════ DADOS DO CLIENTE ═══════
            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 20, 1.5, 1.5, 'F');
            doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            doc.setLineWidth(1);
            doc.line(margin.left, startY + 2, margin.left, startY + 18);

            doc.setFontSize(7);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('DADOS DO CLIENTE', margin.left + 5, startY + 5.5);

            doc.setFontSize(10);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`${data.cliente.razaoSocial}`, margin.left + 5, startY + 10.5);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fantasia: ${data.cliente.nomeFantasia}  |  CNPJ: ${data.cliente.cnpj}  |  Cidade: ${data.cliente.cidade}/${data.cliente.estado}`, margin.left + 5, startY + 15.5);

            startY += 26;

            // ═══════ KPIs ═══════
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('INDICADORES DE DESEMPENHO (12 MESES)', margin.left, startY);
            startY += 5;

            const kpiWidth = (contentWidth - 6) / 4;
            const kpis = [
                { label: 'Ticket Médio', value: `R$ ${data.kpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                { label: 'Giro Médio', value: `${data.kpis.giroMedioDias} dias` },
                { label: 'Dias Ausente', value: `${data.kpis.diasAusente} dias` },
                { label: 'Faturamento Total', value: `R$ ${data.kpis.faturamento12m.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
            ];

            kpis.forEach((kpi, idx) => {
                const kpiX = margin.left + idx * (kpiWidth + 2);
                doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.setLineWidth(0.3);
                doc.setFillColor(252, 253, 255);
                doc.roundedRect(kpiX, startY, kpiWidth, 14, 1, 1, 'FD');

                doc.setFontSize(6);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(kpi.label.toUpperCase(), kpiX + 3, startY + 5);

                doc.setFontSize(9);
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(kpi.value, kpiX + 3, startY + 11);
            });

            startY += 24;

            // ═══════ GRÁFICO DE BARRAS ═══════
            const chartHeight = 45;
            const chartWidth = contentWidth;
            const chartStartX = margin.left;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('EVOLUÇÃO FINANCEIRA MENSAL', margin.left, startY);
            startY += 5;

            doc.setFillColor(250, 250, 254);
            doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
            doc.setLineWidth(0.2);
            doc.roundedRect(chartStartX, startY, chartWidth, chartHeight, 1, 1, 'FD');

            const maxVal = Math.max(...data.volumesMensais.map(v => v.valorTotal), 1);
            for (let i = 1; i <= 4; i++) {
                const lineY = startY + chartHeight - (chartHeight * i / 5);
                doc.setDrawColor(230, 232, 240);
                doc.setLineWidth(0.1);
                doc.line(chartStartX + 2, lineY, chartStartX + chartWidth - 2, lineY);

                const labelValue = Math.round(maxVal * i / 5);
                doc.setFontSize(5);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                // Formata K para ficar mais curto
                const formattedLabel = labelValue >= 1000 ? `${(labelValue / 1000).toFixed(1)}k` : String(labelValue);
                doc.text(formattedLabel, chartStartX + 3, lineY - 0.5);
            }

            const barCount = data.volumesMensais.length;
            const barSpacing = (chartWidth - 8) / barCount;
            const barWidth = Math.min(barSpacing - 2, 10);

            data.volumesMensais.forEach((vol, idx) => {
                const barH = maxVal > 0 ? (vol.valorTotal / maxVal) * (chartHeight - 12) : 0;
                const barX = chartStartX + 4 + (idx * barSpacing) + (barSpacing - barWidth) / 2;
                const barY = startY + chartHeight - barH - 4;

                if (vol.valorTotal > 0) {
                    doc.setFillColor(colors.emerald[0], colors.emerald[1], colors.emerald[2]);
                    doc.roundedRect(barX, barY, barWidth, barH, 0.5, 0.5, 'F');

                    doc.setFontSize(4.5);
                    doc.setTextColor(colors.emerald[0], colors.emerald[1], colors.emerald[2]);
                    doc.setFont('helvetica', 'bold');
                    const valText = vol.valorTotal >= 1000 ? `${(vol.valorTotal / 1000).toFixed(1)}k` : String(vol.valorTotal);
                    doc.text(valText, barX + barWidth / 2, barY - 1, { align: 'center' });
                } else {
                    doc.setFillColor(230, 230, 240);
                    doc.rect(barX, startY + chartHeight - 5, barWidth, 1, 'F');
                }

                const [mesNome] = vol.mes.split('/');
                doc.setFontSize(5);
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(mesNome, barX + barWidth / 2, startY + chartHeight - 0.5, { align: 'center' });
            });

            startY += chartHeight + 8;

            // ═══════ TABELA DE CURVA ABC ═══════
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.text('CURVA ABC INTERNA (PRODUTOS MAIS COMPRADOS - 12M)', margin.left, startY);
            startY += 4;

            const tableData = data.curvaABC.map((p) => [
                p.codigo,
                p.nome.length > 35 ? p.nome.substring(0, 35) + '...' : p.nome,
                p.categoria,
                String(p.quantidadeTotal),
                `R$ ${p.precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY,
                head: [['CÓD', 'PRODUTO', 'CATEGORIA', 'QTD', 'PREÇO MÉDIO', 'TOTAL (R$)']],
                body: tableData,
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
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
                    0: { cellWidth: 15 },
                    1: { halign: 'left' },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 15, halign: 'center', fontStyle: 'bold', textColor: colors.accentBlue },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: colors.emerald },
                },
                margin: { top: 35, bottom: 20, left: margin.left, right: margin.right },
                didDrawPage: (pageData: { pageNumber: number }) => {
                    if (pageData.pageNumber > 1) drawHeader(doc, pageData.pageNumber);
                }
            });

            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            const nomeArquivo = `RaioX_${data.cliente.nomeFantasia.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;
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
    // LOADING & ERROR STATE
    // ═══════════════════════════════════════════
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-500">Carregando raio-x do cliente...</p>
                </div>
            </div>
        );
    }

    if (!data?.cliente) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/clientes" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Cliente não encontrado</h1>
                </div>
                <p className="text-gray-400">O cliente solicitado não existe ou foi removido.</p>
            </div>
        );
    }

    const { cliente, kpis, volumesMensais, curvaABC } = data;
    const maxVal = Math.max(...volumesMensais.map(v => v.valorTotal), 1);

    return (
        <div className="max-w-6xl mx-auto space-y-6 print:space-y-4 print:max-w-none">
            {/* ═══════ HEADER ═══════ */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="h-5 w-5 text-indigo-400" />
                            Raio-X do Cliente
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">{cliente.razaoSocial}</p>
                    </div>
                </div>
                <button
                    onClick={handleExportPDF}
                    disabled={loadingPDF}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-900/30 disabled:opacity-50 active:scale-95"
                >
                    {loadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Exportar Dossiê
                </button>
            </div>

            {/* ═══════ PRINT HEADER ═══════ */}
            <PrintHeader 
                titulo="Raio-X do Cliente" 
                subtitulo={cliente.razaoSocial} 
            />

            {/* ═══════ DADOS DO CLIENTE ═══════ */}
            <div className="glass-panel rounded-xl p-4 print:border print:border-gray-300 print:bg-gray-50 animate-in">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5 print:border-gray-200">
                    <UserCircle className="h-4 w-4 text-indigo-400 print:text-indigo-600" />
                    <span className="text-sm font-medium text-white print:text-black">Identificação</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                        <span className="label-compact print:text-gray-500">Razão Social</span>
                        <p className="text-sm font-semibold text-white print:text-black">{cliente.razaoSocial}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Fantasia</span>
                        <p className="text-sm text-gray-300 print:text-gray-700">{cliente.nomeFantasia}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">CNPJ</span>
                        <p className="text-sm text-gray-300 print:text-gray-700">{cliente.cnpj}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Cidade/UF</span>
                        <p className="text-sm text-gray-300 print:text-gray-700">{cliente.cidade} - {cliente.estado}</p>
                    </div>
                    <div>
                        <span className="label-compact print:text-gray-500">Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            cliente.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 print:bg-emerald-100 print:text-emerald-700' : 
                            'bg-red-500/10 text-red-400 print:bg-red-100 print:text-red-700'
                        }`}>
                            {cliente.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══════ KPIs ═══════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 shadow-lg shadow-black/10 print:border-gray-200 print:bg-gray-50 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 print:text-indigo-600">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 print:text-gray-600">Ticket Médio</span>
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black tabular-nums">
                        R$ {kpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 shadow-lg shadow-black/10 print:border-gray-200 print:bg-gray-50 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2 text-cyan-400 print:text-cyan-600">
                        <Activity className="h-4 w-4" />
                        <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 print:text-gray-600">Giro Médio</span>
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black tabular-nums">
                        {kpis.giroMedioDias} <span className="text-sm text-gray-500 font-normal">dias</span>
                    </div>
                </div>

                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 shadow-lg shadow-black/10 print:border-gray-200 print:bg-gray-50 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2 text-rose-400 print:text-rose-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 print:text-gray-600">Dias Ausente</span>
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black tabular-nums">
                        {kpis.diasAusente} <span className="text-sm text-gray-500 font-normal">dias</span>
                    </div>
                </div>

                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 shadow-lg shadow-black/10 print:border-gray-200 print:bg-gray-50 print:shadow-none relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-2 mb-2 text-emerald-400 print:text-emerald-600 relative z-10">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 print:text-gray-600">Faturamento (12m)</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 print:text-emerald-600 tabular-nums relative z-10">
                        R$ {kpis.faturamento12m.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* ═══════ GRÁFICO BARRAS (FINANCEIRO) ═══════ */}
            <div ref={chartRef} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-6 shadow-2xl shadow-black/40 relative overflow-hidden animate-in print:border print:border-gray-300 print:bg-white print:shadow-none" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-start justify-between mb-5 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 print:bg-emerald-600" />
                            <h3 className="text-base font-semibold text-white/90 tracking-tight print:text-black">
                                Evolução Financeira — Últimos 12 Meses
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="w-full rounded-xl p-3 pb-1 flex items-end justify-between gap-[3px] relative bg-white/[0.02] border border-white/[0.04] print:bg-gray-50 print:border-gray-200" style={{ height: '220px' }}>
                    <div className="absolute inset-x-0 top-3 bottom-8 flex flex-col justify-between pointer-events-none px-3">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="w-full border-t border-dashed border-white/[0.06] print:border-gray-200" />
                        ))}
                    </div>

                    {volumesMensais.map((vol, i) => {
                        const heightPct = maxVal > 0 ? Math.max((vol.valorTotal / maxVal) * 100, 2) : 2;
                        const hasValue = vol.valorTotal > 0;
                        const [mesLabel] = vol.mes.split('/');

                        return (
                            <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center group" title={`${vol.mes}: R$ ${vol.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 print:hidden">
                                    <div className="bg-gray-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white whitespace-nowrap shadow-xl">
                                        <div className="font-semibold text-emerald-300">{vol.mes}</div>
                                        <div>R$ {vol.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>

                                <div
                                    className={`w-full max-w-[48px] min-w-[12px] rounded-t transition-all duration-300 ${
                                        hasValue
                                            ? 'bg-gradient-to-t from-emerald-600/80 to-emerald-400/70 group-hover:from-emerald-500 group-hover:to-emerald-300 print:from-emerald-600 print:to-emerald-500'
                                            : 'bg-white/[0.04] print:bg-gray-200'
                                    }`}
                                    style={{ height: hasValue ? `${heightPct}%` : '2%' }}
                                />
                                {hasValue && (
                                    <div className="absolute w-full text-center text-[9px] font-bold text-emerald-300 print:text-emerald-700 tabular-nums" style={{ bottom: `calc(${heightPct}% + 4px)` }}>
                                        {vol.valorTotal >= 1000 ? `${(vol.valorTotal / 1000).toFixed(1)}k` : vol.valorTotal}
                                    </div>
                                )}
                                <span className="text-[9px] mt-2 block h-4 text-center w-full tabular-nums text-gray-500 print:text-gray-600 font-medium">
                                    {mesLabel}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══════ CURVA ABC ═══════ */}
            <div className="glass-panel rounded-xl overflow-hidden animate-in print:border print:border-gray-300 print:bg-white" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center gap-2 p-4 pb-3 border-b border-white/5 print:border-gray-200">
                    <Package className="h-4 w-4 text-indigo-400 print:text-indigo-600" />
                    <span className="text-sm font-medium text-white print:text-black">Curva ABC Interna (Produtos Consumidos - 12m)</span>
                    <span className="text-xs text-gray-500 ml-auto">{curvaABC.length} produto{curvaABC.length !== 1 ? 's' : ''}</span>
                </div>

                {curvaABC.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        Nenhuma compra registrada nos últimos 12 meses.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5 print:border-gray-200">
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cód</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Produto</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Qtd</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Preço Médio</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {curvaABC.map((prod) => (
                                    <tr key={prod.produtoId} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors print:border-gray-100 print:hover:bg-transparent">
                                        <td className="px-4 py-2.5 text-gray-400 print:text-gray-600 tabular-nums">{prod.codigo}</td>
                                        <td className="px-4 py-2.5 text-white print:text-black font-medium max-w-[250px] truncate" title={prod.nome}>
                                            <Link href={`/dashboard/produtos/${prod.produtoId}/saidas`} className="hover:text-indigo-400 hover:underline print:no-underline transition-colors">
                                                {prod.nome}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-bold text-blue-400 print:text-blue-600 tabular-nums">{prod.quantidadeTotal}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-300 print:text-gray-700 tabular-nums">
                                            R$ {prod.precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-400 print:text-emerald-600 tabular-nums">
                                            R$ {prod.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-gray-50">
                                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-white print:text-black">Total</td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-400 print:text-blue-600 tabular-nums">
                                        {curvaABC.reduce((acc, p) => acc + p.quantidadeTotal, 0).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-400 print:text-gray-500">—</td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-emerald-600 tabular-nums">
                                        R$ {curvaABC.reduce((acc, p) => acc + p.valorTotal, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
