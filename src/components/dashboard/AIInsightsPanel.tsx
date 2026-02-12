'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Lightbulb, Users, ChevronRight, Phone, Mail, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface InactiveClient {
    id: string;
    nomeFantasia: string;
    diasInativo: number | null;
    alertLevel: 'vermelho' | 'laranja' | 'amarelo' | 'verde';
    telefone: string;
    email: string;
    motivo?: string; // Reason for the alert
    cicloMedio?: number; // Average cycle in days
}

interface Opportunity {
    type: string;
    clienteId: string;
    clienteNome: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
    actionLabel: string;
}

interface SalesInsight {
    type: string;
    clienteId: string;
    clienteNome: string;
    description: string;
    metric: string;
    priority: 'alta' | 'media' | 'baixa';
}

export function AIInsightsPanel() {
    const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [insights, setInsights] = useState<SalesInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState({
        inactive: { total: 0, vermelho: 0, laranja: 0, amarelo: 0 },
        opportunities: { total: 0 },
        insights: { total: 0 }
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [inactiveRes, oppRes, insightsRes] = await Promise.all([
                    fetch('/api/ai/inactive-clients?days=30'),
                    fetch('/api/ai/opportunities'),
                    fetch('/api/ai/sales-insights')
                ]);

                if (inactiveRes.ok) {
                    const data = await inactiveRes.json();
                    setInactiveClients(data.clients?.slice(0, 5) || []);
                    setSummaries(prev => ({ ...prev, inactive: data.summary }));
                }

                if (oppRes.ok) {
                    const data = await oppRes.json();
                    setOpportunities(data.opportunities?.slice(0, 5) || []);
                    setSummaries(prev => ({ ...prev, opportunities: { total: data.summary?.total || 0 } }));
                }

                if (insightsRes.ok) {
                    const data = await insightsRes.json();
                    setInsights(data.insights?.slice(0, 5) || []);
                    setSummaries(prev => ({ ...prev, insights: { total: data.summary?.total || 0 } }));
                }
            } catch (error) {
                console.error('Error fetching AI insights:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const alertColors = {
        vermelho: 'bg-red-500/20 text-red-400 border-red-500/30',
        laranja: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        amarelo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        verde: 'bg-green-500/20 text-green-400 border-green-500/30'
    };

    const priorityColors = {
        alta: 'bg-red-500/10 text-red-400',
        media: 'bg-yellow-500/10 text-yellow-400',
        baixa: 'bg-green-500/10 text-green-400'
    };

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-6 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
                        <div className="space-y-3">
                            <div className="h-3 bg-white/10 rounded"></div>
                            <div className="h-3 bg-white/10 rounded w-3/4"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                        <Lightbulb className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Inteligência Comercial</h2>
                        <p className="text-xs text-gray-400">Insights automatizados para alavancar suas vendas</p>
                    </div>
                </div>
                <Link href="/dashboard/ai-insights" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    Ver Análise Completa <ChevronRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Cards Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* Card 1: Clientes Inativos */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-medium text-white">Clientes Inativos</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                            {summaries.inactive.total}
                        </span>
                    </div>

                    {inactiveClients.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Nenhum cliente inativo</p>
                    ) : (
                        <div className="space-y-2">
                            {inactiveClients.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{client.nomeFantasia}</p>
                                        <p className="text-[10px] text-gray-500">
                                            {client.diasInativo ? `${client.diasInativo} dias sem comprar` : 'Nunca comprou'}
                                        </p>
                                        {client.motivo && (
                                            <p className="text-[9px] text-blue-400 mt-0.5 italic">
                                                🧠 {client.motivo}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${alertColors[client.alertLevel].split(' ')[0]}`}></span>
                                        <a href={`https://wa.me/55${client.telefone?.replace(/\D/g, '')}`} target="_blank" className="p-1 hover:bg-green-500/20 rounded">
                                            <MessageCircle className="h-3 w-3 text-green-400" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Card 2: Oportunidades */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-400" />
                            <span className="text-sm font-medium text-white">Oportunidades</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                            {summaries.opportunities.total}
                        </span>
                    </div>

                    {opportunities.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Nenhuma oportunidade identificada</p>
                    ) : (
                        <div className="space-y-2">
                            {opportunities.map((opp, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-medium text-white truncate">{opp.clienteNome}</p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColors[opp.priority]}`}>
                                            {opp.type === 'upgrade' ? '⬆️' : opp.type === 'crossSell' ? '🛒' : '📅'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 line-clamp-2">{opp.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Card 3: Alavancagem */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">Alavancagem</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                            {summaries.insights.total}
                        </span>
                    </div>

                    {insights.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Nenhum insight disponível</p>
                    ) : (
                        <div className="space-y-2">
                            {insights.map((insight, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-medium text-white truncate">{insight.clienteNome}</p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColors[insight.priority]}`}>
                                            {insight.priority}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">{insight.description}</p>
                                    <p className="text-[10px] text-blue-400 mt-1">{insight.metric}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
