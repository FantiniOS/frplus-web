/* eslint-disable */
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { gerarPdfHistoricoCompras, type PedidoHistorico } from '@/lib/gerarPdfHistoricoCompras';
import {
    FileText, Calendar, Download, Search, Users, Loader2, X, ChevronLeft,
    Package, DollarSign, Gift, TrendingUp, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface ResultadoBusca {
    clienteNome: string;
    periodoInicio: string;
    periodoFim: string;
    pedidos: PedidoHistorico[];
    totais: {
        totalPedidos: number;
        volumeFaturadoCaixas: number;
        volumeBonificadoCaixas: number;
        valorTotalFaturado: number;
        valorTotalBonificado: number;
    };
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR');
}

export default function VendasClientePage() {
    const { clients, refreshData } = useData();

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Form state
    const [clienteId, setClienteId] = useState('');
    const [clienteNome, setClienteNome] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dataInicial, setDataInicial] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
    });
    const [dataFinal, setDataFinal] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [buscando, setBuscando] = useState(false);
    const [gerandoPdf, setGerandoPdf] = useState(false);
    const [erro, setErro] = useState('');
    const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const resultadoRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter clients for search
    const clientesFiltrados = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return clients.filter(c => c.status === 'Ativo' || !c.status);
        return clients
            .filter(c => c.status === 'Ativo' || !c.status)
            .filter(c => {
                const nome = (c.nomeFantasia || c.razaoSocial || '').toLowerCase();
                const cnpj = (c.cnpj || '').toLowerCase();
                return nome.includes(term) || cnpj.includes(term);
            });
    }, [clients, searchTerm]);

    const handleSelectCliente = (id: string, nome: string) => {
        setClienteId(id);
        setClienteNome(nome);
        setSearchTerm(nome);
        setDropdownOpen(false);
        setErro('');
    };

    const handleClearCliente = () => {
        setClienteId('');
        setClienteNome('');
        setSearchTerm('');
        setErro('');
        setResultado(null);
    };

    const handleBuscar = async () => {
        setErro('');

        if (!clienteId) {
            setErro('Selecione um cliente para buscar o histórico.');
            return;
        }
        if (!dataInicial || !dataFinal) {
            setErro('Preencha as datas inicial e final.');
            return;
        }
        if (new Date(dataInicial) > new Date(dataFinal)) {
            setErro('A data inicial não pode ser posterior à data final.');
            return;
        }

        setBuscando(true);
        setResultado(null);
        try {
            const params = new URLSearchParams({
                clienteId,
                dataInicial,
                dataFinal,
            });

            const res = await fetch(`/api/relatorios/vendas-cliente?${params}`, {
                cache: 'no-store',
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro ao buscar dados do servidor.');
            }

            const data = await res.json();

            if (data.pedidos.length === 0) {
                setErro('Nenhum pedido faturado encontrado para este cliente no período selecionado.');
                setBuscando(false);
                return;
            }

            setResultado({
                clienteNome: data.cliente.nome,
                periodoInicio: data.periodo.inicio,
                periodoFim: data.periodo.fim,
                pedidos: data.pedidos,
                totais: data.totais,
            });

            // Scroll to results after render
            setTimeout(() => {
                resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);

        } catch (error: any) {
            console.error('[VendasCliente] Erro:', error);
            setErro(error.message || 'Erro inesperado ao buscar dados.');
        } finally {
            setBuscando(false);
        }
    };

    const handleExportarPDF = async () => {
        if (!resultado) return;
        setGerandoPdf(true);
        try {
            await gerarPdfHistoricoCompras({
                clienteNome: resultado.clienteNome,
                periodoInicio: resultado.periodoInicio,
                periodoFim: resultado.periodoFim,
                pedidos: resultado.pedidos,
                totais: resultado.totais,
            });
        } catch (error: any) {
            console.error('[VendasCliente] Erro PDF:', error);
            setErro(error.message || 'Erro ao gerar o PDF.');
        } finally {
            setGerandoPdf(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/relatorios"
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Vendas por Cliente</h1>
                        <p className="text-sm text-gray-400">
                            Consulte o histórico de compras e exporte em PDF
                        </p>
                    </div>
                </div>

                {/* Export PDF button — top-level, only when data is loaded */}
                <AnimatePresence>
                    {resultado && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            id="exportar-pdf-btn"
                            onClick={handleExportarPDF}
                            disabled={gerandoPdf}
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
                        >
                            {gerandoPdf ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Gerando PDF...
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4" />
                                    📄 Exportar para PDF
                                </>
                            )}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 overflow-hidden"
            >
                {/* Card Header */}
                <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                        <Search className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">Filtros de Busca</h2>
                        <p className="text-xs text-gray-400">Selecione o cliente e o período para consultar</p>
                    </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-5">
                    {/* Cliente Selection with Search */}
                    <div className="space-y-1.5" ref={dropdownRef}>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            Cliente *
                        </label>
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    id="cliente-search-input"
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setDropdownOpen(true);
                                        if (clienteId) {
                                            setClienteId('');
                                            setClienteNome('');
                                        }
                                    }}
                                    onFocus={() => setDropdownOpen(true)}
                                    placeholder="Buscar cliente por nome ou CNPJ..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-gray-600 transition-all"
                                />
                                {(searchTerm || clienteId) && (
                                    <button
                                        onClick={handleClearCliente}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown */}
                            {dropdownOpen && !clienteId && (
                                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-[#0f1729] shadow-2xl shadow-black/50">
                                    {clientesFiltrados.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-500 text-center">
                                            Nenhum cliente encontrado
                                        </div>
                                    ) : (
                                        clientesFiltrados.slice(0, 50).map(c => {
                                            const nome = c.nomeFantasia || c.razaoSocial || 'Sem Nome';
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => handleSelectCliente(c.id, nome)}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/[0.04] last:border-0 flex items-center justify-between"
                                                >
                                                    <span className="font-medium truncate">{nome}</span>
                                                    <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                                                        {c.cnpj || ''}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected badge */}
                        {clienteId && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs">
                                <Users className="h-3.5 w-3.5" />
                                Cliente selecionado: <span className="font-semibold">{clienteNome}</span>
                            </div>
                        )}
                    </div>

                    {/* Date Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                Data Inicial *
                            </label>
                            <input
                                id="data-inicial-input"
                                type="date"
                                value={dataInicial}
                                onChange={(e) => setDataInicial(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                Data Final *
                            </label>
                            <input
                                id="data-final-input"
                                type="date"
                                value={dataFinal}
                                onChange={(e) => setDataFinal(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Error message */}
                    {erro && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                        >
                            <X className="h-4 w-4 flex-shrink-0" />
                            {erro}
                        </motion.div>
                    )}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20">
                    <button
                        id="buscar-historico-btn"
                        onClick={handleBuscar}
                        disabled={buscando}
                        className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
                    >
                        {buscando ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Buscando...
                            </>
                        ) : (
                            <>
                                <Search className="h-4 w-4" />
                                Buscar Histórico
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            {/* ====== RESULTS SECTION ====== */}
            <AnimatePresence>
                {resultado && (
                    <motion.div
                        ref={resultadoRef}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="space-y-5"
                    >
                        {/* Period label */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <BarChart3 className="h-4 w-4 text-cyan-400" />
                                <span>
                                    Resultados para <span className="text-white font-semibold">{resultado.clienteNome}</span>
                                    {' · '}
                                    <span className="text-gray-500">
                                        {formatDateBR(resultado.periodoInicio)} — {formatDateBR(resultado.periodoFim)}
                                    </span>
                                </span>
                            </div>
                            <span className="text-xs text-gray-500">
                                {resultado.pedidos.length} pedido{resultado.pedidos.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Total Pedidos */}
                            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                                        <Package className="h-3.5 w-3.5 text-blue-400" />
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-medium">Total de Pedidos</span>
                                </div>
                                <p className="text-xl font-bold text-white">{resultado.totais.totalPedidos}</p>
                            </div>

                            {/* Volume Faturado */}
                            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-cyan-500/10">
                                        <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-medium">Volume Faturado (CX)</span>
                                </div>
                                <p className="text-xl font-bold text-cyan-400">{resultado.totais.volumeFaturadoCaixas}</p>
                            </div>

                            {/* Investimento Total */}
                            <div className="rounded-xl border border-emerald-500/10 bg-gradient-to-br from-emerald-950/30 to-[#0a0f1a] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-medium">Investimento Total (R$)</span>
                                </div>
                                <p className="text-xl font-bold text-emerald-400">{formatBRL(resultado.totais.valorTotalFaturado)}</p>
                            </div>

                            {/* Volume Bonificado */}
                            <div className="rounded-xl border border-amber-500/10 bg-gradient-to-br from-amber-950/20 to-[#0a0f1a] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                                        <Gift className="h-3.5 w-3.5 text-amber-400" />
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-medium">Vol. Bonificado (CX)</span>
                                </div>
                                <p className="text-xl font-bold text-amber-400 italic">{resultado.totais.volumeBonificadoCaixas}</p>
                            </div>

                            {/* Valor Bonificado */}
                            <div className="rounded-xl border border-amber-500/10 bg-gradient-to-br from-amber-950/20 to-[#0a0f1a] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                                        <Gift className="h-3.5 w-3.5 text-amber-400" />
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-medium">Verba Injetada (R$)</span>
                                </div>
                                <p className="text-xl font-bold text-amber-400 italic">{formatBRL(resultado.totais.valorTotalBonificado)}</p>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                                        <FileText className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <h3 className="font-semibold text-white text-sm">Pedidos Faturados</h3>
                                </div>

                                {/* Inline export button */}
                                <button
                                    id="exportar-pdf-inline-btn"
                                    onClick={handleExportarPDF}
                                    disabled={gerandoPdf}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    {gerandoPdf ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Download className="h-3.5 w-3.5" />
                                    )}
                                    Exportar PDF
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/[0.06]">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Nº Pedido</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Nº NF</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Vol. (CX)</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {resultado.pedidos.map((p, idx) => (
                                            <tr
                                                key={p.id}
                                                className={`transition-colors hover:bg-white/[0.03] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}
                                            >
                                                <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                                                    {formatDateBR(p.data)}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-semibold ${p.isBonificacao ? 'text-amber-400' : 'text-white'}`}>
                                                            {p.numeroPedido}
                                                        </span>
                                                        {p.isBonificacao && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                                                                <Gift className="h-2.5 w-2.5" />
                                                                Bonif.
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                                                    {p.notaFiscal || '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-gray-300 text-xs whitespace-nowrap">
                                                    {p.volumeCaixas}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right font-semibold text-xs whitespace-nowrap ${p.isBonificacao ? 'text-amber-400/70 italic' : 'text-emerald-400'}`}>
                                                    {formatBRL(p.valorFaturado)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info card — show when no results yet */}
            {!resultado && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10 mt-0.5">
                            <FileText className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-300">Sobre este relatório</p>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Busque o histórico de compras faturadas do cliente no período selecionado.
                                Os dados serão exibidos em tela para conferência antes da exportação em PDF.
                                Apenas pedidos com status
                                <span className="text-emerald-400 font-medium"> Faturado</span> ou
                                <span className="text-emerald-400 font-medium"> Concluído</span> são incluídos.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
