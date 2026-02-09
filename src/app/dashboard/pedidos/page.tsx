/* eslint-disable */
'use client';

import { Search, Plus, Pencil, Trash2, Calendar, DollarSign, FileText, ShoppingCart, ChevronDown, ChevronUp, Package } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

export default function PedidosPage() {
    const { orders, removeOrder } = useData();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    const filteredOrders = orders.filter(order =>
        order.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.includes(searchTerm)
    );

    const stats = {
        total: orders.length,
        valorTotal: orders.reduce((acc, o) => acc + o.valorTotal, 0)
    };

    const handleDelete = () => {
        if (deleteId) {
            removeOrder(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Pedidos de Venda</h1>
                    <p className="text-sm text-gray-400">{orders.length} pedidos no sistema</p>
                </div>
                <Link href="/dashboard/pedidos/novo">
                    <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                        <Plus className="h-4 w-4" />
                        Novo Pedido
                    </button>
                </Link>
            </div>

            {/* KPIs Simples */}
            <div className="grid grid-cols-2 gap-3">
                <div className="form-card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Total de Pedidos</p>
                        <p className="text-lg font-bold text-white">{stats.total}</p>
                    </div>
                </div>
                <div className="form-card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                        <DollarSign className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Faturamento Total</p>
                        <p className="text-lg font-bold text-white">R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar pedido ou cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-compact pl-10 w-full"
                />
            </div>

            {/* Lista de Pedidos */}
            <div className="space-y-2">
                {filteredOrders.length === 0 ? (
                    <div className="form-card text-center py-8 text-gray-500">
                        Nenhum pedido encontrado.
                    </div>
                ) : (
                    filteredOrders.map((order, index) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="form-card flex flex-col gap-0 p-0 overflow-hidden"
                        >
                            {/* Card Header (Clickable) */}
                            <div
                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                className="py-2 px-3 flex flex-col md:flex-row md:items-center justify-between hover:bg-white/5 transition-colors group gap-1 md:gap-0 cursor-pointer"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full">
                                    <div className="flex items-center gap-2">
                                        {/* Ícone */}
                                        <div className="p-1 rounded bg-blue-500/10 shrink-0">
                                            {expandedOrderId === order.id ? (
                                                <ChevronUp className="h-3 w-3 text-blue-400" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3 text-blue-400" />
                                            )}
                                        </div>

                                        {/* Número do Pedido */}
                                        <div className="md:w-24">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider hidden md:block">Pedido</p>
                                            <p className="font-mono text-xs md:text-sm font-bold text-white leading-none">
                                                {new Date(order.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '')}
                                                -{new Date(order.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Cliente */}
                                    <div className="md:w-48 pl-6 md:pl-0">
                                        <p className="text-sm font-medium text-white truncate leading-tight">{order.nomeCliente}</p>
                                    </div>

                                    {/* Data e Itens */}
                                    <div className="flex items-center gap-4 pl-6 md:pl-0">
                                        <div className="md:w-24">
                                            <p className="text-xs text-gray-400 flex items-center gap-1 leading-none">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(order.data).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>

                                        <div className="md:w-16">
                                            <p className="text-xs text-gray-400 leading-none">
                                                {order.itens.length} itens
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full md:w-auto gap-4 pl-6 md:pl-0 pt-1 md:pt-0">
                                    {/* Valor */}
                                    <div className="text-left md:text-right md:w-28">
                                        <p className="text-sm font-bold text-green-400 leading-none">R$ {order.valorTotal.toFixed(2)}</p>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1">
                                        <Link href={`/dashboard/pedidos/${order.id}`} onClick={(e) => e.stopPropagation()}>
                                            <button className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                        </Link>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteId(order.id);
                                            }}
                                            className="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedOrderId === order.id && (
                                <div className="bg-black/20 border-t border-white/5 p-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="bg-gray-900/50 rounded-lg p-4 border border-white/5">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                                            <Package className="h-4 w-4 text-blue-400" />
                                            Itens do Pedido
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="border-b border-white/10 text-gray-500 text-xs uppercase">
                                                        <th className="py-2 px-2">Produto</th>
                                                        <th className="py-2 px-2 text-center">Qtd</th>
                                                        <th className="py-2 px-2 text-right">Unitário</th>
                                                        <th className="py-2 px-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {order.itens.map((item, idx) => (
                                                        <tr key={idx} className="text-gray-300">
                                                            <td className="py-2 px-2">{item.nomeProduto}</td>
                                                            <td className="py-2 px-2 text-center">{item.quantidade}</td>
                                                            <td className="py-2 px-2 text-right">R$ {item.precoUnitario.toFixed(2)}</td>
                                                            <td className="py-2 px-2 text-right font-medium text-green-400">R$ {item.total.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modal de Confirmação */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="form-card p-6 max-w-sm w-full mx-4 space-y-4">
                        <h3 className="text-lg font-semibold text-white">Excluir Pedido</h3>
                        <p className="text-sm text-gray-400">Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
