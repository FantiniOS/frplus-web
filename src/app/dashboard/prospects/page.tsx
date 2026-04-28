'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, UserPlus, Trash2, Pencil, Calendar, MessageCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getProspects, createProspect, updateProspect, deleteProspect } from '@/app/actions/prospects';

interface ProspectItem {
    id: string;
    nomeEmpresa: string;
    nomeContato: string;
    telefone: string;
    observacoes?: string | null;
    dataUltimoContato?: Date | string | null;
    dataProximoContato?: Date | string | null;
    status: string;
}

export default function ProspectsListPage() {
    const { isAdmin, isIndustria } = useAuth();
    const [prospects, setProspects] = useState<ProspectItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ativos');
    const [showModal, setShowModal] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form state (Shared for Create and Edit)
    const [editMode, setEditMode] = useState(false);
    const [formId, setFormId] = useState('');
    const [formEmpresa, setFormEmpresa] = useState('');
    const [formContato, setFormContato] = useState('');
    const [formTelefone, setFormTelefone] = useState('');
    const [formObservacoes, setFormObservacoes] = useState('');
    const [formDataUltimo, setFormDataUltimo] = useState('');
    const [formProximo, setFormProximo] = useState('');
    const [formStatus, setFormStatus] = useState('ATIVO');
    const [saving, setSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const data = await getProspects();
            setProspects(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const filteredProspects = useMemo(() => {
        return prospects.filter(p => {
            const matchesSearch = p.nomeEmpresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  p.nomeContato.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesStatus = true;
            if (statusFilter === 'ativos') matchesStatus = p.status === 'ATIVO';
            if (statusFilter === 'inativos') matchesStatus = p.status !== 'ATIVO';
            return matchesSearch && matchesStatus;
        });
    }, [prospects, searchTerm, statusFilter]);

    const openCreate = () => {
        setEditMode(false);
        setFormId('');
        setFormEmpresa('');
        setFormContato('');
        setFormTelefone('');
        setFormObservacoes('');
        setFormDataUltimo('');
        setFormProximo('');
        setFormStatus('ATIVO');
        setShowModal(true);
    };

    const openEdit = (prospect: ProspectItem) => {
        setEditMode(true);
        setFormId(prospect.id);
        setFormEmpresa(prospect.nomeEmpresa);
        setFormContato(prospect.nomeContato);
        setFormTelefone(prospect.telefone);
        setFormObservacoes(prospect.observacoes || '');
        
        // Formata as datas para YYYY-MM-DD para o input type="date"
        if (prospect.dataUltimoContato) {
            setFormDataUltimo(new Date(prospect.dataUltimoContato).toISOString().split('T')[0]);
        } else setFormDataUltimo('');
        
        if (prospect.dataProximoContato) {
            setFormProximo(new Date(prospect.dataProximoContato).toISOString().split('T')[0]);
        } else setFormProximo('');

        setFormStatus(prospect.status);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formEmpresa || !formContato || !formTelefone) return;
        setSaving(true);
        try {
            const payload = {
                nomeEmpresa: formEmpresa,
                nomeContato: formContato,
                telefone: formTelefone,
                observacoes: formObservacoes,
                dataUltimoContato: formDataUltimo ? new Date(`${formDataUltimo}T12:00:00`) : null,
                dataProximoContato: formProximo ? new Date(`${formProximo}T12:00:00`) : null,
                status: formStatus
            };

            if (editMode) {
                await updateProspect(formId, payload);
            } else {
                await createProspect(payload);
            }
            setShowModal(false);
            fetchAll();
        } catch (e) {
            console.error('Error saving prospect:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteProspect(deleteId);
            setDeleteId(null);
            fetchAll();
        } catch (e) {
            console.error('Error deleting prospect:', e);
        }
    };

    const getStatusBadge = (status: string) => {
        return status === 'ATIVO' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500 h-full">

            {/* ═══════════ HEADER ═══════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
                        <UserPlus className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Futuros Clientes</h1>
                        <p className="text-xs text-gray-500">Gestão de prospecção e lembretes de retorno</p>
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
                        placeholder="Buscar empresa ou contato..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'ativos', label: 'Ativos' },
                        { key: 'inativos', label: 'Inativos' }
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

                {/* Novo Prospect */}
                {!isIndustria && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Novo Prospect</span>
                    </button>
                )}
            </div>

            {/* ═══════════ MASTER TABLE ═══════════ */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Últimos Cadastros</span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{filteredProspects.length} registros</span>
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Empresa / Contato</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Último Contato</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Próx. Retorno</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Status</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-600">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="h-4 w-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProspects.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-600">
                                        <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum prospect encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProspects.map((prospect, index) => {
                                    const isAtrasado = prospect.dataProximoContato && new Date(prospect.dataProximoContato) < new Date(new Date().setHours(0,0,0,0));

                                    return (
                                        <tr
                                            key={prospect.id}
                                            className={`
                                                border-b border-white/[0.03] transition-all duration-150
                                                ${index % 2 === 0 ? 'bg-transparent hover:bg-white/[0.03]' : 'bg-white/[0.015] hover:bg-white/[0.04]'}
                                            `}
                                        >
                                            {/* Empresa / Contato */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium text-white truncate max-w-[200px]">{prospect.nomeEmpresa}</span>
                                                        <span className="text-[10px] text-gray-500 truncate">{prospect.nomeContato} • {prospect.telefone}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Último Contato */}
                                            <td className="px-3 py-2.5 hidden md:table-cell">
                                                {prospect.dataUltimoContato ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(prospect.dataUltimoContato).toLocaleDateString('pt-BR')}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-600">-</span>
                                                )}
                                            </td>

                                            {/* Próximo Retorno */}
                                            <td className="px-3 py-2.5">
                                                {prospect.dataProximoContato ? (
                                                    <div className="flex flex-col">
                                                         <div className={`flex items-center gap-1.5 text-xs font-semibold ${isAtrasado ? 'text-red-400' : 'text-blue-400'}`}>
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(prospect.dataProximoContato).toLocaleDateString('pt-BR')}
                                                        </div>
                                                        {isAtrasado && <span className="text-[9px] text-red-500">Atrasado</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-600">Não agendado</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-3 py-2.5 text-center hidden md:table-cell">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(prospect.status)}`}>
                                                    {prospect.status}
                                                </span>
                                            </td>

                                            {/* Ações */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <a
                                                        href={`https://wa.me/55${prospect.telefone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-all"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </a>
                                                    {!isIndustria && (
                                                        <>
                                                            <button
                                                                onClick={() => openEdit(prospect)}
                                                                className="p-1.5 rounded-md text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteId(prospect.id)}
                                                                className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </>
                                                    )}
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

            {/* ═══════════ MODAL — Criar/Editar ═══════════ */}
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
                            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl"
                        >
                            {/* Sticky Header */}
                            <div className="sticky top-0 bg-[#111] z-10 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-blue-500/10 p-2.5 text-blue-500">
                                        <UserPlus className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">
                                        {editMode ? 'Editar Prospect' : 'Novo Prospect'}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => setShowModal(false)}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome da Empresa</label>
                                        <input
                                            type="text"
                                            value={formEmpresa}
                                            onChange={(e) => setFormEmpresa(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                                            placeholder="Ex: Supermercado XYZ"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Contato</label>
                                            <input
                                                type="text"
                                                value={formContato}
                                                onChange={(e) => setFormContato(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                                                placeholder="Nome do comprador"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Telefone/WhatsApp</label>
                                            <input
                                                type="text"
                                                value={formTelefone}
                                                onChange={(e) => setFormTelefone(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Data Último Contato</label>
                                            <input
                                                type="date"
                                                value={formDataUltimo}
                                                onChange={(e) => setFormDataUltimo(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-blue-400 mb-1.5">Agendar Próx. Retorno</label>
                                            <input
                                                type="date"
                                                value={formProximo}
                                                onChange={(e) => setFormProximo(e.target.value)}
                                                className="w-full bg-black/40 border border-blue-500/30 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-blue-50"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Observações</label>
                                        <textarea
                                            value={formObservacoes}
                                            onChange={(e) => setFormObservacoes(e.target.value)}
                                            rows={3}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
                                            placeholder="Anotações sobre a negociação..."
                                        />
                                    </div>

                                    {editMode && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
                                            <select
                                                value={formStatus}
                                                onChange={(e) => setFormStatus(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="ATIVO">Ativo</option>
                                                <option value="INATIVO">Inativo</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/[0.04]">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !formEmpresa || !formContato || !formTelefone}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Gravando...' : editMode ? 'Salvar Edição' : 'Cadastrar Prospect'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════════ DELETE MODAL ═══════════ */}
            <AnimatePresence>
                {deleteId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setDeleteId(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-[#111827] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-auto shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-red-500/10">
                                    <Trash2 className="h-5 w-5 text-red-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Excluir Prospect</h3>
                            </div>
                            <p className="text-sm text-gray-400">
                                Tem certeza que deseja apagar os dados desta prospecção permanentemente?
                            </p>
                            <div className="flex gap-3 justify-end mt-6">
                                <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all shadow-lg shadow-red-600/20">
                                    Confirmar Exclusão
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
