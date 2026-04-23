'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Users,
    Plus,
    Pencil,
    UserCheck,
    UserX,
    X,
    Loader2,
    Phone,
    Search,
    Save,
    Percent,
    RefreshCw,
} from 'lucide-react';

interface Vendedor {
    id: string;
    nome: string;
    telefone: string | null;
    percentualComissao: number | string;
    ativo: boolean;
    createdAt: string;
    _count: {
        clientes: number;
    };
}

export default function VendedoresPage() {
    const [vendedores, setVendedores] = useState<Vendedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
    const [formNome, setFormNome] = useState('');
    const [formTelefone, setFormTelefone] = useState('');
    const [formComissao, setFormComissao] = useState('');
    const [saving, setSaving] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchVendedores = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vendedores', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setVendedores(data);
            }
        } catch (error) {
            console.error('Error fetching vendedores:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVendedores();
    }, [fetchVendedores]);

    const openCreateModal = () => {
        setEditingVendedor(null);
        setFormNome('');
        setFormTelefone('');
        setFormComissao('');
        setShowModal(true);
    };

    const openEditModal = (vendedor: Vendedor) => {
        setEditingVendedor(vendedor);
        setFormNome(vendedor.nome);
        setFormTelefone(vendedor.telefone || '');
        setFormComissao(String(Number(vendedor.percentualComissao) || ''));
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formNome.trim()) {
            showToast('Nome é obrigatório', 'error');
            return;
        }

        setSaving(true);
        try {
            const url = editingVendedor
                ? `/api/vendedores/${editingVendedor.id}`
                : '/api/vendedores';
            const method = editingVendedor ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: formNome.trim(),
                    telefone: formTelefone.trim() || null,
                    percentualComissao: parseFloat(formComissao) || 0,
                }),
            });

            if (res.ok) {
                showToast(
                    editingVendedor ? 'Vendedor atualizado!' : 'Vendedor cadastrado!',
                    'success'
                );
                setShowModal(false);
                fetchVendedores();
            } else {
                const err = await res.json();
                showToast(err.error || 'Erro ao salvar', 'error');
            }
        } catch {
            showToast('Erro ao salvar vendedor', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleAtivo = async (vendedor: Vendedor) => {
        try {
            const res = await fetch(`/api/vendedores/${vendedor.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: !vendedor.ativo }),
            });

            if (res.ok) {
                showToast(
                    vendedor.ativo ? 'Vendedor desativado' : 'Vendedor reativado!',
                    'success'
                );
                fetchVendedores();
            }
        } catch {
            showToast('Erro ao alterar status', 'error');
        }
    };

    // Filter + Search
    const filteredVendedores = vendedores.filter(v => {
        const matchSearch = v.nome.toLowerCase().includes(search.toLowerCase()) ||
            (v.telefone && v.telefone.includes(search));

        if (filtroAtivo === 'ativos') return matchSearch && v.ativo;
        if (filtroAtivo === 'inativos') return matchSearch && !v.ativo;
        return matchSearch;
    });

    // Backfill function
    const [backfilling, setBackfilling] = useState(false);
    const [backfillResult, setBackfillResult] = useState<string | null>(null);
    const runBackfill = async () => {
        setBackfilling(true);
        setBackfillResult(null);
        try {
            const res = await fetch('/api/vendedores/backfill', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const s = data.stats;
                showToast(
                    `✅ ${s.pedidosVinculadosAgora} pedidos vinculados | ${s.comissoesCalculadas} comissões calculadas`,
                    'success'
                );
                if (s.totalPedidosSemVendedor > 0) {
                    setBackfillResult(data.instrucao);
                }
            } else {
                showToast(data.error || 'Erro no backfill', 'error');
            }
        } catch {
            showToast('Erro ao executar recálculo', 'error');
        } finally {
            setBackfilling(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Vendedores</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Cadastre e gerencie os vendedores da equipe
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={runBackfill}
                        disabled={backfilling}
                        className="flex items-center gap-2 rounded-xl bg-amber-600/20 px-4 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-600/30 transition-all border border-amber-500/20 disabled:opacity-50"
                        title="Vincular vendedores aos pedidos antigos e recalcular comissões"
                    >
                        <RefreshCw className={`h-4 w-4 ${backfilling ? 'animate-spin' : ''}`} />
                        {backfilling ? 'Recalculando...' : 'Recalcular Comissões'}
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Vendedor
                    </button>
                </div>
            </div>

            {/* Backfill Result Banner */}
            {backfillResult && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-3.5 flex items-start gap-3">
                    <RefreshCw className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-amber-300 font-medium">Ação necessária</p>
                        <p className="text-xs text-amber-400/80 mt-1">{backfillResult}</p>
                    </div>
                    <button onClick={() => setBackfillResult(null)} className="text-amber-400/50 hover:text-amber-400 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                </div>
                <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                    {(['ativos', 'inativos', 'todos'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltroAtivo(f)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                                filtroAtivo === f
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/15">
                            <UserCheck className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {vendedores.filter(v => v.ativo).length}
                            </p>
                            <p className="text-xs text-gray-400">Vendedores Ativos</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-red-500/10 to-red-500/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/15">
                            <UserX className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {vendedores.filter(v => !v.ativo).length}
                            </p>
                            <p className="text-xs text-gray-400">Inativos</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/15">
                            <Users className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {vendedores.reduce((sum, v) => sum + v._count.clientes, 0)}
                            </p>
                            <p className="text-xs text-gray-400">Clientes Vinculados</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                        <span className="ml-3 text-sm text-gray-400">Carregando vendedores...</span>
                    </div>
                ) : filteredVendedores.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Users className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm">Nenhum vendedor encontrado</p>
                        <p className="text-xs text-gray-600 mt-1">
                            {search ? 'Tente outra busca' : 'Clique em "Novo Vendedor" para começar'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Vendedor
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Telefone
                                    </th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Comissão
                                    </th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Clientes
                                    </th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredVendedores.map(vendedor => (
                                    <tr
                                        key={vendedor.id}
                                        className={`hover:bg-white/[0.03] transition-colors ${!vendedor.ativo ? 'opacity-50' : ''}`}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    vendedor.ativo
                                                        ? 'bg-blue-500/15 text-blue-400'
                                                        : 'bg-gray-500/15 text-gray-400'
                                                }`}>
                                                    {vendedor.nome.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-white">
                                                    {vendedor.nome}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {vendedor.telefone ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Phone className="h-3.5 w-3.5 text-gray-500" />
                                                    {vendedor.telefone}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-xs font-semibold text-amber-400">
                                                <Percent className="h-3 w-3" />
                                                {Number(vendedor.percentualComissao).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-xs font-medium text-gray-300">
                                                <Users className="h-3 w-3" />
                                                {vendedor._count.clientes}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                vendedor.ativo
                                                    ? 'bg-emerald-500/15 text-emerald-400'
                                                    : 'bg-red-500/15 text-red-400'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${vendedor.ativo ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                {vendedor.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => openEditModal(vendedor)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleAtivo(vendedor)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        vendedor.ativo
                                                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                                                            : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                    title={vendedor.ativo ? 'Desativar' : 'Reativar'}
                                                >
                                                    {vendedor.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all animate-in slide-in-from-bottom-4 ${
                    toast.type === 'success'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Modal Create/Edit */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />

                    <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSave}>
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/15">
                                        <Users className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">
                                            {editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                            {editingVendedor ? 'Atualize os dados do vendedor' : 'Cadastre um novo membro da equipe'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Form Body */}
                            <div className="p-5 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-300">
                                        Nome do Vendedor *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formNome}
                                        onChange={(e) => setFormNome(e.target.value)}
                                        placeholder="Ex: João Silva"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-300">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        value={formTelefone}
                                        onChange={(e) => setFormTelefone(e.target.value)}
                                        placeholder="(00) 90000-0000"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-300">
                                        Comissão (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={formComissao}
                                            onChange={(e) => setFormComissao(e.target.value)}
                                            placeholder="Ex: 5.0"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                        />
                                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {editingVendedor ? 'Salvar Alterações' : 'Cadastrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
