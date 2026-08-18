'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, ArrowLeft, Beaker, FileDown, Printer } from 'lucide-react';
import Link from 'next/link';
import { PrintHeader } from '@/components/ui/PrintHeader';
import { useReactToPrint } from 'react-to-print';
import { getHitListVinagre, ApuracaoDashboardData } from '@/app/actions/apuracaoVinagre';

export default function CampanhaVinagreDashboard() {
    const [hitListData, setHitListData] = useState<ApuracaoDashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const printCampanhaRef = useRef<HTMLDivElement>(null);
    const handleExportPDF = useReactToPrint({
        contentRef: printCampanhaRef,
        documentTitle: 'Hit_List_Vinagre_10_OFF'
    });

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        // Fetch data for wide range assuming campaign is recent
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; // Jan 1st of current year
        const end = now.toISOString().split('T')[0]; // Today

        getHitListVinagre(start, end).then(data => {
            setHitListData(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!hitListData) {
        return (
            <div className="flex h-64 items-center justify-center text-gray-400">
                <p>Erro ao carregar os dados.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="print:hidden space-y-6">
                {/* Header (Tela) */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-full transition-colors mr-1">
                            <ArrowLeft className="h-5 w-5 text-gray-400" />
                        </Link>
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <Beaker className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Vinagre 10% OFF (Atacado)</h1>
                            <p className="text-sm text-gray-400">Mapa de Caça (Hit List)</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePrint} 
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir
                        </button>
                        <button 
                            onClick={() => handleExportPDF()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                        >
                            <FileDown className="h-4 w-4" />
                            Exportar PDF
                        </button>
                    </div>
                </div>

                {/* PROGRESS BAR DE CONVERSÃO */}
                <div className="bg-[#1a1a24] p-5 rounded-xl border border-white/10">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">Conversão da Base Atacadista</h3>
                            <p className="text-2xl font-bold text-white mt-1">
                                {hitListData.clientesConvertidos} <span className="text-gray-500 text-lg font-normal">de {hitListData.clientesAtacadistasBase} atacadistas</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-blue-500">{hitListData.taxaConversao}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-4 mt-4 overflow-hidden border border-white/5">
                        <div 
                            className="bg-gradient-to-r from-blue-600 to-cyan-400 h-4 rounded-full transition-all duration-1000" 
                            style={{ width: `${hitListData.taxaConversao}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#1a1a24] p-5 rounded-xl border border-emerald-500/20 flex flex-col justify-between">
                        <h3 className="text-gray-400 font-medium text-sm">Volume Total Escoado (Cx)</h3>
                        <p className="text-3xl font-bold text-emerald-400 mt-2">{hitListData.volumeTotalEscoado}</p>
                    </div>
                    <div className="bg-[#1a1a24] p-5 rounded-xl border border-purple-500/20 flex flex-col justify-between">
                        <h3 className="text-gray-400 font-medium text-sm">Receita Total Gerada</h3>
                        <p className="text-3xl font-bold text-purple-400 mt-2">
                            R$ {hitListData.receitaTotalGerada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-[#1a1a24] p-5 rounded-xl border border-amber-500/20 flex flex-col justify-between">
                        <h3 className="text-gray-400 font-medium text-sm">Base Pendente</h3>
                        <p className="text-3xl font-bold text-amber-400 mt-2">{hitListData.clientesAtacadistasBase - hitListData.clientesConvertidos}</p>
                    </div>
                </div>

                {/* HIT LIST TABLE */}
                <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Mapa de Caça (Atacadistas)</h3>
                        <span className="text-xs text-gray-400 bg-black/30 px-3 py-1 rounded-full border border-white/5">
                            Ordenado por pendentes
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs uppercase bg-black/40 text-gray-400 border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Cliente</th>
                                    <th className="px-6 py-3 font-medium">Cidade</th>
                                    <th className="px-6 py-3 font-medium text-center">Status na Campanha</th>
                                    <th className="px-6 py-3 font-medium text-right">Volume (cx)</th>
                                    <th className="px-6 py-3 font-medium text-right">Última Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hitListData.hitList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            Nenhum cliente atacadista encontrado na base.
                                        </td>
                                    </tr>
                                ) : (
                                    hitListData.hitList.map(cliente => (
                                        <tr key={cliente.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{cliente.nomeFantasia}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{cliente.razaoSocial}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">{cliente.cidade}</td>
                                            <td className="px-6 py-4 text-center">
                                                {cliente.statusCampanha === 'Pendente' ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                        ⏳ Pendente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        ✅ Aproveitou
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {cliente.volumeComprado > 0 ? (
                                                    <span className="text-emerald-400 font-bold">{cliente.volumeComprado} cx</span>
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-400 text-xs">
                                                {cliente.ultimaAcao ? new Date(cliente.ultimaAcao).toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
