"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    Filter,
    Search,
    TrendingUp,
    Package,
    DollarSign,
    Download
} from "lucide-react";


import { buscarClientesParaSelect } from "./actions";

interface Cliente {
    id: string;
    nomeFantasia: string;
    cnpj: string;
}

interface CurvaItem {
    posicao: number;
    produtoId: string;
    nomeProduto: string;
    marca: string;
    quantidade: number;
    valorTotal: number;
    curva: string;
}

interface CurvaSummary {
    totalCaixas: number;
    totalFaturado: number;
}

export default function CurvaABCPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [selectedCliente, setSelectedCliente] = useState<string>('');
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");

    const [loading, setLoading] = useState(false);
    const [resultados, setResultados] = useState<CurvaItem[]>([]);
    const [summary, setSummary] = useState<CurvaSummary | null>(null);

    // Fetch clients on mount
    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const data = await buscarClientesParaSelect();
                if (Array.isArray(data)) {
                    setClientes(data);
                }
            } catch (error) {
                console.error("Erro ao carregar clientes", error);
            }
        };
        fetchClientes();
    }, []);

    const handleGerarAnalise = async () => {
        if (!selectedCliente) {
            alert("Selecione um cliente para gerar a Curva ABC.");
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('clienteId', selectedCliente);
            if (dataInicio) params.append('dataInicio', new Date(dataInicio).toISOString());

            if (dataFim) {
                const df = new Date(dataFim)
                df.setHours(23, 59, 59, 999)
                params.append('dataFim', df.toISOString());
            }

            const res = await fetch(`/api/curva-abc?${params.toString()}`);
            if (!res.ok) {
                throw new Error("Erro na busca da Curva ABC");
            }

            const data = await res.json();
            setResultados(data.data || []);
            setSummary(data.summary || null);

        } catch (error) {
            console.error(error);
            alert("Falha ao gerar o relatório.");
        } finally {
            setLoading(false);
        }
    };

    const getCurvaBadgeColor = (curva: string) => {
        switch (curva) {
            case 'A': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'B': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'C': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
            default: return 'bg-zinc-500/10 text-zinc-400';
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Filter className="h-6 w-6 text-emerald-400" />
                        Curva ABC de Vendas
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Analise o ranking de volume (caixas/unidades) transacionado por um cliente específico.
                    </p>
                </div>
            </div>

            {/* FILTROS */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 lg:p-6 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Cliente *
                        </label>
                        <select
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={selectedCliente}
                            onChange={(e) => setSelectedCliente(e.target.value)}
                        >
                            <option value="" disabled className="bg-zinc-900">Selecione um cliente...</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id} className="bg-zinc-900">
                                    {`${c.nomeFantasia} - ${c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Data Inicial
                        </label>
                        <input
                            type="date"
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Data Final
                        </label>
                        <input
                            type="date"
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                        />
                    </div>

                    <div className="col-span-1 md:col-span-4 mt-2">
                        <button
                            onClick={handleGerarAnalise}
                            disabled={loading || !selectedCliente}
                            className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            Gerar Análise Volumétrica
                        </button>
                    </div>
                </div>
            </div>

            {/* RESULTS AREA */}
            {summary && resultados.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* TOTALIZADORES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Package className="h-16 w-16" />
                            </div>
                            <p className="text-sm font-medium text-indigo-300">Volume Total Escoado (Curva Principal)</p>
                            <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
                                {summary.totalCaixas.toLocaleString('pt-BR')} <span className="text-lg text-gray-400 font-normal">unid.</span>
                            </h3>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <DollarSign className="h-16 w-16" />
                            </div>
                            <p className="text-sm font-medium text-emerald-300">Faturamento Global do Período</p>
                            <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalFaturado)}
                            </h3>
                        </div>
                    </div>

                    {/* TABELA DE RANKING */}
                    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Posição</th>
                                        <th className="px-6 py-4 font-medium">Produto</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Marca</th>
                                        <th className="px-6 py-4 font-medium text-center">Classificação</th>
                                        <th className="px-6 py-4 font-medium text-right">Volume</th>
                                        <th className="px-6 py-4 font-medium text-right">Total Faturado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resultados.map((item) => (
                                        <tr key={item.produtoId} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                                {item.posicao}º
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">
                                                {item.nomeProduto}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">
                                                {item.marca}
                                            </td>
                                            <td className="px-6 py-4 justify-center flex">
                                                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getCurvaBadgeColor(item.curva)}`}>
                                                    Curva {item.curva}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-400 font-semibold">
                                                {item.quantidade.toLocaleString('pt-BR')} <span className="text-xs text-gray-500 font-normal">cx/un</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-300">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {!loading && summary && resultados.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
                    <Package className="mx-auto h-12 w-12 text-gray-500 mb-3 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Nenhum dado volumétrico encontrado</h3>
                    <p className="text-gray-400 mt-1">Este cliente não possui histórico de faturamento neste período.</p>
                </div>
            )}

        </div>
    );
}
