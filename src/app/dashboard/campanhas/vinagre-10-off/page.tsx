'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, Beaker, TrendingUp, Users, Package, Printer, FileDown } from 'lucide-react';
import Link from 'next/link';
import { PrintHeader } from '@/components/ui/PrintHeader';

interface ClienteReport {
    clienteId: string;
    nomeFantasia: string;
    razaoSocial: string;
    cidade: string;
    estado: string;
    vendedor: string;
    telefone: string;
    totalComprado: number;
    receitaGerada: number;
    pedidosCount: number;
    ultimaCompra: string;
}

interface DashboardData {
    campanha: {
        nome: string;
        status: string;
        dataInicio: string;
    };
    metricasGlobais: {
        totalClientes: number;
        volumeTotal: number;
        receitaTotal: number;
    };
    clientes: ClienteReport[];
}

export default function CampanhaVinagreDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/campanhas/vinagre-10-off');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Erro ao buscar dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = useCallback(async () => {
        if (!data) return;
        setIsGeneratingPdf(true);

        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const colors = {
                headerDark: [10, 10, 14] as [number, number, number],
                accentBlue: [37, 99, 235] as [number, number, number],
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
            };

            // Cabeçalho PDF
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...colors.headerDark);
            doc.text('Relatório de Campanha - Vinagre 10% OFF', 14, 20);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...colors.textMuted);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);

            // KPI Cards no PDF
            doc.setFontSize(10);
            doc.setTextColor(...colors.textDark);
            doc.text(`Clientes Atingidos: ${data.metricasGlobais.totalClientes}`, 14, 36);
            doc.text(`Volume Vendido: ${data.metricasGlobais.volumeTotal} un`, 80, 36);
            doc.text(`Receita Gerada: R$ ${data.metricasGlobais.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 36);

            // Tabela
            const tableBody = data.clientes.map(c => [
                c.nomeFantasia,
                `${c.cidade}-${c.estado}`,
                c.vendedor,
                new Date(c.ultimaCompra).toLocaleDateString('pt-BR'),
                String(c.totalComprado),
                `R$ ${c.receitaGerada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY: 45,
                head: [['Cliente', 'Cidade', 'Vendedor', 'Última Compra', 'Volume (un)', 'Faturamento']],
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: colors.headerDark, textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    4: { halign: 'center' },
                    5: { halign: 'right' }
                }
            });

            doc.save('Relatorio_Vinagre_10OFF.pdf');
        } catch (error) {
            console.error('Erro ao gerar PDF', error);
            alert('Erro ao gerar o PDF. Tente novamente.');
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [data]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-64 items-center justify-center text-gray-400">
                <p>Erro ao carregar os dados.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header exclusivo para impressão. */}
            <div className="hidden print:block print:w-full print:mb-6">
                <PrintHeader titulo="Relatório de Campanha - Vinagre 10% OFF" subtitulo="FRPlus Gestão Comercial" />
                <div className="flex justify-between border-b border-gray-300 pb-4 mb-4 text-black">
                    <div>
                        <p className="text-sm"><strong>Clientes Atingidos:</strong> {data.metricasGlobais.totalClientes}</p>
                        <p className="text-sm"><strong>Volume Total Vendido:</strong> {data.metricasGlobais.volumeTotal} un</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm"><strong>Receita Total:</strong> R$ {data.metricasGlobais.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-gray-500 mt-1">Data base: {new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            </div>

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
                            <p className="text-sm text-gray-400">Controle de Informações - Campanhas</p>
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
                            onClick={handleExportPDF} 
                            disabled={isGeneratingPdf}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50"
                        >
                            {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Exportar PDF
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm flex items-start gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Users className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Clientes Atingidos</p>
                            <p className="text-2xl font-bold text-white">{data.metricasGlobais.totalClientes}</p>
                        </div>
                    </div>
                    
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm flex items-start gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg">
                            <Package className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Volume Vendido</p>
                            <p className="text-2xl font-bold text-white">{data.metricasGlobais.volumeTotal} <span className="text-sm font-normal text-gray-500">un</span></p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm flex items-start gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Receita Gerada</p>
                            <p className="text-2xl font-bold text-white">
                                <span className="text-sm font-normal text-gray-500 mr-1">R$</span>
                                {data.metricasGlobais.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabela Analítica (Tela) */}
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">Cliente</th>
                                <th className="px-6 py-4 font-medium hidden md:table-cell">Vendedor</th>
                                <th className="px-6 py-4 font-medium hidden md:table-cell text-center">Última Compra</th>
                                <th className="px-6 py-4 font-medium text-center">Qtd. Pedidos</th>
                                <th className="px-6 py-4 font-medium text-center">Volume (un)</th>
                                <th className="px-6 py-4 font-medium text-right">Faturamento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.clientes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Nenhum cliente comprou este item na campanha ainda.
                                    </td>
                                </tr>
                            ) : (
                                data.clientes.map((cliente, idx) => (
                                    <motion.tr 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.02 }}
                                        key={cliente.clienteId} 
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-white">{cliente.nomeFantasia}</p>
                                            <p className="text-xs text-gray-500">{cliente.cidade} - {cliente.estado}</p>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <p className="text-gray-400">{cliente.vendedor}</p>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell text-center">
                                            <span className="text-gray-400">
                                                {new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-gray-400 text-xs">
                                                {cliente.pedidosCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-block px-2 py-1 bg-blue-500/10 text-blue-400 font-medium rounded text-xs border border-blue-500/20">
                                                {cliente.totalComprado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="font-medium text-white">R$ {cliente.receitaGerada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
            
            {/* Tabela de Impressão (Só aparece no print, forçando break-inside-avoid e cabeçalho repetição) */}
            <div className="hidden print:block print:w-full">
                <table className="w-full text-left text-sm border-collapse text-black" style={{ pageBreakInside: 'auto' }}>
                    <thead style={{ display: 'table-header-group' }}>
                        <tr className="border-b-2 border-black bg-gray-100">
                            <th className="py-2 px-2 font-bold">Cliente / Cidade</th>
                            <th className="py-2 px-2 font-bold">Vendedor</th>
                            <th className="py-2 px-2 text-center font-bold">Última Compra</th>
                            <th className="py-2 px-2 text-center font-bold">Volume (un)</th>
                            <th className="py-2 px-2 text-right font-bold">Faturamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.clientes.map(c => (
                            <tr key={c.clienteId} className="border-b border-gray-300" style={{ pageBreakInside: 'avoid' }}>
                                <td className="py-2 px-2">
                                    <strong>{c.nomeFantasia}</strong><br/>
                                    <span className="text-xs text-gray-600">{c.cidade}-{c.estado}</span>
                                </td>
                                <td className="py-2 px-2">{c.vendedor}</td>
                                <td className="py-2 px-2 text-center">{new Date(c.ultimaCompra).toLocaleDateString('pt-BR')}</td>
                                <td className="py-2 px-2 text-center">{c.totalComprado}</td>
                                <td className="py-2 px-2 text-right">R$ {c.receitaGerada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
