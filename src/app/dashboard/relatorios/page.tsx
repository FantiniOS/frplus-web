/* eslint-disable */
'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useData, Order } from '@/contexts/DataContext';
import {
    FileText, Calendar, Download, TrendingUp, Users, Package,
    DollarSign, BarChart3, PieChart, Filter, Printer, ChevronDown, Check, ChevronUp, FileDown, MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function RelatoriosPage() {
    const { orders, clients, products, fabricas, refreshData } = useData();

    // Force refresh on mount to ensure up-to-date data
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'produtos' | 'clientes' | 'tabela'>('vendas');

    // Helpers for local date strings
    const getLocalDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    const getLastMonthDate = () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    const [periodoInicio, setPeriodoInicio] = useState(getLastMonthDate());
    const [periodoFim, setPeriodoFim] = useState(getLocalDate());
    const [exportando, setExportando] = useState(false);
    const [tabelaPrecoSelecionada, setTabelaPrecoSelecionada] = useState<'todas' | '50a199' | '200a699' | 'atacado' | 'avista' | 'redes'>('todas');
    const [fabricaSelecionada, setFabricaSelecionada] = useState<string>('todas');
    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [expandedClientOrderId, setExpandedClientOrderId] = useState<string | null>(null);
    const relatorioRef = useRef<HTMLDivElement>(null);

    // Filter orders by date
    const pedidosFiltrados = useMemo(() => {
        const start = new Date(periodoInicio);
        start.setHours(0, 0, 0, 0);
        const end = new Date(periodoFim);
        end.setHours(23, 59, 59, 999);

        return orders.filter(order => {
            const date = new Date(order.data);
            return date >= start && date <= end;
        });
    }, [orders, periodoInicio, periodoFim]);

    // Sales Statistics
    const estatisticasVendas = useMemo(() => {
        const totalVendas = pedidosFiltrados.reduce((acc: number, order: Order) => {
            if (order.tipo === 'Bonificacao') return acc;
            return acc + order.valorTotal;
        }, 0);
        const totalPedidos = pedidosFiltrados.filter(o => o.tipo !== 'Bonificacao').length;
        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

        const vendasPorDia: Record<string, number> = {};
        const clientesPorDia: Record<string, Set<string>> = {};

        pedidosFiltrados.forEach((order: Order) => {
            if (order.tipo === 'Bonificacao') return;
            const date = new Date(order.data).toLocaleDateString('pt-BR');
            vendasPorDia[date] = (vendasPorDia[date] || 0) + order.valorTotal;

            if (!clientesPorDia[date]) {
                clientesPorDia[date] = new Set();
            }
            if (order.nomeCliente) {
                clientesPorDia[date].add(order.nomeCliente.split(' ')[0]); // Store first name/word to save space
            }
        });

        return { totalVendas, totalPedidos, ticketMedio, vendasPorDia, clientesPorDia };

        return { totalVendas, totalPedidos, ticketMedio, vendasPorDia };
    }, [pedidosFiltrados]);

    // Product Statistics
    const estatisticasProdutos = useMemo(() => {
        const produtosMap = new Map<string, { nome: string; qtd: number; valor: number }>();

        pedidosFiltrados.forEach((order: Order) => {
            if (order.tipo === 'Bonificacao') return;
            order.itens.forEach((item: any) => {
                const atual = produtosMap.get(item.nomeProduto) || { nome: item.nomeProduto, qtd: 0, valor: 0 };
                produtosMap.set(item.nomeProduto, {
                    nome: item.nomeProduto,
                    qtd: atual.qtd + item.quantidade,
                    valor: atual.valor + item.total
                });
            });
        });

        return Array.from(produtosMap.values()).sort((a, b) => b.valor - a.valor);
    }, [pedidosFiltrados]);

    // Estatísticas de Clientes
    const estatisticasClientes = useMemo(() => {
        const clientesVendas = new Map<string, { id: string; nome: string; pedidos: number; valor: number }>();

        pedidosFiltrados.forEach(order => {
            if (order.tipo === 'Bonificacao') return;
            const atual = clientesVendas.get(order.clienteId) || { id: order.clienteId, nome: order.nomeCliente, pedidos: 0, valor: 0 };
            clientesVendas.set(order.clienteId, {
                id: order.clienteId,
                nome: order.nomeCliente,
                pedidos: atual.pedidos + 1,
                valor: atual.valor + order.valorTotal
            });
        });

        return Array.from(clientesVendas.values())
            .sort((a, b) => b.valor - a.valor);
    }, [pedidosFiltrados]);

    // Função para imprimir
    const handlePrint = () => {
        window.print();
    };

    // ====== PREMIUM PDF EXPORT ENGINE ======
    const handleExportPDF = async () => {
        setExportando(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const isTabela = tipoRelatorio === 'tabela';
            const doc = new jsPDF({
                orientation: isTabela ? 'portrait' : 'landscape',
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

            const titulosRelatorio: Record<string, string> = {
                vendas: 'Relatório de Vendas',
                produtos: 'Ranking de Produtos',
                clientes: 'Relatório de Clientes',
                tabela: 'Tabela de Preços'
            };

            // ====== LOGO LOADER (reusable) ======
            const loadLogo = (): Promise<string | null> => {
                return new Promise((resolve) => {
                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    logoImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(logoImg, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    logoImg.onerror = () => resolve(null);
                    logoImg.src = '/logo.png';
                });
            };

            const logoData = await loadLogo();

            // ====== DRAW PREMIUM HEADER (every page) ======
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
                        pageDoc.addImage(logoData, 'PNG', margin.left, 6, 28, 26);
                    } catch { /* ignore logo errors */ }
                }

                // Company Name
                const titleX = logoData ? margin.left + 34 : margin.left;
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.setFontSize(18);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text('FRPlus', titleX, 16);

                // Company subtitle
                pageDoc.setFontSize(7.5);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                pageDoc.text('Gestão Comercial Inteligente', titleX, 21.5);

                // Report title - right-aligned, bold
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text(titulosRelatorio[tipoRelatorio], pageWidth - margin.right, 14, { align: 'right' });

                // Date & meta info
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

                if (tipoRelatorio !== 'tabela') {
                    pageDoc.text(
                        `Período: ${new Date(periodoInicio).toLocaleDateString('pt-BR')} — ${new Date(periodoFim).toLocaleDateString('pt-BR')}`,
                        pageWidth - margin.right, 25, { align: 'right' }
                    );
                }

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text(`(Continuação)`, pageWidth - margin.right, 30, { align: 'right' });
                }

                return headerHeight + 5; // Return startY after header
            };

            // ====== DRAW PREMIUM FOOTER (every page) ======
            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;

                // Thin separator line
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

            // ====== HELPER: Draw KPI Card ======
            const drawKpiCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) => {
                // Card background
                doc.setFillColor(colors.rowEven[0], colors.rowEven[1], colors.rowEven[2]);
                doc.roundedRect(x, y, w, h, 2, 2, 'F');

                // Color accent bar on left
                doc.setFillColor(color[0], color[1], color[2]);
                doc.rect(x, y, 2.5, h, 'F');

                // Label
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(label.toUpperCase(), x + 6, y + 6);

                // Value
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.text(value, x + 6, y + 14);
            };

            // ====== FIRST PAGE HEADER ======
            let startY = drawHeader(doc, 1);

            // ====== REPORT-SPECIFIC CONTENT ======
            if (tipoRelatorio === 'vendas') {
                // ---- KPI SUMMARY CARDS ----
                startY += 2;
                const cardW = (contentWidth - 9) / 4; // 4 cards with gaps
                const cardH = 18;
                const gap = 3;

                drawKpiCard(margin.left, startY, cardW, cardH, 'Faturamento Total',
                    `R$ ${estatisticasVendas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    colors.greenAccent);
                drawKpiCard(margin.left + cardW + gap, startY, cardW, cardH, 'Total de Pedidos',
                    `${estatisticasVendas.totalPedidos}`,
                    colors.accentBlue);
                drawKpiCard(margin.left + (cardW + gap) * 2, startY, cardW, cardH, 'Ticket Médio',
                    `R$ ${estatisticasVendas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    colors.purpleAccent);
                drawKpiCard(margin.left + (cardW + gap) * 3, startY, cardW, cardH, 'Clientes Ativos',
                    `${new Set(pedidosFiltrados.map(o => o.clienteId)).size}`,
                    colors.accentGold);

                startY += cardH + 6;

                autoTable(doc, {
                    startY,
                    head: [['Pedido', 'Cliente', 'Data', 'Tipo', 'Itens', 'Valor Total']],
                    body: pedidosFiltrados
                        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                        .map(o => [
                            `#${o.id.slice(-6)}`,
                            o.nomeCliente || 'Cliente',
                            new Date(o.data).toLocaleDateString('pt-BR'),
                            o.tipo === 'Bonificacao' ? 'Bonificação' : 'Venda',
                            o.itens.length.toString(),
                            `R$ ${o.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        ]),
                    styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: colors.tableBorder, lineWidth: 0.2 },
                    headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                    alternateRowStyles: { fillColor: colors.rowEven },
                    columnStyles: {
                        0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
                        1: { halign: 'left' },
                        3: { cellWidth: 22 },
                        5: { halign: 'right', fontStyle: 'bold', textColor: colors.greenAccent }
                    },
                    foot: [['', '', '', '', 'TOTAL', `R$ ${estatisticasVendas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                    footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                    margin: { top: startY, left: margin.left, right: margin.right },
                    didDrawPage: (data: { pageNumber: number }) => {
                        if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                    }
                });

            } else if (tipoRelatorio === 'produtos') {
                startY += 2;
                // Summary line
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(`${estatisticasProdutos.length} produtos vendidos no período`, margin.left, startY);
                startY += 6;

                autoTable(doc, {
                    startY,
                    head: [['#', 'Produto', 'Qtd. Vendida', 'Valor Total', '% do Total']],
                    body: estatisticasProdutos.map((p, i) => {
                        const totalGeral = estatisticasProdutos.reduce((a, x) => a + x.valor, 0);
                        const pct = totalGeral > 0 ? ((p.valor / totalGeral) * 100).toFixed(1) : '0.0';
                        return [
                            (i + 1).toString(),
                            p.nome,
                            p.qtd.toString(),
                            `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            `${pct}%`
                        ];
                    }),
                    styles: { fontSize: 8, cellPadding: 3, halign: 'center', lineColor: colors.tableBorder, lineWidth: 0.2 },
                    headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                    alternateRowStyles: { fillColor: colors.rowEven },
                    columnStyles: {
                        0: { cellWidth: 12, fontStyle: 'bold' },
                        1: { halign: 'left' },
                        3: { halign: 'right', fontStyle: 'bold' },
                        4: { cellWidth: 22, textColor: colors.accentBlue }
                    },
                    foot: [['', 'TOTAL GERAL', estatisticasProdutos.reduce((a, p) => a + p.qtd, 0).toString(),
                        `R$ ${estatisticasProdutos.reduce((a, p) => a + p.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '100%']],
                    footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                    margin: { top: startY, left: margin.left, right: margin.right },
                    didDrawPage: (data: { pageNumber: number }) => {
                        if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                    }
                });

            } else if (tipoRelatorio === 'clientes') {
                startY += 2;
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(`${estatisticasClientes.length} clientes com pedidos no período`, margin.left, startY);
                startY += 6;

                autoTable(doc, {
                    startY,
                    head: [['#', 'Cliente', 'Pedidos', 'Valor Total', '% Participação']],
                    body: estatisticasClientes.map((c, i) => {
                        const totalGeral = estatisticasClientes.reduce((a, x) => a + x.valor, 0);
                        const pct = totalGeral > 0 ? ((c.valor / totalGeral) * 100).toFixed(1) : '0.0';
                        return [
                            (i + 1).toString(),
                            c.nome,
                            c.pedidos.toString(),
                            `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            `${pct}%`
                        ];
                    }),
                    styles: { fontSize: 8, cellPadding: 3, halign: 'center', lineColor: colors.tableBorder, lineWidth: 0.2 },
                    headStyles: { fillColor: colors.headerDark, textColor: 255, fontStyle: 'bold', cellPadding: 4 },
                    alternateRowStyles: { fillColor: colors.rowEven },
                    columnStyles: {
                        0: { cellWidth: 12, fontStyle: 'bold' },
                        1: { halign: 'left' },
                        3: { halign: 'right', fontStyle: 'bold' },
                        4: { cellWidth: 25, textColor: colors.accentBlue }
                    },
                    foot: [['', 'TOTAL GERAL', estatisticasClientes.reduce((a, c) => a + c.pedidos, 0).toString(),
                        `R$ ${estatisticasClientes.reduce((a, c) => a + c.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '100%']],
                    footStyles: { fillColor: colors.headerDark, textColor: colors.white, fontStyle: 'bold', halign: 'right', cellPadding: 4 },
                    margin: { top: startY, left: margin.left, right: margin.right },
                    didDrawPage: (data: { pageNumber: number }) => {
                        if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                    }
                });

            } else if (tipoRelatorio === 'tabela') {
                // ====== PREMIUM PRICE TABLE — DESIGNED FOR CLIENT DISTRIBUTION ======
                const nomesTabelas: Record<string, string> = {
                    'todas': 'Todas as Tabelas de Preço',
                    '50a199': 'Tabela 50 a 199 unidades',
                    '200a699': 'Tabela 200 a 699 unidades',
                    'atacado': 'Tabela Atacado',
                    'avista': 'Tabela Atacado À Vista',
                    'redes': 'Tabela Redes'
                };

                // Subtitle badge
                startY += 1;
                const subtitleLabel = tabelaPrecoSelecionada !== 'todas' ? nomesTabelas[tabelaPrecoSelecionada] : 'Visão Consolidada — Todas as Tabelas';
                doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
                doc.roundedRect(margin.left, startY, contentWidth, 9, 1.5, 1.5, 'F');
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colors.factoryAccent[0], colors.factoryAccent[1], colors.factoryAccent[2]);
                doc.text(subtitleLabel, margin.left + 5, startY + 6);
                // Product count
                const totalProds = products.filter(p => {
                    if (fabricaSelecionada === 'todas') return true;
                    if (fabricaSelecionada === 'sem-fabrica') return !p.fabricaId;
                    return p.fabricaId === fabricaSelecionada;
                }).length;
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                doc.text(`${totalProds} produtos`, pageWidth - margin.right - 5, startY + 6, { align: 'right' });
                startY += 13;

                // Filter products
                const produtosFiltrados = products.filter(p => {
                    if (fabricaSelecionada === 'todas') return true;
                    if (fabricaSelecionada === 'sem-fabrica') return !p.fabricaId;
                    return p.fabricaId === fabricaSelecionada;
                });

                // Group by factory
                const productsByFabrica = produtosFiltrados.reduce((acc, product) => {
                    const fabricaId = product.fabricaId || 'sem-fabrica';
                    if (!acc[fabricaId]) acc[fabricaId] = [];
                    acc[fabricaId].push(product);
                    return acc;
                }, {} as Record<string, typeof products>);

                const sortedFabricas = Object.keys(productsByFabrica).sort((a, b) => {
                    if (a === 'sem-fabrica') return 1;
                    if (b === 'sem-fabrica') return -1;
                    const nomeA = fabricas.find(f => f.id === a)?.nome || 'Outros';
                    const nomeB = fabricas.find(f => f.id === b)?.nome || 'Outros';
                    return nomeA.localeCompare(nomeB);
                });

                for (const fabricaId of sortedFabricas) {
                    const groupProducts = productsByFabrica[fabricaId];
                    const fabricaNome = fabricaId === 'sem-fabrica'
                        ? 'OUTROS PRODUTOS'
                        : (fabricas.find(f => f.id === fabricaId)?.nome || 'OUTROS').toUpperCase();

                    // Check if enough space for factory header + at least 3 rows
                    if (startY > pageHeight - 50) {
                        doc.addPage();
                        startY = drawHeader(doc, doc.getNumberOfPages());
                    }

                    // ---- FACTORY SECTION HEADER ----
                    // Dark factory banner
                    doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                    doc.roundedRect(margin.left, startY, contentWidth, 9, 1.5, 1.5, 'F');
                    // Blue accent on left edge
                    doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                    doc.rect(margin.left, startY, 3, 9, 'F');
                    // Factory name
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text(fabricaNome, margin.left + 7, startY + 6.2);
                    // Product count badge
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
                    doc.text(`${groupProducts.length} itens`, pageWidth - margin.right - 4, startY + 6.2, { align: 'right' });
                    startY += 10;

                    // ---- TABLE DATA ----
                    let headers: string[][];
                    let bodyData: string[][];

                    if (tabelaPrecoSelecionada === 'todas') {
                        headers = [['CÓD.', 'PRODUTO', '50-199', '200-699', 'ATACADO', 'À VISTA', 'REDES']];
                        bodyData = groupProducts.map(p => [
                            p.codigo,
                            p.nome,
                            `R$ ${(p.preco50a199 || 0).toFixed(2)}`,
                            `R$ ${(p.preco200a699 || 0).toFixed(2)}`,
                            `R$ ${(p.precoAtacado || 0).toFixed(2)}`,
                            `R$ ${(p.precoAtacadoAVista || 0).toFixed(2)}`,
                            `R$ ${(p.precoRedes || 0).toFixed(2)}`
                        ]);
                    } else {
                        headers = [['CÓDIGO', 'PRODUTO', 'PREÇO UNITÁRIO']];
                        bodyData = groupProducts.map(p => {
                            let preco = 0;
                            if (tabelaPrecoSelecionada === '50a199') preco = p.preco50a199 || 0;
                            else if (tabelaPrecoSelecionada === '200a699') preco = p.preco200a699 || 0;
                            else if (tabelaPrecoSelecionada === 'atacado') preco = p.precoAtacado || 0;
                            else if (tabelaPrecoSelecionada === 'avista') preco = p.precoAtacadoAVista || 0;
                            else if (tabelaPrecoSelecionada === 'redes') preco = p.precoRedes || 0;
                            return [p.codigo, p.nome, `R$ ${preco.toFixed(2)}`];
                        });
                    }

                    autoTable(doc, {
                        startY,
                        head: headers,
                        body: bodyData,
                        styles: {
                            fontSize: 7.5,
                            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
                            valign: 'middle',
                            halign: 'center',
                            lineColor: colors.tableBorder,
                            lineWidth: 0.15,
                            textColor: colors.textDark
                        },
                        headStyles: {
                            fillColor: colors.accentBlue,
                            textColor: colors.white,
                            fontStyle: 'bold',
                            halign: 'center',
                            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
                            fontSize: 7
                        },
                        alternateRowStyles: { fillColor: colors.rowEven },
                        margin: { top: 10, left: margin.left, right: margin.right },
                        columnStyles: tabelaPrecoSelecionada === 'todas' ? {
                            0: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
                            1: { halign: 'left' },
                            2: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                            3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                            4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                            5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                            6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
                        } : {
                            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
                            1: { halign: 'left' },
                            2: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: colors.factoryAccent }
                        },
                        tableLineColor: colors.tableBorder,
                        tableLineWidth: 0.15,
                        didDrawPage: (data: { pageNumber: number }) => {
                            if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                        }
                    });

                    // @ts-ignore
                    startY = doc.lastAutoTable.finalY + 8;
                }
            }

            // ====== APPLY FOOTERS TO ALL PAGES ======
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            // ====== SAVE ======
            const nomeArquivo = `FRPlus_${titulosRelatorio[tipoRelatorio].replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(nomeArquivo);

        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setExportando(false);
    };

    return (
        <div className="space-y-5 print:bg-white print:text-black">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-white">Relatórios</h1>
                    <p className="text-sm text-gray-400">
                        {orders.length} pedidos no sistema • {pedidosFiltrados.length} no período selecionado
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportPDF}
                        disabled={exportando}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                    >
                        <FileDown className="h-4 w-4" />
                        {exportando ? 'Gerando...' : 'Exportar PDF'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="form-card print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Tipo de Relatório */}
                    <div>
                        <label className="label-compact">Tipo de Relatório</label>
                        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                            {[
                                { id: 'vendas', label: 'Vendas', icon: TrendingUp },
                                { id: 'produtos', label: 'Produtos', icon: Package },
                                { id: 'clientes', label: 'Clientes', icon: Users },
                                { id: 'tabela', label: 'Tabela de Preços', icon: DollarSign }
                            ].map(tipo => (
                                <button
                                    key={tipo.id}
                                    onClick={() => setTipoRelatorio(tipo.id as typeof tipoRelatorio)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${tipoRelatorio === tipo.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <tipo.icon className="h-3 w-3" />
                                    <span className="hidden sm:inline">{tipo.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Período (Não exibir para Tabela de Preços) */}
                    {tipoRelatorio !== 'tabela' && (
                        <>
                            <div>
                                <label className="label-compact">Período Início</label>
                                <input
                                    type="date"
                                    value={periodoInicio}
                                    onChange={(e) => setPeriodoInicio(e.target.value)}
                                    className="input-compact"
                                />
                            </div>
                            <div>
                                <label className="label-compact">Período Fim</label>
                                <input
                                    type="date"
                                    value={periodoFim}
                                    onChange={(e) => setPeriodoFim(e.target.value)}
                                    className="input-compact"
                                />
                            </div>
                        </>
                    )}

                    {/* Seletor de Tabela de Preços (apenas para relatório de tabela) */}
                    {tipoRelatorio === 'tabela' && (
                        <>
                            <div>
                                <label className="label-compact">Tabela para Exportar</label>
                                <select
                                    value={tabelaPrecoSelecionada}
                                    onChange={(e) => setTabelaPrecoSelecionada(e.target.value as typeof tabelaPrecoSelecionada)}
                                    className="input-compact"
                                >
                                    <option value="todas">Todas as Tabelas</option>
                                    <option value="50a199">50 a 199 unidades</option>
                                    <option value="200a699">200 a 699 unidades</option>
                                    <option value="atacado">Atacado</option>
                                    <option value="avista">Atacado À Vista</option>
                                    <option value="redes">Redes</option>
                                </select>
                            </div>
                            <div>
                                <label className="label-compact">Filtrar por Fábrica</label>
                                <select
                                    value={fabricaSelecionada}
                                    onChange={(e) => setFabricaSelecionada(e.target.value)}
                                    className="input-compact"
                                >
                                    <option value="todas">Todas as Fábricas</option>
                                    {fabricas
                                        .sort((a, b) => a.nome.localeCompare(b.nome))
                                        .map(fabrica => (
                                            <option key={fabrica.id} value={fabrica.id}>
                                                {fabrica.nome}
                                            </option>
                                        ))
                                    }
                                    <option value="sem-fabrica">Sem Fábrica Definida</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div >

            {/* Conteúdo para PDF */}
            < div ref={relatorioRef} className="bg-[#0d0d0d] print:bg-white" >

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <DollarSign className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Total Vendas</p>
                                <p className="text-xl font-bold text-white print:text-black">
                                    R$ {estatisticasVendas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <FileText className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Pedidos</p>
                                <p className="text-xl font-bold text-white print:text-black">{estatisticasVendas.totalPedidos}</p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <BarChart3 className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Ticket Médio</p>
                                <p className="text-xl font-bold text-white print:text-black">
                                    R$ {estatisticasVendas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <Users className="h-5 w-5 text-orange-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Clientes Ativos</p>
                                <p className="text-xl font-bold text-white print:text-black">{estatisticasClientes.length}</p>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Conteúdo do Relatório */}
                {
                    tipoRelatorio === 'vendas' && (
                        <div className="space-y-4">
                            {/* Gráfico de Vendas por Dia */}
                            <div className="form-card">
                                <h3 className="text-lg font-semibold text-white print:text-black mb-4">Vendas por Dia</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-white/10 print:border-gray-300">
                                            <tr>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Data</th>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Clientes</th>
                                                <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(estatisticasVendas.vendasPorDia)
                                                .sort((a, b) => new Date(b[0].split('/').reverse().join('-')).getTime() - new Date(a[0].split('/').reverse().join('-')).getTime())
                                                .map(([dia, valor]) => {
                                                    const clienteSet = estatisticasVendas.clientesPorDia?.[dia];
                                                    const clientesArray = Array.from(clienteSet || []);
                                                    const clientesTexto = clientesArray.slice(0, 3).join(', ') + (clientesArray.length > 3 ? ` e mais ${clientesArray.length - 3}...` : '');

                                                    return (
                                                        <tr key={dia} className="border-b border-white/5 print:border-gray-200">
                                                            <td className="py-2 text-white print:text-black">{dia}</td>
                                                            <td className="py-2 text-xs text-gray-400 print:text-gray-600 max-w-[200px] truncate" title={Array.from(clienteSet || []).join(', ')}>
                                                                {clientesTexto || '-'}
                                                            </td>
                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                                R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Lista de Pedidos */}
                            <div className="form-card">
                                <h3 className="text-lg font-semibold text-white print:text-black mb-4">Detalhamento de Pedidos</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-white/10 print:border-gray-300">
                                            <tr>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Pedido</th>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Cliente</th>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Data</th>
                                                <th className="text-center py-2 text-gray-400 print:text-gray-600">Itens</th>
                                                <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pedidosFiltrados
                                                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                                .map(order => (
                                                    <>
                                                        <tr
                                                            key={order.id}
                                                            className="border-b border-white/5 print:border-gray-200 cursor-pointer hover:bg-white/5 transition-colors"
                                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                        >
                                                            <td className="py-2 font-mono text-white print:text-black">
                                                                <div className="flex items-center gap-2">
                                                                    {expandedOrderId === order.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                                    #{order.id.slice(-6)}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 text-white print:text-black">
                                                                {order.nomeCliente || 'Cliente Desconhecido'}
                                                                {order.tipo === 'Bonificacao' && (
                                                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">BONIF</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 text-gray-400 print:text-gray-600">{new Date(order.data).toLocaleDateString('pt-BR')}</td>
                                                            <td className="py-2 text-center text-gray-400 print:text-gray-600">{order.itens.length}</td>
                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {order.tipo === 'Bonificacao' ? (
                                                                        <span className="text-gray-500 line-through decoration-gray-600">
                                                                            R$ {order.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    ) : (
                                                                        <span>R$ {order.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const phone = clients.find(c => c.id === order.clienteId)?.celular || '';
                                                                            if (!phone) {
                                                                                alert('Cliente sem celular cadastrado');
                                                                                return;
                                                                            }
                                                                            const message = `Olá *${order.nomeCliente}*, segue o resumo do seu pedido *#${order.id.slice(-6)}*:\n\n` +
                                                                                order.itens.map(i => `- ${i.quantidade}x ${i.nomeProduto} (R$ ${i.total.toFixed(2)})`).join('\n') +
                                                                                `\n\n*Total: R$ ${order.valorTotal.toFixed(2)}*`;

                                                                            // Clean phone number
                                                                            const cleanPhone = phone.replace(/\D/g, '');
                                                                            // Use API to send (or fallback to wa.me if API fails/not implemented fully yet)
                                                                            // For now, let's use the API we just built!
                                                                            fetch('/api/whatsapp/send-text', {
                                                                                method: 'POST',
                                                                                body: JSON.stringify({ phone: '55' + cleanPhone, message })
                                                                            }).then(async res => {
                                                                                if (res.ok) alert('Mensagem enviada via Evolution API!');
                                                                                else {
                                                                                    // Fallback to wa.me
                                                                                    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
                                                                                    alert('Erro na API, abrindo WhatsApp Web...');
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="p-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white transition-colors"
                                                                        title="Enviar no WhatsApp"
                                                                    >
                                                                        <MessageCircle size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedOrderId === order.id && (
                                                            <tr className="bg-white/5 print:bg-gray-50">
                                                                <td colSpan={5} className="p-0">
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="p-4"
                                                                    >
                                                                        <div className="bg-black/20 print:bg-white rounded-lg p-3 border border-white/10 print:border-gray-200">
                                                                            <p className="text-sm font-semibold text-white print:text-black mb-2 flex items-center gap-2">
                                                                                <Package size={14} className="text-blue-400" />
                                                                                Itens do Pedido
                                                                            </p>
                                                                            <table className="w-full text-xs">
                                                                                <thead>
                                                                                    <tr className="text-gray-400 print:text-gray-600 border-b border-white/10 print:border-gray-200">
                                                                                        <th className="text-left py-2 font-medium">Produto</th>
                                                                                        <th className="text-center py-2 font-medium">Qtd</th>
                                                                                        <th className="text-right py-2 font-medium">Unitário</th>
                                                                                        <th className="text-right py-2 font-medium">Total</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {order.itens.map(item => (
                                                                                        <tr key={item.id || item.produtoId} className="border-b border-white/5 print:border-gray-100 last:border-0">
                                                                                            <td className="py-2 text-white print:text-black">{item.nomeProduto}</td>
                                                                                            <td className="py-2 text-center text-gray-300 print:text-gray-700">{item.quantidade}</td>
                                                                                            <td className="py-2 text-right text-gray-300 print:text-gray-700">R$ {item.precoUnitario.toFixed(2)}</td>
                                                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">R$ {item.total.toFixed(2)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </motion.div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'produtos' && (
                        <div className="form-card">
                            <h3 className="text-lg font-semibold text-white print:text-black mb-4">Ranking de Produtos</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10 print:border-gray-300">
                                        <tr>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">#</th>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Produto</th>
                                            <th className="text-center py-2 text-gray-400 print:text-gray-600">Qtd Vendida</th>
                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estatisticasProdutos.map((p, index) => (
                                            <tr key={p.nome} className="border-b border-white/5 print:border-gray-200">
                                                <td className="py-2 text-gray-500">{index + 1}</td>
                                                <td className="py-2 text-white print:text-black font-medium">{p.nome}</td>
                                                <td className="py-2 text-center text-gray-400 print:text-gray-600">{p.qtd}</td>
                                                <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                    R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-white/20 print:border-gray-400">
                                        <tr>
                                            <td colSpan={2} className="py-2 font-bold text-white print:text-black">Total</td>
                                            <td className="py-2 text-center font-bold text-white print:text-black">
                                                {estatisticasProdutos.reduce((acc, p) => acc + p.qtd, 0)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-green-400 print:text-green-600">
                                                R$ {estatisticasProdutos.reduce((acc, p) => acc + p.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'clientes' && (
                        <div className="form-card">
                            <h3 className="text-lg font-semibold text-white print:text-black mb-4">Ranking de Clientes</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10 print:border-gray-300">
                                        <tr>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">#</th>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Cliente</th>
                                            <th className="text-center py-2 text-gray-400 print:text-gray-600">Pedidos</th>
                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estatisticasClientes.map((c, index) => (
                                            <Fragment key={c.id}>
                                                <tr
                                                    className="border-b border-white/5 print:border-gray-200 cursor-pointer hover:bg-white/5 transition-colors"
                                                    onClick={() => setExpandedClientId(expandedClientId === c.id ? null : c.id)}
                                                >
                                                    <td className="py-2 text-gray-500">
                                                        <div className="flex items-center gap-2">
                                                            {expandedClientId === c.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                            {index + 1}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-white print:text-black font-medium">{c.nome}</td>
                                                    <td className="py-2 text-center text-gray-400 print:text-gray-600">{c.pedidos}</td>
                                                    <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                        R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                                {expandedClientId === c.id && (
                                                    <tr className="bg-white/5 print:bg-gray-50">
                                                        <td colSpan={4} className="p-0">
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="p-4"
                                                            >
                                                                <div className="bg-black/20 print:bg-white rounded-lg p-3 border border-white/10 print:border-gray-200">
                                                                    <p className="text-sm font-semibold text-white print:text-black mb-2 flex items-center gap-2">
                                                                        <FileText size={14} className="text-blue-400" />
                                                                        Histórico de Pedidos (Neste Período)
                                                                    </p>
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-gray-400 print:text-gray-600 border-b border-white/10 print:border-gray-200">
                                                                                <th className="text-left py-2 font-medium">Data</th>
                                                                                <th className="text-center py-2 font-medium">Pedido</th>
                                                                                <th className="text-center py-2 font-medium">Itens</th>
                                                                                <th className="text-right py-2 font-medium">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {pedidosFiltrados
                                                                                .filter(p => p.clienteId === c.id)
                                                                                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                                                                .map(order => (
                                                                                    <Fragment key={order.id}>
                                                                                        <tr
                                                                                            className="border-b border-white/5 print:border-gray-100 last:border-0 hover:bg-white/5 cursor-pointer transition-colors"
                                                                                            onClick={() => setExpandedClientOrderId(expandedClientOrderId === order.id ? null : order.id)}
                                                                                        >
                                                                                            <td className="py-2 text-gray-300 print:text-gray-700">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    {expandedClientOrderId === order.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                                                    {new Date(order.data).toLocaleDateString('pt-BR')}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-2 text-center text-gray-300 print:text-gray-700 font-mono">#{order.id.slice(-6)}</td>
                                                                                            <td className="py-2 text-center text-gray-300 print:text-gray-700">{order.itens.length}</td>
                                                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">R$ {order.valorTotal.toFixed(2)}</td>
                                                                                        </tr>
                                                                                        {expandedClientOrderId === order.id && (
                                                                                            <tr className="bg-black/20 print:bg-gray-50">
                                                                                                <td colSpan={4} className="p-0">
                                                                                                    <motion.div
                                                                                                        initial={{ opacity: 0, height: 0 }}
                                                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                                                        exit={{ opacity: 0, height: 0 }}
                                                                                                        className="p-3 pl-8"
                                                                                                    >
                                                                                                        <div className="bg-white/5 print:bg-white rounded border border-white/10 print:border-gray-200 p-2">
                                                                                                            <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                                                                                                                <Package size={12} /> Itens Comprados
                                                                                                            </p>
                                                                                                            <table className="w-full text-[10px]">
                                                                                                                <thead>
                                                                                                                    <tr className="text-gray-500 border-b border-white/10">
                                                                                                                        <th className="text-left py-1">Produto</th>
                                                                                                                        <th className="text-center py-1">Qtd</th>
                                                                                                                        <th className="text-right py-1">Total</th>
                                                                                                                    </tr>
                                                                                                                </thead>
                                                                                                                <tbody>
                                                                                                                    {order.itens.map(item => (
                                                                                                                        <tr key={item.id || item.produtoId} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                                                                                                            <td className="py-1 text-gray-300 print:text-black">{item.nomeProduto}</td>
                                                                                                                            <td className="py-1 text-center text-gray-400">{item.quantidade}</td>
                                                                                                                            <td className="py-1 text-right text-green-400 print:text-green-600">R$ {item.total.toFixed(2)}</td>
                                                                                                                        </tr>
                                                                                                                    ))}
                                                                                                                </tbody>
                                                                                                            </table>
                                                                                                        </div>
                                                                                                    </motion.div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </Fragment>
                                                                                ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </motion.div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-white/20 print:border-gray-400">
                                        <tr>
                                            <td colSpan={2} className="py-2 font-bold text-white print:text-black">Total</td>
                                            <td className="py-2 text-center font-bold text-white print:text-black">
                                                {estatisticasClientes.reduce((acc, c) => acc + c.pedidos, 0)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-green-400 print:text-green-600">
                                                R$ {estatisticasClientes.reduce((acc, c) => acc + c.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'tabela' && (
                        <div className="space-y-8">
                            {(() => {
                                // Filtrar produtos pela fábrica selecionada
                                const produtosFiltrados = products.filter(p => {
                                    if (fabricaSelecionada === 'todas') return true;
                                    if (fabricaSelecionada === 'sem-fabrica') return !p.fabricaId;
                                    return p.fabricaId === fabricaSelecionada;
                                });

                                // Agrupar produtos por fábrica
                                const productsByFabrica = produtosFiltrados.reduce((acc, product) => {
                                    const fabricaId = product.fabricaId || 'sem-fabrica';
                                    if (!acc[fabricaId]) {
                                        acc[fabricaId] = [];
                                    }
                                    acc[fabricaId].push(product);
                                    return acc;
                                }, {} as Record<string, typeof products>);

                                const sortedFabricas = Object.keys(productsByFabrica).sort((a, b) => {
                                    const nomeA = a === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === a)?.nome || 'Outros');
                                    const nomeB = b === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === b)?.nome || 'Outros');
                                    if (a === 'sem-fabrica') return 1;
                                    if (b === 'sem-fabrica') return -1;
                                    return nomeA.localeCompare(nomeB);
                                });

                                return sortedFabricas.map(fabricaId => {
                                    const groupProducts = productsByFabrica[fabricaId];
                                    const fabricaNome = fabricaId === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === fabricaId)?.nome || 'Outros');

                                    return (
                                        <div key={fabricaId} className="form-card break-inside-avoid">
                                            <div className="flex items-center justify-between mb-4 print:mb-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-white print:text-black uppercase tracking-wider">{fabricaNome}</h3>
                                                    <span className="text-sm text-gray-400 print:text-gray-600">({groupProducts.length} itens)</span>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="border-b border-white/10 print:border-gray-300">
                                                        <tr>
                                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Código</th>
                                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Produto</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">50-199</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">200-699</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Atacado</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">À Vista</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Redes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groupProducts.map((p) => (
                                                            <tr key={p.id} className="border-b border-white/5 print:border-gray-200 hover:bg-white/5 print:hover:bg-transparent transition-colors">
                                                                <td className="py-2 font-mono text-gray-400 print:text-gray-600 text-xs">{p.codigo}</td>
                                                                <td className="py-2 text-white print:text-black font-medium">{p.nome}</td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.preco50a199?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.preco200a699?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoAtacado?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoAtacadoAVista?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoRedes?.toFixed(2) || '0.00'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
