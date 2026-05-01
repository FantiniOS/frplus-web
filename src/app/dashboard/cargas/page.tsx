/* eslint-disable */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Truck, Printer, Info, CheckSquare, Square, Check, AlertTriangle, Package, Loader2 } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { MonthSelector } from "@/components/ui/MonthSelector";

interface CargaResult {
    id: number;
    orders: any[];
    totalVolume: number;
    capacity: number;
    occupancyPct: number;
    isPalletized?: boolean;
    hasRestrictedClient?: boolean;
    zonas: string[];
    freteEstimado?: number;
    kmEstimado?: number;
    origem?: string;
}

export default function MontagemCargasPage() {
    const { orders, fabricas, refreshOrders, clients } = useData();
    const { isIndustria } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFabrica, setSelectedFabrica] = useState<string>('todas');
    
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [truckCapacity, setTruckCapacity] = useState<number>(1360);
    const [truckPalletCapacity, setTruckPalletCapacity] = useState<number>(1080);
    const [palletizedOrders, setPalletizedOrders] = useState<Record<string, boolean>>({});
    const [generatedTrucks, setGeneratedTrucks] = useState<CargaResult[]>([]);
    const [exportando, setExportando] = useState(false);
    const [custoAdicionalKm, setCustoAdicionalKm] = useState<number | ''>(2.50);

    useEffect(() => {
        refreshOrders(selectedFabrica);
    }, [selectedFabrica, refreshOrders]);

    const getDataPedido = (order: any): string | null => {
        return order.dataPedido || order.data || order.createdAt || null;
    };

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return 'Sem data';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return 'Sem data';
        }
    };

    const getVolume = (order: any) => order.itens?.reduce((acc: number, i: any) => acc + (Number(i.quantidade) || 0), 0) || 0;

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesSearch = (order.nomeCliente || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (order.notaFiscal || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  order.id.includes(searchTerm);

            let matchesMonth = true;
            if (selectedMonth) {
                const rawDate = getDataPedido(order);
                if (rawDate) {
                    const orderDate = new Date(rawDate).toISOString().slice(0, 7);
                    matchesMonth = orderDate === selectedMonth;
                } else {
                    matchesMonth = false;
                }
            }

            return matchesSearch && matchesMonth;
        });
    }, [orders, searchTerm, selectedMonth]);

    const toggleOrderSelection = (id: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedOrderIds(newSet);
        // Clear generated trucks if selection changes so they have to regenerate
        setGeneratedTrucks([]);
    };

    const toggleAllSelection = () => {
        if (selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0) {
            setSelectedOrderIds(new Set());
        } else {
            const newSet = new Set<string>();
            filteredOrders.forEach(o => newSet.add(o.id));
            setSelectedOrderIds(newSet);
        }
        setGeneratedTrucks([]);
    };

    const selectedOrdersList = filteredOrders.filter(o => selectedOrderIds.has(o.id));
    const totalSelectedVolume = selectedOrdersList.reduce((acc, o) => acc + getVolume(o), 0);

    const isRestricted = (clientName: string) => {
        const upper = (clientName || '').toUpperCase();
        return upper.includes('BH') || upper.includes('DMA');
    };

    const isOrderPalletized = (order: any) => {
        if (palletizedOrders[order.id] !== undefined) return palletizedOrders[order.id];
        return false;
    };

    const toggleOrderPalletized = (order: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setPalletizedOrders(prev => ({
            ...prev,
            [order.id]: !isOrderPalletized(order)
        }));
        setGeneratedTrucks([]);
    };

    const gerarRomaneio = () => {
        if (selectedOrdersList.length === 0) return;

        const capacityNormal = Number(truckCapacity) || 1360;
        const capacityPallet = Number(truckPalletCapacity) || 1080;

        // PASSO 1: AGRUPAMENTO POR CLIENTE E ZONA GEOGRÁFICA (Pre-processing)
        const clientGroups: Record<string, {
            nomeCliente: string;
            totalVolume: number;
            isPalletized: boolean;
            orders: any[];
            cepPrefix: string;
        }> = {};

        selectedOrdersList.forEach(order => {
            const clientName = order.nomeCliente || 'Desconhecido';
            if (!clientGroups[clientName]) {
                const clientObj = clients.find(c => c.id === order.clienteId || c.nomeFantasia === order.nomeCliente || c.razaoSocial === order.nomeCliente);
                const cepSeguro = clientObj?.cep ? String(clientObj.cep).replace(/\D/g, '') : '00000000';
                const cepPrefix = cepSeguro.substring(0, 4) || '0000';

                clientGroups[clientName] = {
                    nomeCliente: clientName,
                    totalVolume: 0,
                    isPalletized: false,
                    orders: [],
                    cepPrefix
                };
            }
            clientGroups[clientName].orders.push(order);
            clientGroups[clientName].totalVolume += getVolume(order);
            if (isOrderPalletized(order)) {
                clientGroups[clientName].isPalletized = true;
            }
        });

        // PASSO 2: TRATAMENTO DE CLIENTES GIGANTES (Overflow)
        const blocksToPack: any[] = [];
        
        Object.values(clientGroups).forEach(group => {
            let remainingVolume = group.totalVolume;
            const limit = group.isPalletized ? capacityPallet : capacityNormal;

            while (remainingVolume > 0) {
                if (remainingVolume > limit) {
                    blocksToPack.push({
                        nomeCliente: group.nomeCliente,
                        volume: limit,
                        isPalletized: group.isPalletized,
                        isBlock: true,
                        orders: [...group.orders],
                        cepPrefix: group.cepPrefix
                    });
                    remainingVolume -= limit;
                } else {
                    blocksToPack.push({
                        nomeCliente: group.nomeCliente,
                        volume: remainingVolume,
                        isPalletized: group.isPalletized,
                        isBlock: true,
                        orders: [...group.orders],
                        cepPrefix: group.cepPrefix
                    });
                    remainingVolume = 0;
                }
            }
        });

        // PASSO 3: APLICAÇÃO DO BEST FIT (Tetris do Cliente + Zonas)
        // Ordenar primeiro pelo prefixo do CEP, depois por volume
        blocksToPack.sort((a, b) => {
            if (a.cepPrefix !== b.cepPrefix) {
                return a.cepPrefix.localeCompare(b.cepPrefix);
            }
            return b.volume - a.volume;
        });

        const trucks: CargaResult[] = [];
        let currentTruckId = 1;

        for (const block of blocksToPack) {
            const vol = block.volume;
            const blockPalletized = block.isPalletized;
            const blockRestricted = isRestricted(block.nomeCliente);
            let placed = false;
            
            let bestTruckIndex = -1;
            let bestScore = -Infinity;

            for (let i = 0; i < trucks.length; i++) {
                const truck = trucks[i];
                
                // TRAVA NA DISTRIBUIÇÃO: Caminhão só pode ter um cliente restrito ("Última Entrega")
                if (blockRestricted && truck.hasRestrictedClient) {
                    continue;
                }

                // B. TETO DINÂMICO: Se o bloco for paletizado, a capacidade cai
                const newTruckPalletized = truck.isPalletized || blockPalletized;
                const effectiveCapacity = newTruckPalletized ? capacityPallet : capacityNormal;
                
                // Avalia se o bloco cabe integralmente no espaço restante
                if (truck.totalVolume + vol <= effectiveCapacity) {
                    const remainingSpace = effectiveCapacity - (truck.totalVolume + vol);
                    
                    // Score = minimiza espaço vazio (Best Fit)
                    let score = -remainingSpace;

                    // Bônus se o caminhão já estiver atendendo essa zona
                    if (truck.zonas.includes(block.cepPrefix)) {
                        score += 100000;
                    }

                    if (bestTruckIndex === -1 || score > bestScore) {
                        bestTruckIndex = i;
                        bestScore = score;
                    }
                }
            }

            if (bestTruckIndex !== -1) {
                const truck = trucks[bestTruckIndex];
                truck.orders.push(block);
                truck.totalVolume += vol;
                if (!truck.zonas.includes(block.cepPrefix)) {
                    truck.zonas.push(block.cepPrefix);
                }
                const newTruckPalletized = truck.isPalletized || blockPalletized;
                truck.isPalletized = newTruckPalletized;
                truck.capacity = newTruckPalletized ? capacityPallet : capacityNormal;
                if (blockRestricted) truck.hasRestrictedClient = true;
                placed = true;
            }

            // Se não couber em nenhum, instancia um Caminhão Novo
            if (!placed) {
                const effectiveCapacity = blockPalletized ? capacityPallet : capacityNormal;
                trucks.push({
                    id: currentTruckId++,
                    orders: [block],
                    totalVolume: vol,
                    capacity: effectiveCapacity,
                    occupancyPct: 0,
                    isPalletized: blockPalletized,
                    hasRestrictedClient: blockRestricted,
                    zonas: [block.cepPrefix]
                });
            }
        }

        // Calcular porcentagem de ocupação e frete estimado
        const valKm = Number(custoAdicionalKm) || 0;

        const fabricaObj = fabricas.find(f => f.id === selectedFabrica);
        const nomeFab = (fabricaObj?.nome || '').toLowerCase();
        const isBelmont = nomeFab.includes('belmont');

        const origemData = isBelmont 
            ? { cep: "1868", nome: "Lençóis Paulista/SP" } 
            : { cep: "3221", nome: "Contagem/MG" };

        trucks.forEach(t => {
            t.occupancyPct = Math.round((t.totalVolume / t.capacity) * 100);
            t.origem = origemData.nome;
            
            if (isBelmont) {
                // Lógica Interestadual (SP -> MG)
                const transferKm = 697;
                const lastMileKm = t.zonas.length * 15;
                t.kmEstimado = transferKm + lastMileKm;
                
                const custoKmCarreta = 6.50;
                const custoPedagio = 450;
                const custoBaseTransferencia = (transferKm * custoKmCarreta) + custoPedagio;
                
                const custoPorZona = t.zonas.length * 50;
                t.freteEstimado = custoBaseTransferencia + custoPorZona;
            } else {
                // Lógica Local (MG)
                let maxDist = 0;
                t.zonas.forEach(z => {
                    const dist = Math.abs(Number(origemData.cep) - Number(z));
                    if (dist > maxDist) maxDist = dist;
                });

                t.kmEstimado = t.zonas.length * 15;

                if (maxDist === 0) {
                    t.freteEstimado = 300;
                } else if (maxDist <= 2) {
                    t.freteEstimado = 500;
                } else {
                    t.freteEstimado = 800 + (t.kmEstimado * valKm);
                }
            }
        });

        setGeneratedTrucks(trucks);
    };

    const handleExportPDF = async () => {
        if (generatedTrucks.length === 0) return;
        setExportando(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };

            const colors = {
                headerDark: [10, 10, 14] as [number, number, number],
                accentBlue: [37, 99, 235] as [number, number, number],
                accentCyan: [6, 182, 212] as [number, number, number],
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
                textLight: [200, 200, 220] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                rowEven: [250, 251, 254] as [number, number, number],
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
                pageDoc.text('Ordem de Embarque', pageWidth - margin.right, 14, { align: 'right' });

                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

                if (pageNum > 1) {
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
                pageDoc.text('Documento gerado eletronicamente', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            let startY = 43; // initial startY
            
            // Draw Subtitle / Summary (only on page 1)
            doc.setFontSize(9);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            const facName = selectedFabrica === 'todas' ? 'Todas' : fabricas.find(f => f.id === selectedFabrica)?.nome || selectedFabrica;
            doc.text(`Fábrica: ${facName}`, margin.left, startY + 5);
            doc.text(`Veículos: ${generatedTrucks.length}`, margin.left + 50, startY + 5);
            doc.text(`Vol. Alocado: ${generatedTrucks.reduce((acc, t) => acc + t.totalVolume, 0)} cxs`, margin.left + 85, startY + 5);
            

            
            startY += 12;

            // Draw Each Truck
            generatedTrucks.forEach((truck) => {
                const sortedOrders = [...truck.orders].sort((a, b) => {
                    const aRestricted = isRestricted(a.nomeCliente);
                    const bRestricted = isRestricted(b.nomeCliente);
                    if (aRestricted && !bRestricted) return 1;
                    if (!aRestricted && bRestricted) return -1;
                    return 0;
                });

                const bodyData = sortedOrders.map(o => {
                    let cName = o.nomeCliente;
                    if (isRestricted(cName)) cName += ' [ÚLTIMA ENTREGA]';
                    
                    // Extrair NFs dos pedidos internos do bloco
                    const nfs = (o.orders || [o])
                        .map((p: any) => p.notaFiscal || '')
                        .filter((nf: string) => nf !== '')
                        .join(', ');
                    
                    return [cName, nfs || '—', o.isBlock ? o.volume.toString() : getVolume(o).toString()];
                });

                let truckTitle = `Caminhão ${truck.id} — Ocupação: ${truck.occupancyPct}% — Vol: ${truck.totalVolume}/${truck.capacity} cxs ${truck.isPalletized ? '(Paletizado)' : ''}`;

                if (truck.origem && truck.zonas) {
                    truckTitle += ` | Rota: ${truck.origem} -> ${truck.zonas?.join(', ')}`;
                }

                autoTable(doc, {
                    startY,
                    head: [[truckTitle, 'Nota Fiscal', 'Cxs']],
                    body: bodyData,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 3, textColor: colors.textDark, lineColor: colors.tableBorder },
                    headStyles: { fillColor: [240, 240, 245], textColor: colors.textDark, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: colors.rowEven },
                    columnStyles: {
                        0: { halign: 'left' },
                        1: { halign: 'center', cellWidth: 35, fontSize: 7 },
                        2: { halign: 'right', cellWidth: 18, fontStyle: 'bold', textColor: colors.accentBlue }
                    },
                    margin: { top: 45, bottom: 20, left: margin.left, right: margin.right },
                    pageBreak: 'avoid',
                });
                
                // Get Y position after table
                startY = (doc as any).lastAutoTable.finalY + 8;
            });

            // Add Headers and footers on ALL pages
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawHeader(doc, i);
                drawFooter(doc, i, pageCount);
            }

            doc.save(`Romaneio_Cargas_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert("Erro ao gerar PDF.");
        } finally {
            setExportando(false);
        }
    };

    const getOccupancyColor = (pct: number) => {
        if (pct >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (pct >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 h-full pb-8">


            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
                        <Truck className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Montagem de Cargas</h1>
                        <p className="text-xs text-gray-500">Romaneio Inteligente de Pedidos Faturados</p>
                    </div>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="relative z-30 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06] backdrop-blur-sm">
                {!isIndustria && fabricas.length > 0 && (
                    <select
                        value={selectedFabrica}
                        onChange={(e) => setSelectedFabrica(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    >
                        <option value="todas" className="bg-[#0f172a]">Todas as Representadas</option>
                        {fabricas.map((fab) => (
                            <option key={fab.id} value={fab.id} className="bg-[#0f172a]">{fab.nome}</option>
                        ))}
                    </select>
                )}
                
                <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />

                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar cliente ou pedido..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
                {/* LEFT COLUMN: SELECTION TABLE */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm flex flex-col flex-1 max-h-[600px] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0c1220] border-b border-white/[0.06]">
                            <h2 className="text-sm font-semibold text-gray-200">Selecione os Pedidos (Prontos na Fábrica)</h2>
                            <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400">{filteredOrders.length} encontrados</span>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-[#0c1220] border-b border-white/[0.08]">
                                    <tr>
                                        <th className="px-3 py-2.5 w-12 text-center">
                                            <button 
                                                onClick={toggleAllSelection}
                                                className="text-gray-400 hover:text-white focus:outline-none"
                                            >
                                                {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                                                    <CheckSquare className="h-4 w-4 text-blue-400" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Data</th>
                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Cliente</th>
                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Pedido/NF</th>
                                        <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Paletizado?</th>
                                        <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Volume (Cxs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!filteredOrders || filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-600">
                                                <p className="text-sm">Nenhum pedido encontrado para os filtros atuais.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOrders?.map((order, idx) => {
                                            const isSelected = selectedOrderIds.has(order.id);
                                            const vol = getVolume(order);
                                            return (
                                                <tr 
                                                    key={order.id} 
                                                    onClick={() => toggleOrderSelection(order.id)}
                                                    className={`border-b border-white/[0.03] cursor-pointer transition-all ${
                                                        isSelected ? 'bg-blue-500/10' : idx % 2 === 0 ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-white/[0.015] hover:bg-white/[0.03]'
                                                    }`}
                                                >
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex justify-center items-center">
                                                            {isSelected ? (
                                                                <CheckSquare className="h-4 w-4 text-blue-400" />
                                                            ) : (
                                                                <Square className="h-4 w-4 text-gray-500" />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-xs font-mono text-gray-400">{formatDate(getDataPedido(order))}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-200 truncate max-w-[200px]">{order.nomeCliente}</span>
                                                            {isRestricted(order.nomeCliente) && (
                                                                <span className="text-[9px] text-orange-400 uppercase tracking-wider font-semibold mt-0.5">Restrição DMA/BH</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 hidden md:table-cell">
                                                        <span className="text-xs text-gray-500">{order.notaFiscal || order.id.slice(0,8)}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5" onClick={(e) => toggleOrderPalletized(order, e)}>
                                                        <div className={`mx-auto w-8 h-4 rounded-full transition-colors relative cursor-pointer ${isOrderPalletized(order) ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-white/10'}`}>
                                                            <div className={`absolute top-[1px] w-3 h-3 rounded-full transition-all ${isOrderPalletized(order) ? 'bg-purple-400 left-[16px]' : 'bg-gray-500 left-[2px]'}`}></div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="text-sm font-bold text-cyan-400 tabular-nums">{vol}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: CONTROLS & SUMMARY */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="rounded-xl border border-white/[0.06] bg-[#0c1220] p-4 flex flex-col gap-4 shadow-xl">
                        <h2 className="text-sm font-semibold text-gray-200 border-b border-white/10 pb-2">Parâmetros do Romaneio</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-400">Cap. Caminhão Batido (Cxs)</label>
                                <input 
                                    type="number" 
                                    value={truckCapacity} 
                                    onChange={(e) => setTruckCapacity(Number(e.target.value))}
                                    className="bg-[#0a0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-400">Cap. Caminhão Paletizado</label>
                                <input 
                                    type="number" 
                                    value={truckPalletCapacity} 
                                    onChange={(e) => setTruckPalletCapacity(Number(e.target.value))}
                                    className="bg-[#0a0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-full"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-400">Custo Adicional / Km (R$)</label>
                                <input 
                                    type="number" 
                                    value={custoAdicionalKm} 
                                    onChange={(e) => setCustoAdicionalKm(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="bg-[#0a0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 w-full"
                                    placeholder="Ex: 2.50"
                                    step="0.10"
                                />
                            </div>
                        </div>

                        <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/10 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Pedidos Selecionados</span>
                                <span className="text-sm font-bold text-white">{selectedOrderIds.size}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Volume Total</span>
                                <span className="text-sm font-bold text-cyan-400">{totalSelectedVolume} <span className="text-xs font-normal">Cxs</span></span>
                            </div>
                        </div>

                        <button 
                            onClick={gerarRomaneio}
                            disabled={selectedOrderIds.size === 0}
                            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                selectedOrderIds.size > 0 
                                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20' 
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <Truck className="h-4 w-4" />
                            Gerar Sugestão de Romaneio
                        </button>
                    </div>

                    {generatedTrucks.length > 0 && (
                        <div className="rounded-xl border border-white/[0.06] bg-emerald-500/5 p-4 flex flex-col gap-3">
                            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Pronto para Exportar</h3>
                            <button 
                                onClick={handleExportPDF}
                                disabled={exportando}
                                className="w-full py-2 rounded-lg font-semibold text-sm bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                            >
                                {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                {exportando ? 'Gerando...' : 'Exportar (PDF)'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* RESULTS GRID */}
            {generatedTrucks.length > 0 && (
                <div className="mt-4 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center flex-wrap gap-2">
                        <h2 className="text-lg font-bold text-white">Resultado do Romaneio</h2>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{generatedTrucks.length} Caminhões</span>
                        
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg text-emerald-400 font-semibold shadow-inner">
                                Frete Estimado Total: R$ {generatedTrucks.reduce((acc, t) => acc + (t.freteEstimado || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {generatedTrucks?.map((truck) => {
                            const colorClass = getOccupancyColor(truck.occupancyPct);
                            return (
                                <div key={truck.id} className="rounded-xl border border-white/[0.08] bg-[#0c1220] overflow-hidden flex flex-col shadow-lg">
                                    {/* Truck Header */}
                                    <div className="p-3 border-b border-white/[0.06] bg-black/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <Truck className="h-4 w-4 text-blue-400" />
                                                <span className="font-bold text-white uppercase">Caminhão {truck.id}</span>
                                                {truck.isPalletized && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 ml-1 flex items-center gap-1">
                                                        <Package className="h-2.5 w-2.5" /> Paletizado
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                                                Ocupação: {truck.occupancyPct}%
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xs text-gray-400 uppercase font-semibold text-[10px]">Volume Total</span>
                                                <span className="text-sm font-bold text-cyan-400">{truck.totalVolume} / {truck.capacity} <span className="text-[10px] font-normal text-gray-500">cxs</span></span>
                                            </div>
                                            <div className="w-full bg-[#0a0f1a] h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${truck.occupancyPct >= 90 ? 'bg-emerald-500' : truck.occupancyPct >= 70 ? 'bg-amber-500' : 'bg-red-500'} transition-all duration-1000`} 
                                                    style={{ width: `${Math.min(truck.occupancyPct, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Truck Content (Orders) */}
                                    <div className="flex-1 p-0 overflow-y-auto max-h-[300px]">
                                        <table className="w-full text-xs">
                                            <thead className="bg-[#0a0f1a] border-b border-white/[0.04]">
                                                <tr>
                                                    <th className="text-left text-[9px] text-gray-500 uppercase px-3 py-1.5 font-semibold">Cliente</th>
                                                    <th className="text-right text-[9px] text-gray-500 uppercase px-3 py-1.5 font-semibold w-12">Cxs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {truck.orders?.map((order, idx) => {
                                                    const restricted = isRestricted(order.nomeCliente);
                                                    return (
                                                        <tr key={idx} className="border-b border-white/[0.02]">
                                                            <td className="px-3 py-2">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-medium text-gray-300 text-[10px] leading-tight">{order.nomeCliente}</span>
                                                                    {restricted && (
                                                                        <span className="text-[9px] font-bold uppercase text-red-500">
                                                                            * Última Entrega
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span className="font-mono text-cyan-400 text-[10px] font-semibold">{order.isBlock ? order.volume : getVolume(order)}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Financial Footer */}
                                    {truck.freteEstimado !== undefined && truck.totalVolume > 0 && (
                                        <div className="p-3 border-t border-white/[0.06] bg-[#080b12] flex flex-col gap-1.5 mt-auto">
                                            <div className="flex flex-col gap-1 mb-1 border-b border-white/[0.04] pb-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-gray-500 uppercase font-semibold">Trajeto</span>
                                                    <span className="text-[10px] text-gray-400 text-right">{truck.origem} <span className="text-gray-600">→</span> {truck.zonas?.join(', ') || ''}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-gray-500 uppercase font-semibold">Distância Estimada</span>
                                                    <span className="text-[10px] text-cyan-400 font-semibold">{truck.kmEstimado} km</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-gray-500 uppercase font-semibold">Frete Estimado</span>
                                                <span className="text-xs font-bold text-gray-300">R$ {truck.freteEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-gray-500 uppercase font-semibold">Custo por Caixa</span>
                                                <span className={`text-xs font-bold ${(truck.freteEstimado / truck.totalVolume) > 1.5 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                    R$ {(truck.freteEstimado / truck.totalVolume).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
}
