/* eslint-disable */
'use client';

import { Search, Plus, Pencil, Trash2, Calendar, DollarSign, FileText, Package, Eye, Printer, Download, Filter, X, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import Link from "next/link";
import { useState, useMemo } from "react";

export default function PedidosPage() {
    const { orders, clients, removeOrder } = useData();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [tipoFilter, setTipoFilter] = useState<string>('todos');

    // State for Month Filter
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // Filter orders
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesSearch = order.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.includes(searchTerm);

            let matchesMonth = true;
            if (selectedMonth) {
                const orderDate = new Date(order.data).toISOString().slice(0, 7);
                matchesMonth = orderDate === selectedMonth;
            }

            let matchesTipo = true;
            if (tipoFilter === 'venda') matchesTipo = order.tipo !== 'Bonificacao';
            if (tipoFilter === 'bonificacao') matchesTipo = order.tipo === 'Bonificacao';

            return matchesSearch && matchesMonth && matchesTipo;
        });
    }, [orders, searchTerm, selectedMonth, tipoFilter]);

    // Selected order object
    const selectedOrder = useMemo(() => {
        return filteredOrders.find(o => o.id === selectedOrderId) || null;
    }, [filteredOrders, selectedOrderId]);

    // Stats
    const stats = {
        total: filteredOrders.length,
        vendas: filteredOrders.filter(o => o.tipo !== 'Bonificacao').length,
        bonificacoes: filteredOrders.filter(o => o.tipo === 'Bonificacao').length,
        valorTotal: filteredOrders.reduce((acc, o) => acc + (o.tipo === 'Bonificacao' ? 0 : Number(o.valorTotal)), 0)
    };

    const handleDelete = () => {
        if (deleteId) {
            removeOrder(deleteId);
            if (selectedOrderId === deleteId) setSelectedOrderId(null);
            setDeleteId(null);
        }
    };

    const monthName = selectedMonth ? new Date(selectedMonth + '-02').toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) : 'Todo o Histórico';

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500 h-full">

            {/* ═══════════ HEADER + META ═══════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
                        <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Pedidos de Venda</h1>
                        <p className="text-xs text-gray-500 capitalize">{monthName}</p>
                    </div>
                </div>

                {/* KPIs Inline */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs text-gray-400">Pedidos</span>
                        <span className="text-sm font-bold text-white">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs text-gray-400">Faturamento</span>
                        <span className="text-sm font-bold text-emerald-400">R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {stats.bonificacoes > 0 && (
                        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                            <Package className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs text-gray-400">Bonificações</span>
                            <span className="text-sm font-bold text-amber-400">{stats.bonificacoes}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════ FILTER BAR ═══════════ */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06] backdrop-blur-sm">
                {/* Search */}
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

                {/* Month */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none text-white text-xs focus:ring-0 focus:outline-none py-0.5 [color-scheme:dark] w-[120px]"
                    />
                    {selectedMonth && (
                        <button onClick={() => setSelectedMonth('')} className="text-gray-500 hover:text-red-400 transition-colors">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Type Filter */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'venda', label: 'Vendas' },
                        { key: 'bonificacao', label: 'Bonif.' }
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setTipoFilter(opt.key)}
                            className={`px-3 py-1.5 text-xs font-medium transition-all ${tipoFilter === opt.key
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Novo Pedido */}
                <Link href="/dashboard/pedidos/novo">
                    <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Novo Pedido</span>
                        <span className="sm:hidden">Novo</span>
                    </button>
                </Link>
            </div>

            {/* ═══════════ MASTER TABLE — Pedidos de Venda ═══════════ */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
                {/* Table Header Label */}
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Pedidos de Venda</span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{filteredOrders.length} registros</span>
                    </div>
                </div>

                {/* Scrollable Table */}
                <div className="overflow-auto flex-1" style={{ maxHeight: selectedOrder ? '280px' : '500px' }}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Data</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Tipo</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Cliente</th>

                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Valor Total</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Itens</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-600">
                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum pedido encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order, index) => {
                                    const isSelected = selectedOrderId === order.id;
                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                                            className={`
                                                border-b border-white/[0.03] cursor-pointer transition-all duration-150
                                                ${isSelected
                                                    ? 'bg-blue-500/10 border-l-2 border-l-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]'
                                                    : index % 2 === 0
                                                        ? 'bg-transparent hover:bg-white/[0.03]'
                                                        : 'bg-white/[0.015] hover:bg-white/[0.04]'
                                                }
                                            `}
                                        >
                                            {/* Data */}
                                            <td className="px-3 py-2.5">
                                                <span className={`text-xs font-mono ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>
                                                    {new Date(order.data).toLocaleDateString('pt-BR')}
                                                </span>
                                            </td>

                                            {/* Tipo */}
                                            <td className="px-3 py-2.5 hidden md:table-cell">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${order.tipo === 'Bonificacao'
                                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    }`}>
                                                    {order.tipo === 'Bonificacao' ? 'BONIF' : 'VENDA'}
                                                </span>
                                            </td>

                                            {/* Cliente */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-medium truncate max-w-[200px] ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                                        {order.nomeCliente}
                                                    </span>
                                                    {/* Mobile: show type + date inline */}
                                                    <div className="flex items-center gap-2 md:hidden mt-0.5">
                                                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${order.tipo === 'Bonificacao' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                                                            }`}>
                                                            {order.tipo === 'Bonificacao' ? 'BONIF' : 'VENDA'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>



                                            {/* Valor Total */}
                                            <td className="px-3 py-2.5 text-right">
                                                <span className={`text-sm font-bold tabular-nums ${order.tipo === 'Bonificacao' ? 'text-amber-400' : 'text-emerald-400'
                                                    }`}>
                                                    {order.tipo === 'Bonificacao' ? '' : 'R$ '}{Number(order.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>

                                            {/* Itens */}
                                            <td className="px-3 py-2.5 text-center hidden md:table-cell">
                                                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{order.itens.length}</span>
                                            </td>

                                            {/* Ações */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <Link href={`/dashboard/pedidos/${order.id}`} onClick={(e) => e.stopPropagation()}>
                                                        <button className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Editar">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteId(order.id); }}
                                                        className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════ DETAIL PANEL — Itens do Pedido ═══════════ */}
            {selectedOrder && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                    {/* Detail Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-cyan-500"></div>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Itens do Pedido</span>
                            <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{selectedOrder.itens.length} itens</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Cliente:</span>
                                <span className="text-white font-medium">{selectedOrder.nomeCliente}</span>
                            </div>
                            <div className="hidden md:flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Data:</span>
                                <span className="text-gray-300">{new Date(selectedOrder.data).toLocaleDateString('pt-BR')}</span>
                            </div>

                            {selectedOrder.observacoes && (
                                <div className="hidden lg:flex items-center gap-2 text-xs">
                                    <span className="text-gray-500">Obs:</span>
                                    <span className="text-gray-400 truncate max-w-[150px]">{selectedOrder.observacoes}</span>
                                </div>
                            )}
                            <button
                                onClick={() => setSelectedOrderId(null)}
                                className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-auto" style={{ maxHeight: '220px' }}>
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">#</th>
                                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Produto</th>
                                    <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Qtd</th>
                                    <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Preço Unit.</th>
                                    <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedOrder.itens.map((item, idx) => (
                                    <tr key={idx} className={`border-b border-white/[0.03] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}>
                                        <td className="px-3 py-2">
                                            <span className="text-[10px] text-gray-600 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-sm text-gray-200">{item.nomeProduto}</span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className="text-sm text-cyan-400 font-semibold">{item.quantidade}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <span className="text-xs text-gray-400 font-mono">{Number(item.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <span className="text-sm text-emerald-400 font-bold font-mono">{Number(item.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                    </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="bg-white/[0.03] border-t border-white/[0.08]">
                                    <td colSpan={3} className="px-3 py-2.5">
                                        <span className="text-xs text-gray-500 uppercase font-semibold">Total do Pedido</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs text-gray-500">{selectedOrder.itens.reduce((acc, i) => acc + i.quantidade, 0)} un.</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-base text-emerald-400 font-bold">R$ {Number(selectedOrder.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════ ACTION BAR ═══════════ */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06]">
                <Link href="/dashboard/pedidos/novo">
                    <button className="flex items-center gap-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition-all">
                        <Plus className="h-3.5 w-3.5" />
                        Incluir Pedido
                    </button>
                </Link>

                {selectedOrder && (
                    <>
                        <Link href={`/dashboard/pedidos/${selectedOrder.id}`}>
                            <button className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition-all">
                                <Eye className="h-3.5 w-3.5" />
                                Visualizar Pedido
                            </button>
                        </Link>
                        <Link href={`/dashboard/pedidos/${selectedOrder.id}`}>
                            <button className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition-all">
                                <Pencil className="h-3.5 w-3.5" />
                                Editar Pedido
                            </button>
                        </Link>
                        <button
                            onClick={() => setDeleteId(selectedOrder.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 px-3 py-2 text-xs font-medium text-gray-300 hover:text-red-400 transition-all"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                        </button>
                    </>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Info */}
                <div className="text-[10px] text-gray-600 hidden md:block">
                    {selectedOrder ? (
                        <span className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            Pedido selecionado: <span className="text-blue-400 font-medium">{selectedOrder.nomeCliente}</span>
                        </span>
                    ) : (
                        <span>Selecione um pedido na tabela para ver detalhes</span>
                    )}
                </div>
            </div>

            {/* ═══════════ DELETE MODAL ═══════════ */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111827] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <Trash2 className="h-5 w-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Excluir Pedido</h3>
                        </div>
                        <p className="text-sm text-gray-400">Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all shadow-lg shadow-red-600/20">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
