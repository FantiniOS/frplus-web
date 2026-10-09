/* eslint-disable */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Tags, X, Store, Loader2, Building2, UserCircle2, CalendarDays, TrendingDown, BadgeDollarSign, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MarcaConcorrente {
    id: string;
    nome: string;
    createdAt: string;
    _count?: { centralPrecos: number };
}

interface RegistroPreco {
    id: string;
    dataColeta: string;
    produtoBase: string;
    precoPrateleira: number;
    clienteId: string | null;
    vendedorId: string | null;
    cliente: { id: string; nomeFantasia: string; razaoSocial: string; cidade: string } | null;
    vendedor: { id: string; nome: string } | null;
    marcaConcorrente: { id: string; nome: string };
}

interface ClienteOption {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const inputClass = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function CentralPrecosAdminPage() {
    const [registros, setRegistros] = useState<RegistroPreco[]>([]);
    const [marcas, setMarcas] = useState<MarcaConcorrente[]>([]);
    const [clientes, setClientes] = useState<ClienteOption[]>([]);
    const [produtosSistema, setProdutosSistema] = useState<{id: string; nome: string}[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [marcaFilter, setMarcaFilter] = useState('');
    const [coletorFilter, setColetorFilter] = useState('');

    // Modal: Registrar PreÃ§o
    const [showRegistrar, setShowRegistrar] = useState(false);
    const [editRegistroId, setEditRegistroId] = useState<string | null>(null);
    const [formClienteId, setFormClienteId] = useState('');
    const [formProdutoNome, setFormProdutoNome] = useState('');
    const [formMarcaId, setFormMarcaId] = useState('');
    const [formPreco, setFormPreco] = useState('');
    const [savingPreco, setSavingPreco] = useState(false);
    const [erroPreco, setErroPreco] = useState('');

    // Modal: Gerenciar Marcas
    const [showMarcas, setShowMarcas] = useState(false);
    const [novaMarca, setNovaMarca] = useState('');
    const [savingMarca, setSavingMarca] = useState(false);
    const [erroMarca, setErroMarca] = useState('');

    const fetchRegistros = async () => {
        try {
            const res = await fetch('/api/central-precos');
            const data = await res.json();
            setRegistros(data.registros || []);
        } catch (e) {
            console.error('Erro ao buscar central de preÃ§os:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchMarcas = async () => {
        try {
            const res = await fetch('/api/marcas-concorrentes');
            const data = await res.json();
            setMarcas(data.marcas || []);
        } catch (e) {
            console.error('Erro ao buscar marcas:', e);
        }
    };

    const fetchClientes = async () => {
        try {
            // Reutiliza a rota existente de captaÃ§Ã£o (Admin recebe todos os clientes ativos)
            const res = await fetch('/api/captacao');
            const data = await res.json();
            setClientes(data.clientes || []);
        } catch (e) {
            console.error('Erro ao buscar clientes:', e);
        }
    };

    const fetchProdutos = async () => {
        try {
            const res = await fetch('/api/products?ativo=true');
            const data = await res.json();
            setProdutosSistema(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Erro ao buscar produtos:', e);
        }
    };

    useEffect(() => {
        fetchRegistros();
        fetchMarcas();
        fetchClientes();
        fetchProdutos();
    }, []);

    // Lista de coletores presentes no histÃ³rico (para o filtro)
    const coletores = useMemo(() => {
        const map = new Map<string, string>();
        registros.forEach(r => {
            if (r.vendedor) map.set(r.vendedor.id, r.vendedor.nome);
        });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [registros]);

    const filteredRegistros = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        return registros.filter(r => {
            const clienteNome = (r.cliente?.nomeFantasia || r.cliente?.razaoSocial || '').toLowerCase();
            const matchesSearch = !term ||
                r.produtoBase.toLowerCase().includes(term) ||
                clienteNome.includes(term) ||
                r.marcaConcorrente.nome.toLowerCase().includes(term);
            const matchesMarca = !marcaFilter || r.marcaConcorrente.id === marcaFilter;
            const matchesColetor = !coletorFilter ||
                (coletorFilter === 'admin' ? !r.vendedorId : r.vendedorId === coletorFilter);
            return matchesSearch && matchesMarca && matchesColetor;
        });
    }, [registros, searchTerm, marcaFilter, coletorFilter]);

    const stats = useMemo(() => {
        const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const ultimos7 = registros.filter(r => new Date(r.dataColeta).getTime() >= seteDiasAtras).length;
        const menorPreco = filteredRegistros.length
            ? Math.min(...filteredRegistros.map(r => r.precoPrateleira))
            : 0;
        return { total: registros.length, ultimos7, menorPreco };
    }, [registros, filteredRegistros]);

    const resetFormPreco = () => {
        setEditRegistroId(null);
        setFormClienteId('');
        setFormProdutoNome('');
        setFormMarcaId('');
        setFormPreco('');
        setErroPreco('');
    };

    const handleEditClick = (registro: RegistroPreco) => {
        setEditRegistroId(registro.id);
        setFormClienteId(registro.clienteId || '');
        setFormProdutoNome(registro.produtoBase);
        setFormMarcaId(registro.marcaConcorrente?.id || '');
        setFormPreco(registro.precoPrateleira.toString().replace('.', ','));
        setErroPreco('');
        setShowRegistrar(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!confirm('Deseja realmente excluir este registro?')) return;
        try {
            const res = await fetch(`/api/central-precos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao excluir');
            fetchRegistros();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir registro');
        }
    };

    const handleRegistrarPreco = async () => {
        if (!formProdutoNome || !formMarcaId || !formPreco) return;
        setSavingPreco(true);
        setErroPreco('');
        try {
            const url = editRegistroId ? `/api/central-precos/${editRegistroId}` : '/api/central-precos';
            const method = editRegistroId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clienteId: formClienteId || null,
                    produtoBase: formProdutoNome,
                    marcaConcorrenteId: formMarcaId,
                    precoPrateleira: formPreco
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setErroPreco(data.error || 'Erro ao registrar preÃ§o.');
                return;
            }
            setShowRegistrar(false);
            resetFormPreco();
            fetchRegistros();
            fetchMarcas();
        } catch (e) {
            setErroPreco('Erro de conexÃ£o ao registrar preÃ§o.');
        } finally {
            setSavingPreco(false);
        }
    };

    const handleCriarMarca = async () => {
        if (!novaMarca.trim()) return;
        setSavingMarca(true);
        setErroMarca('');
        try {
            const res = await fetch('/api/marcas-concorrentes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: novaMarca })
            });
            const data = await res.json();
            if (!res.ok) {
                setErroMarca(data.error || 'Erro ao cadastrar marca.');
                return;
            }
            setNovaMarca('');
            fetchMarcas();
        } catch (e) {
            setErroMarca('Erro de conexÃ£o ao cadastrar marca.');
        } finally {
            setSavingMarca(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500 h-full">

            {/* â•â•â•â•â•â•â•â•â•â•â• HEADER â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20">
                        <Tags className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Central de PreÃ§os</h1>
                        <p className="text-xs text-gray-500">Monitoramento de preÃ§os de prateleira da concorrÃªncia</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setErroMarca(''); setShowMarcas(true); }}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Gerenciar Marcas
                    </button>
                    <button
                        onClick={() => { resetFormPreco(); setShowRegistrar(true); }}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Registrar PreÃ§o Coletado</span>
                        <span className="sm:hidden">Registrar</span>
                    </button>
                </div>
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â• KPIs â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06]">
                    <div className="p-2 rounded-lg bg-blue-500/10"><BadgeDollarSign className="h-4 w-4 text-blue-400" /></div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total de Coletas</p>
                        <p className="text-lg font-bold text-white tabular-nums">{stats.total}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06]">
                    <div className="p-2 rounded-lg bg-emerald-500/10"><CalendarDays className="h-4 w-4 text-emerald-400" /></div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Ãšltimos 7 dias</p>
                        <p className="text-lg font-bold text-white tabular-nums">{stats.ultimos7}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06]">
                    <div className="p-2 rounded-lg bg-amber-500/10"><TrendingDown className="h-4 w-4 text-amber-400" /></div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Menor PreÃ§o (filtro atual)</p>
                        <p className="text-lg font-bold text-white tabular-nums">{stats.menorPreco ? formatBRL(stats.menorPreco) : '-'}</p>
                    </div>
                </div>
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â• FILTER BAR â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0a0f1a]/80 border border-white/[0.06] backdrop-blur-sm">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar por produto, cliente ou concorrente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                <select
                    value={marcaFilter}
                    onChange={(e) => setMarcaFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
                >
                    <option value="" className="bg-[#111]">Todas as marcas</option>
                    {marcas.map(m => (
                        <option key={m.id} value={m.id} className="bg-[#111]">{m.nome}</option>
                    ))}
                </select>
                <select
                    value={coletorFilter}
                    onChange={(e) => setColetorFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
                >
                    <option value="" className="bg-[#111]">Todos os coletores</option>
                    <option value="admin" className="bg-[#111]">VocÃª (Administrador)</option>
                    {coletores.map(([id, nome]) => (
                        <option key={id} value={id} className="bg-[#111]">{nome}</option>
                    ))}
                </select>
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â• MASTER TABLE â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/60 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">HistÃ³rico de Coletas</span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{filteredRegistros.length} registros</span>
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0c1220] border-b border-white/[0.08]">
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Data</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Cliente</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Produto</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Concorrente</th>
                                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">PreÃ§o</th>
                                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Quem Coletou</th>`n                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Ações</th>
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
                            ) : filteredRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-600">
                                        <Tags className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum preÃ§o coletado encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRegistros.map((r, index) => {
                                    const data = new Date(r.dataColeta);
                                    const clienteNome = r.cliente ? (r.cliente.nomeFantasia || r.cliente.razaoSocial) : null;
                                    return (
                                        <tr
                                            key={r.id}
                                            className={`border-b border-white/[0.03] transition-all duration-150 ${index % 2 === 0 ? 'bg-transparent hover:bg-white/[0.03]' : 'bg-white/[0.015] hover:bg-white/[0.04]'}`}
                                        >
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-gray-300">{data.toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-[10px] font-mono text-gray-600">{data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 hidden md:table-cell">
                                                {clienteNome ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-gray-200 truncate max-w-[220px]">{clienteNome}</span>
                                                        {r.cliente?.cidade && <span className="text-[10px] text-gray-600">{r.cliente.cidade}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-white">{r.produtoBase}</span>
                                                    <span className="text-[10px] text-gray-600 md:hidden">{clienteNome || 'Sem cliente'}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border bg-rose-500/10 text-rose-400 border-rose-500/20">
                                                    {r.marcaConcorrente.nome}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-sm font-bold tabular-nums text-emerald-400">{formatBRL(r.precoPrateleira)}</span>
                                            </td>
                                            <td className="px-3 py-2.5 hidden md:table-cell">
                                                {r.vendedor ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                                                        <UserCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                                                        {r.vendedor.nome}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                                                        <UserCircle2 className="h-3.5 w-3.5" />
                                                        VocÃª (Admin)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEditClick(r)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors" title="Editar">
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(r.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Excluir">
                                                        <Trash2 className="h-4 w-4" />
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

            {/* â•â•â•â•â•â•â•â•â•â•â• MODAL â€” Registrar PreÃ§o Coletado â•â•â•â•â•â•â•â•â•â•â• */}
            <AnimatePresence>
                {showRegistrar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowRegistrar(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
                                        <Tags className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{editRegistroId ? 'Editar Preço' : 'Registrar Preço Coletado'}</h3>
                                </div>
                                <button onClick={() => setShowRegistrar(false)} className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Cliente / PDV (opcional)</label>
                                    <select value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)} className={inputClass}>
                                        <option value="">Sem cliente vinculado</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Produto Base</label>
                                    <select
                                        value={formProdutoNome}
                                        onChange={(e) => setFormProdutoNome(e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="">Selecione o produto nosso...</option>
                                        {produtosSistema.map(p => (
                                            <option key={p.id} value={p.nome}>{p.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Marca Concorrente</label>
                                    <select value={formMarcaId} onChange={(e) => setFormMarcaId(e.target.value)} className={inputClass}>
                                        <option value="">Selecione a marca...</option>
                                        {marcas.map(m => (
                                            <option key={m.id} value={m.id}>{m.nome}</option>
                                        ))}
                                    </select>
                                    {marcas.length === 0 && (
                                        <p className="text-[11px] text-amber-400 mt-1.5">
                                            Nenhuma marca cadastrada. Use &quot;Gerenciar Marcas&quot; primeiro.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">PreÃ§o de Prateleira (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        inputMode="decimal"
                                        value={formPreco}
                                        onChange={(e) => setFormPreco(e.target.value)}
                                        placeholder="0,00"
                                        className={inputClass}
                                    />
                                </div>
                                {erroPreco && <p className="text-xs text-red-400">{erroPreco}</p>}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowRegistrar(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRegistrarPreco}
                                    disabled={savingPreco || !formProdutoNome || !formMarcaId || !formPreco}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingPreco && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {savingPreco ? 'Salvando...' : (editRegistroId ? 'Salvar AlteraÃ§Ãµes' : 'Salvar Coleta')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* â•â•â•â•â•â•â•â•â•â•â• MODAL â€” Gerenciar Marcas â•â•â•â•â•â•â•â•â•â•â• */}
            <AnimatePresence>
                {showMarcas && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowMarcas(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-full bg-rose-500/10 p-3 text-rose-500">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Marcas Concorrentes</h3>
                                        <p className="text-xs text-gray-500">Lista fechada usada no PC e no App</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowMarcas(false)} className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={novaMarca}
                                    onChange={(e) => setNovaMarca(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCriarMarca(); }}
                                    placeholder="Nome da nova marca..."
                                    className={inputClass}
                                />
                                <button
                                    onClick={handleCriarMarca}
                                    disabled={savingMarca || !novaMarca.trim()}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {savingMarca ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Adicionar
                                </button>
                            </div>
                            {erroMarca && <p className="text-xs text-red-400 mt-2">{erroMarca}</p>}

                            <div className="mt-4 rounded-lg border border-white/[0.06] max-h-72 overflow-auto">
                                {marcas.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600">
                                        <Store className="h-6 w-6 mx-auto mb-1 opacity-30" />
                                        <p className="text-xs">Nenhuma marca cadastrada</p>
                                    </div>
                                ) : (
                                    marcas.map((m, idx) => (
                                        <div
                                            key={m.id}
                                            className={`flex items-center justify-between px-3 py-2 border-b border-white/[0.03] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}
                                        >
                                            <span className="text-sm text-gray-200">{m.nome}</span>
                                            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                {m._count?.centralPrecos ?? 0} coletas
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
