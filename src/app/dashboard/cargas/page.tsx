/* eslint-disable */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Truck, Printer, Info, CheckSquare, Square, Check, AlertTriangle, Package } from "lucide-react";
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
}

export default function MontagemCargasPage() {
    const { orders, fabricas, refreshOrders } = useData();
    const { isIndustria } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFabrica, setSelectedFabrica] = useState<string>('todas');
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [truckCapacity, setTruckCapacity] = useState<number>(1360);
    const [truckPalletCapacity, setTruckPalletCapacity] = useState<number>(1080);
    const [palletizedOrders, setPalletizedOrders] = useState<Record<string, boolean>>({});
    const [generatedTrucks, setGeneratedTrucks] = useState<CargaResult[]>([]);

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

        // PASSO 1: AGRUPAMENTO POR CLIENTE (Pre-processing)
        const clientGroups: Record<string, {
            nomeCliente: string;
            totalVolume: number;
            isPalletized: boolean;
            orders: any[];
        }> = {};

        selectedOrdersList.forEach(order => {
            const clientName = order.nomeCliente || 'Desconhecido';
            if (!clientGroups[clientName]) {
                clientGroups[clientName] = {
                    nomeCliente: clientName,
                    totalVolume: 0,
                    isPalletized: false,
                    orders: []
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
                        orders: [...group.orders]
                    });
                    remainingVolume -= limit;
                } else {
                    blocksToPack.push({
                        nomeCliente: group.nomeCliente,
                        volume: remainingVolume,
                        isPalletized: group.isPalletized,
                        isBlock: true,
                        orders: [...group.orders]
                    });
                    remainingVolume = 0;
                }
            }
        });

        // PASSO 3: APLICAÇÃO DO BEST FIT (Tetris do Cliente)
        // Ordenar decrescente por volume
        blocksToPack.sort((a, b) => b.volume - a.volume);

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
                    const score = -remainingSpace;

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
                    hasRestrictedClient: blockRestricted
                });
            }
        }

        // Calcular porcentagem de ocupação
        trucks.forEach(t => {
            t.occupancyPct = Math.round((t.totalVolume / t.capacity) * 100);
        });

        setGeneratedTrucks(trucks);
    };

    const handlePrint = () => {
        window.print();
    };

    const getOccupancyColor = (pct: number) => {
        if (pct >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (pct >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 h-full pb-8">


            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
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
            <div className="relative z-30 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06] backdrop-blur-sm print:hidden">
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
                <div className="lg:col-span-2 flex flex-col gap-4 print:hidden">
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
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-600">
                                                <p className="text-sm">Nenhum pedido encontrado para os filtros atuais.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map((order, idx) => {
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
                <div className="lg:col-span-1 flex flex-col gap-4 print:hidden">
                    <div className="rounded-xl border border-white/[0.06] bg-[#0c1220] p-4 flex flex-col gap-4 shadow-xl">
                        <h2 className="text-sm font-semibold text-gray-200 border-b border-white/10 pb-2">Parâmetros do Romaneio</h2>
                        
                        <div className="grid grid-cols-2 gap-3">
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
                                onClick={handlePrint}
                                className="w-full py-2 rounded-lg font-semibold text-sm bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                            >
                                <Printer className="h-4 w-4" />
                                Exportar (PDF / Imprimir)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* RESULTS GRID - Visible in print and screen if generated */}
            {generatedTrucks.length > 0 && (
                <div 
                    className="mt-4 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 print:absolute print:top-0 print:left-0 print:w-full print:h-auto print:min-h-screen print:overflow-visible print:bg-white print:text-black print:z-[99999] print:m-0 print:p-8"
                    style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                >
                    
                    {/* CABEÇALHO OFICIAL (Apenas Impressão) */}
                    <div className="hidden print:flex flex-col bg-[#0c1220] text-white p-6 rounded-t-xl mb-6 shadow-md border-b-4 border-blue-500">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500 rounded-lg">
                                    <Truck className="h-6 w-6 text-white" />
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight">FRPlus <span className="font-light text-blue-300">| Ordem de Embarque e Roteirização</span></h1>
                            </div>
                            <span className="text-sm font-mono text-blue-200">Gerado em: {new Date().toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="flex gap-8 text-sm font-medium">
                                <div className="flex flex-col">
                                    <span className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">Fábrica</span>
                                    <span>{selectedFabrica === 'todas' ? 'Todas' : fabricas.find(f => f.id === selectedFabrica)?.nome || selectedFabrica}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">Cap. Base</span>
                                    <span>{truckCapacity} cxs</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">Cap. Paletizada</span>
                                    <span>{truckPalletCapacity} cxs</span>
                                </div>
                            </div>
                            <div className="flex gap-8 text-sm font-bold">
                                <div className="flex flex-col text-right">
                                    <span className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">Total de Veículos</span>
                                    <span className="text-xl">{generatedTrucks.length}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">Volume Alocado</span>
                                    <span className="text-xl text-cyan-400">{generatedTrucks.reduce((acc, t) => acc + t.totalVolume, 0)} <span className="text-sm font-normal text-white">cxs</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <h2 className="text-lg font-bold text-white">Resultado do Romaneio</h2>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{generatedTrucks.length} Caminhões</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-4">
                        {generatedTrucks.map((truck) => {
                            const colorClass = getOccupancyColor(truck.occupancyPct);
                            return (
                                <div key={truck.id} className="rounded-xl border border-white/[0.08] bg-[#0c1220] overflow-hidden flex flex-col shadow-lg print:border-gray-300 print:border print:bg-white print:shadow-sm print:break-inside-avoid print:overflow-visible print:rounded-lg">
                                    {/* Truck Header */}
                                    <div className="p-3 border-b border-white/[0.06] print:border-gray-200 bg-black/20 print:bg-gray-50">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <Truck className="h-4 w-4 text-blue-400 print:text-blue-600" />
                                                <span className="font-bold text-white print:text-black">Caminhão {truck.id}</span>
                                                {truck.isPalletized && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 print:border-purple-600 print:text-white print:bg-purple-600 ml-1 flex items-center gap-1">
                                                        <Package className="h-2.5 w-2.5" /> Carga Paletizada
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${colorClass} print:border-gray-400 print:text-gray-800 print:bg-white`}>
                                                Ocupação: {truck.occupancyPct}%
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xs text-gray-400 print:text-gray-600">Volume Total</span>
                                                <span className="text-sm font-bold text-cyan-400 print:text-black">{truck.totalVolume} / {truck.capacity} <span className="text-[10px] font-normal text-gray-500">cxs</span></span>
                                            </div>
                                            <div className="w-full bg-[#0a0f1a] print:bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${truck.occupancyPct >= 90 ? 'bg-emerald-500 print:bg-emerald-500' : truck.occupancyPct >= 70 ? 'bg-amber-500 print:bg-amber-500' : 'bg-red-500 print:bg-red-500'} transition-all duration-1000`} 
                                                    style={{ width: `${Math.min(truck.occupancyPct, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Truck Content (Orders) */}
                                    <div className="flex-1 p-0 overflow-y-auto max-h-[300px] print:max-h-none print:overflow-visible">
                                        <table className="w-full text-xs">
                                            <thead className="bg-[#0a0f1a] print:bg-gray-100 border-b border-white/[0.04] print:border-gray-200">
                                                <tr>
                                                    <th className="text-left text-[9px] text-gray-500 print:text-gray-700 uppercase px-3 py-1.5 font-semibold">Cliente</th>
                                                    <th className="text-right text-[9px] text-gray-500 print:text-gray-700 uppercase px-3 py-1.5 font-semibold w-12">Cxs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {truck.orders.map((order, idx) => {
                                                    const restricted = isRestricted(order.nomeCliente);
                                                    return (
                                                        <tr key={idx} className="border-b border-white/[0.02] print:border-gray-200 print:even:bg-gray-50 print:odd:bg-white">
                                                            <td className="px-3 py-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-medium text-gray-300 print:text-black leading-tight">{order.nomeCliente}</span>
                                                                    {restricted && (
                                                                        <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 w-fit print:text-white print:border-red-600 print:bg-red-600">
                                                                            <AlertTriangle className="h-2 w-2" />
                                                                            Última Entrega
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span className="font-mono text-cyan-400 print:text-black font-semibold">{order.isBlock ? order.volume : getVolume(order)}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            

        </div>
    );
}
