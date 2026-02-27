/* eslint-disable */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Wallet, DollarSign, X, Eye, Trash2, Filter } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface VerbaItem {
    id: string;
    clienteId: string;
    clienteNome: string;
    titulo: string;
    valorTotal: number;
    consumido: number;
    saldo: number;
    status: string;
    createdAt: string;
    totalPedidos: number;
}

interface ClienteOption {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
}

export default function VerbaListPage() {
    const [verbas, setVerbas] = useState<VerbaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todas');
    const [showModal, setShowModal] = useState(false);
    const [clientes, setClientes] = useState<ClienteOption[]>([]);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form state
    const [formClienteId, setFormClienteId] = useState('');
    const [formTitulo, setFormTitulo] = useState('');
    const [formValor, setFormValor] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchVerbas = async () => {
        try {
            const res = await fetch('/api/verbas');
            const data = await res.json();
            setVerbas(data.verbas || []);
        } catch (e) {
            console.error('Error fetching verbas:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchClientes = async () => {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            setClientes(data || []);
        } catch (e) {
            console.error('Error fetching clients:', e);
        }
    };

    useEffect(() => {
        fetchVerbas();
        fetchClientes();
    }, []);

    const filteredVerbas = useMemo(() => {
        return verbas.filter(v => {
            const matchesSearch = v.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.titulo.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesStatus = true;
            if (statusFilter === 'ativa') matchesStatus = v.status === 'ATIVA';
            if (statusFilter === 'esgotada') matchesStatus = v.status === 'ESGOTADA';
            if (statusFilter === 'cancelada') matchesStatus = v.status === 'CANCELADA';
            return matchesSearch && matchesStatus;
        });
    }, [verbas, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total: verbas.length,
        valorLiberado: verbas.reduce((acc, v) => acc + v.valorTotal, 0),
        valorConsumido: verbas.reduce((acc, v) => acc + v.consumido, 0)
    }), [verbas]);

    const handleCreate = async () => {
        if (!formClienteId || !formTitulo || !formValor) return;
        setSaving(true);
        try {
            const res = await fetch('/api/verbas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clienteId: formClienteId,
                    titulo: formTitulo,
                    valorTotal: parseFloat(formValor)
                })
            });
            if (res.ok) {
                setShowModal(false);
                setFormClienteId('');
                setFormTitulo('');
                setFormValor('');
                fetchVerbas();
            }
        } catch (e) {
            console.error('Error creating verba:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await fetch(`/api/verbas/${deleteId}`, { method: 'DELETE' });
            setDeleteId(null);
            fetchVerbas();
        } catch (e) {
            console.error('Error deleting verba:', e);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ATIVA':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'ESGOTADA':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'CANCELADA':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500 h-full">

            {/* ═══════════ HEADER + META ═══════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
                        <Wallet className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Controle de Verbas</h1>
                        <p className="text-xs text-gray-500">Gestão de verbas de bonificação</p>
                    </div>
                </div>

                {/* KPIs Inline */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <Wallet className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-xs text-gray-400">Verbas</span>
                        <span className="text-sm font-bold text-white">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs text-gray-400">Liberado</span>
                        <span className="text-sm font-bold text-emerald-400">R$ {stats.valorLiberado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs text-gray-400">Consumido</span>
                        <span className="text-sm font-bold text-amber-400">R$ {stats.valorConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            {/* ═══════════ FILTER BAR ═══════════ */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06] backdrop-blur-sm">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente ou título..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    {[
                        { key: 'todas', label: 'Todas' },
                        { key: 'ativa', label: 'Ativas' },
                        { key: 'esgotada', label: 'Esgotadas' },
                        { key: 'cancelada', label: 'Canceladas' }
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setStatusFilter(opt.key)}
                            className={`px-3 py-1.5 text-xs font-medium transition-all ${statusFilter === opt.key
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Nova Verba */}
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Nova Verba</span>
                    <span className="sm:hidden">Novo</span>
                </button>
            </div>

            {/* ═══════════ TABLE ═══════════ */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
                {/* Table Header Label */}
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-purple-500"></div>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Verbas Cadastradas</span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{filteredVerbas.length} registros</span>
                    </div>
                </div>

                {/* Scrollable Table */}
                <div className="overflow-auto flex-1" style={{ maxHeight: '500px' }}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Cliente</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Título</th>
                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Valor Total</th>
                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Consumido</th>
                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Saldo</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Status</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-600">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="h-4 w-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredVerbas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-600">
                                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhuma verba encontrada</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredVerbas.map((verba, index) => (
                                    <tr
                                        key={verba.id}
                                        className={`border-b border-white/[0.03] cursor-pointer transition-all duration-150 ${index % 2 === 0 ? 'bg-transparent hover:bg-white/[0.03]' : 'bg-white/[0.015] hover:bg-white/[0.04]'}`}
                                    >
                                        {/* Cliente */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-200 truncate max-w-[200px]">{verba.clienteNome}</span>
                                                <span className="text-[10px] text-gray-600 md:hidden">{verba.titulo}</span>
                                            </div>
                                        </td>

                                        {/* Título */}
                                        <td className="px-3 py-2.5 hidden md:table-cell">
                                            <span className="text-sm text-gray-300">{verba.titulo}</span>
                                        </td>

                                        {/* Valor Total */}
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-sm font-bold tabular-nums text-white">
                                                R$ {verba.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Consumido */}
                                        <td className="px-3 py-2.5 text-right hidden md:table-cell">
                                            <span className="text-sm font-bold tabular-nums text-amber-400">
                                                R$ {verba.consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Saldo */}
                                        <td className="px-3 py-2.5 text-right">
                                            <span className={`text-sm font-bold tabular-nums ${verba.saldo > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                R$ {verba.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(verba.status)}`}>
                                                {verba.status}
                                            </span>
                                        </td>

                                        {/* Ações */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <Link href={`/dashboard/verbas/${verba.id}`}>
                                                    <button className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Ver Detalhes">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                </Link>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteId(verba.id); }}
                                                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════ MODAL — Nova Verba ═══════════ */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="rounded-full bg-purple-500/10 p-3 text-purple-500">
                                    <Wallet className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Nova Verba</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Cliente</label>
                                    <select
                                        value={formClienteId}
                                        onChange={(e) => setFormClienteId(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione um cliente...</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Título da Verba</label>
                                    <input
                                        type="text"
                                        value={formTitulo}
                                        onChange={(e) => setFormTitulo(e.target.value)}
                                        placeholder="Ex: Verba Q1 2026"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor Total (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={saving || !formClienteId || !formTitulo || !formValor}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                >
                                    {saving ? 'Salvando...' : 'Criar Verba'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════════ DELETE MODAL ═══════════ */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111827] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <Trash2 className="h-5 w-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Excluir Verba</h3>
                        </div>
                        <p className="text-sm text-gray-400">Tem certeza que deseja excluir esta verba? Os pedidos vinculados serão desvinculados automaticamente.</p>
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
