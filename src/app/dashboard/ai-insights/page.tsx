'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingUp, Lightbulb, Phone, Mail, MessageCircle, ChevronRight, Filter, RefreshCw } from 'lucide-react';

interface InactiveClient {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cidade: string;
    telefone: string;
    celular: string;
    email: string;
    ultimaCompra: string | null;
    diasInativo: number | null;
    totalGasto: number;
    totalPedidos: number;
    alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde';
}

interface Opportunity {
    type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation';
    clienteId: string;
    clienteNome: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
    actionLabel: string;
}

interface SalesInsight {
    type: 'lowTicket' | 'decliningVolume' | 'untappedPotential';
    clienteId: string;
    clienteNome: string;
    description: string;
    metric: string;
    priority: 'alta' | 'media' | 'baixa';
    actionLabel: string;
}

export default function AIInsightsPage() {
    const [activeTab, setActiveTab] = useState<'inactive' | 'opportunities' | 'insights'>('inactive');
    const [daysFilter, setDaysFilter] = useState(15);
    const [loading, setLoading] = useState(true);
    const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [salesInsights, setSalesInsights] = useState<SalesInsight[]>([]);
    const [summaries, setSummaries] = useState({
        inactive: { total: 0, vermelho: 0, laranja: 0, amarelo: 0 },
        opportunities: { total: 0, upgrade: 0, crossSell: 0, seasonal: 0 },
        insights: { total: 0, lowTicket: 0, decliningVolume: 0, untappedPotential: 0 }
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [inactiveRes, oppRes, insightsRes] = await Promise.all([
                fetch(`/api/ai/inactive-clients?days=${daysFilter}`),
                fetch('/api/ai/opportunities'),
                fetch('/api/ai/sales-insights')
            ]);

            if (inactiveRes.ok) {
                const data = await inactiveRes.json();
                setInactiveClients(data.clients || []);
                setSummaries(prev => ({ ...prev, inactive: data.summary }));
            }

            if (oppRes.ok) {
                const data = await oppRes.json();
                setOpportunities(data.opportunities || []);
                setSummaries(prev => ({ ...prev, opportunities: data.summary }));
            }

            if (insightsRes.ok) {
                const data = await insightsRes.json();
                setSalesInsights(data.insights || []);
                setSummaries(prev => ({ ...prev, insights: data.summary }));
            }
        } catch (error) {
            console.error('Error fetching AI data:', error);
        } finally {
            setLoading(false);
        }
    }, [daysFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const alertColors = {
        vermelho: 'bg-red-500/20 text-red-400 border-red-500/30',
        laranja: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        amarelo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        verde: 'bg-green-500/20 text-green-400 border-green-500/30'
    };

    const priorityColors = {
        alta: 'bg-red-500/10 text-red-400 border-red-500/20',
        media: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        baixa: 'bg-green-500/10 text-green-400 border-green-500/20'
    };

    const tabs = [
        { id: 'inactive' as const, label: 'Clientes Inativos', icon: AlertTriangle, color: 'text-red-400', count: summaries.inactive.total },
        { id: 'opportunities' as const, label: 'Oportunidades', icon: Lightbulb, color: 'text-yellow-400', count: summaries.opportunities.total },
        { id: 'insights' as const, label: 'Alavancagem', icon: TrendingUp, color: 'text-blue-400', count: summaries.insights.total }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="rounded-lg bg-white/5 p-2 hover:bg-white/10 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Inteligência Comercial</h1>
                        <p className="text-sm text-gray-400">Análise de clientes e oportunidades de negócio</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 rounded-xl bg-white/5">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ''}`} />
                        {tab.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/5'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* Inactive Clients Tab */}
                        {activeTab === 'inactive' && (
                            <div className="space-y-4">
                                {/* Filter */}
                                <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-400">Mostrar clientes inativos há:</span>
                                    {[15, 30, 60].map(days => (
                                        <button
                                            key={days}
                                            onClick={() => setDaysFilter(days)}
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${daysFilter === days
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {days}+ dias
                                        </button>
                                    ))}
                                </div>

                                {/* Summary */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="p-3 rounded-lg bg-white/5 text-center">
                                        <p className="text-2xl font-bold text-white">{summaries.inactive.total}</p>
                                        <p className="text-xs text-gray-400">Total</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-red-500/10 text-center">
                                        <p className="text-2xl font-bold text-red-400">{summaries.inactive.vermelho}</p>
                                        <p className="text-xs text-gray-400">60+ dias</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-orange-500/10 text-center">
                                        <p className="text-2xl font-bold text-orange-400">{summaries.inactive.laranja}</p>
                                        <p className="text-xs text-gray-400">30-59 dias</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
                                        <p className="text-2xl font-bold text-yellow-400">{summaries.inactive.amarelo}</p>
                                        <p className="text-xs text-gray-400">15-29 dias</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 text-xs uppercase text-gray-400">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Cliente</th>
                                                <th className="px-4 py-3 text-left">Cidade</th>
                                                <th className="px-4 py-3 text-center">Dias Inativo</th>
                                                <th className="px-4 py-3 text-right">Total Gasto</th>
                                                <th className="px-4 py-3 text-center">Pedidos</th>
                                                <th className="px-4 py-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {inactiveClients.map(client => (
                                                <tr key={client.id} className="hover:bg-white/5">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-white">{client.nomeFantasia}</p>
                                                        <p className="text-xs text-gray-500">{client.razaoSocial}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-300">{client.cidade}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs ${alertColors[client.alertLevel]}`}>
                                                            {client.diasInativo ? `${client.diasInativo} dias` : 'Nunca comprou'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-white">
                                                        R$ {client.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-300">{client.totalPedidos}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <a
                                                                href={`https://wa.me/55${(client.celular || client.telefone)?.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                                                title="WhatsApp"
                                                            >
                                                                <MessageCircle className="h-4 w-4" />
                                                            </a>
                                                            <a
                                                                href={`mailto:${client.email}`}
                                                                className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                                title="Email"
                                                            >
                                                                <Mail className="h-4 w-4" />
                                                            </a>
                                                            <a
                                                                href={`tel:${client.telefone}`}
                                                                className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                                                                title="Ligar"
                                                            >
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {inactiveClients.length === 0 && (
                                        <p className="text-center text-gray-500 py-8">Nenhum cliente inativo encontrado</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Opportunities Tab */}
                        {activeTab === 'opportunities' && (
                            <div className="space-y-4">
                                {opportunities.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">Nenhuma oportunidade identificada</p>
                                ) : (
                                    <div className="grid gap-3">
                                        {opportunities.map((opp, idx) => (
                                            <div key={idx} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">
                                                            {opp.type === 'upgrade' ? '⬆️' : opp.type === 'crossSell' ? '🛒' : opp.type === 'seasonal' ? '📅' : '🔄'}
                                                        </span>
                                                        <p className="font-medium text-white">{opp.clienteNome}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${priorityColors[opp.priority]}`}>
                                                        {opp.priority}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400 mb-3">{opp.description}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-purple-400 uppercase">{opp.type}</span>
                                                    <button className="px-3 py-1 rounded-lg bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
                                                        {opp.actionLabel}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sales Insights Tab */}
                        {activeTab === 'insights' && (
                            <div className="space-y-4">
                                {salesInsights.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">Nenhum insight disponível</p>
                                ) : (
                                    <div className="grid gap-3">
                                        {salesInsights.map((insight, idx) => (
                                            <div key={idx} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">
                                                            {insight.type === 'lowTicket' ? '💰' : insight.type === 'decliningVolume' ? '📉' : '🎯'}
                                                        </span>
                                                        <p className="font-medium text-white">{insight.clienteNome}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${priorityColors[insight.priority]}`}>
                                                        {insight.priority}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400">{insight.description}</p>
                                                <p className="text-sm text-blue-400 mt-1">{insight.metric}</p>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-xs text-purple-400 uppercase">{insight.type}</span>
                                                    <button className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors">
                                                        {insight.actionLabel}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
