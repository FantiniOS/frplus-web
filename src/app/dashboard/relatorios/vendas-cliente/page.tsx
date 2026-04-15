/* eslint-disable */
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { gerarPdfHistoricoCompras } from '@/lib/gerarPdfHistoricoCompras';
import {
    FileText, Calendar, Download, Search, Users, Loader2, X, ChevronLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

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

    const [gerando, setGerando] = useState(false);
    const [erro, setErro] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

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
    };

    const handleGerarPDF = async () => {
        setErro('');

        if (!clienteId) {
            setErro('Selecione um cliente para gerar o relatório.');
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

        setGerando(true);
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
                setGerando(false);
                return;
            }

            await gerarPdfHistoricoCompras({
                clienteNome: data.cliente.nome,
                periodoInicio: data.periodo.inicio,
                periodoFim: data.periodo.fim,
                pedidos: data.pedidos,
                totais: data.totais,
            });

        } catch (error: any) {
            console.error('[VendasCliente] Erro:', error);
            setErro(error.message || 'Erro inesperado ao gerar o relatório.');
        } finally {
            setGerando(false);
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
                            Gere o histórico de compras de um cliente em PDF
                        </p>
                    </div>
                </div>
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
                        <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">Relatório — Histórico de Compras</h2>
                        <p className="text-xs text-gray-400">Selecione o cliente e o período para gerar o PDF</p>
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
                        id="gerar-relatorio-btn"
                        onClick={handleGerarPDF}
                        disabled={gerando}
                        className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
                    >
                        {gerando ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Gerando PDF...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Gerar Relatório PDF
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            {/* Info card */}
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
                            O PDF gerado exibe o histórico de compras faturadas do cliente no período selecionado,
                            com volume total em caixas e investimento financeiro. Apenas pedidos com status
                            <span className="text-emerald-400 font-medium"> Faturado</span> ou
                            <span className="text-emerald-400 font-medium"> Concluído</span> são incluídos.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
