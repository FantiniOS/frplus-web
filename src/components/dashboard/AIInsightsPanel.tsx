'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Lightbulb, Megaphone, ChevronRight } from 'lucide-react';
import { WhatsAppButton } from '@/components/dashboard/WhatsAppButton';
import Link from 'next/link';

interface PrestesClient {
    id: string;
    nomeFantasia: string;
    telefone: string;
    cicloMedioDias: number;
    diasInativo: number;
}

interface Opportunity {
    type: string;
    clienteId: string;
    clienteNome: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
}

export function AIInsightsPanel() {
    const [prestesClients, setPrestesClients] = useState<PrestesClient[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState({
        prestes: { total: 0 },
        opportunities: { total: 0 }
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prestesRes, oppRes] = await Promise.all([
                    fetch('/api/ai/prestes-a-comprar', { cache: 'no-store' }),
                    fetch('/api/ai/opportunities', { cache: 'no-store' })
                ]);

                if (prestesRes.ok) {
                    const data = await prestesRes.json();
                    const clients = data.clients?.slice(0, 5) || [];
                    setPrestesClients(clients);
                    setSummaries(prev => ({ ...prev, prestes: { total: data.summary?.total || 0 } }));
                }

                if (oppRes.ok) {
                    const data = await oppRes.json();
                    const opps = data.opportunities?.slice(0, 5) || [];
                    setOpportunities(opps);
                    setSummaries(prev => ({ ...prev, opportunities: { total: data.summary?.total || 0 } }));
                }
            } catch (error) {
                console.error('Error fetching AI insights:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                        <Lightbulb className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Inteligência Comercial</h2>
                        <p className="text-xs text-gray-400">Insights automatizados para alavancar suas vendas</p>
                    </div>
                </div>
                <Link href="/dashboard/ai-insights" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                    Ver Análise Completa <ChevronRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Card 1: Prestes a Comprar */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-medium text-white">Prestes a Comprar</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            {summaries.prestes.total}
                        </span>
                    </div>

                    {prestesClients.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Nenhum cliente no ciclo exato de compra</p>
                    ) : (
                        <div className="space-y-2">
                            {prestesClients.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-xs font-medium text-white truncate">{client.nomeFantasia}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-emerald-400 font-medium">Ciclo: {client.cicloMedioDias}d</span>
                                            <span className="text-[10px] text-gray-600">|</span>
                                            <span className="text-[10px] text-gray-400">Hoje: {client.diasInativo}d</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <WhatsAppButton
                                            clienteId={client.id}
                                            telefone={client.telefone}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Card 2: Oportunidades */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-medium text-white">Oportunidades</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
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
            </div>
        </div>
    );
}
