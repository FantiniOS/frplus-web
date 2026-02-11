'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingUp, Lightbulb, Phone, Mail, MessageCircle, ChevronRight, Filter, RefreshCw, X, CheckCircle2 } from 'lucide-react';

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
    clienteTelefone?: string;
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

    const [activeInsight, setActiveInsight] = useState<SalesInsight | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleAction = (insight: SalesInsight) => {
        setAnalyzing(true);
        setActiveInsight(insight);

        // Simulate AI Analysis delay
        setTimeout(() => {
            setAnalyzing(false);
        }, 1500);
    };

    const closeInsightModal = () => {
        setActiveInsight(null);
        setAnalyzing(false);
    };

    const getInsightDetails = (insight: SalesInsight) => {
        switch (insight.type) {
            case 'decliningVolume':
                return {
                    title: 'Queda de Volume Detectada',
                    analysis: `A IA identificou uma redução significativa no padrão de compras do cliente ${insight.clienteNome}. Comparando os últimos 3 pedidos com a média histórica, houve uma queda abrupta.`,
                    possibleCauses: [
                        'Oferta da concorrência com preços menores.',
                        'Insatisfação com último pedido (atraso ou avaria).',
                        'Mudança no mix de produtos comprados.',
                        'Sazonalidade negativa do setor do cliente.'
                    ],
                    recommendation: 'Entrar em contato imediatamente para entender o motivo. Ofereça uma condição especial para o próximo pedido como forma de recuperação.',
                    messageSuggestion: `Olá ${insight.clienteNome}, notei que faz um tempo que não fechamos um pedido maior. Está precisando de reposição? Tenho uma condição especial para você hoje.`
                };
            case 'lowTicket':
                return {
                    title: 'Ticket Médio Abaixo do Potencial',
                    analysis: `O cliente ${insight.clienteNome} tem comprado com frequência, mas o valor médio dos pedidos está abaixo do ideal para o seu perfil e região.`,
                    possibleCauses: [
                        'Cliente comprando apenas itens de reposição rápida.',
                        'Desconhecimento do catálogo completo.',
                        'Focando compras maiores em outro fornecedor.'
                    ],
                    recommendation: 'Apresentar produtos de maior valor agregado (Curva A) e lançamentos. Tentar fazer um upgrade no próximo pedido.',
                    messageSuggestion: `Olá ${insight.clienteNome}, chegaram novidades da linha Premium que combinam muito com seu perfil. Posso te mandar o catálogo atualizado?`
                };
            case 'untappedPotential':
                return {
                    title: 'Alto Potencial de Reativação',
                    analysis: `Histórico mostra que ${insight.clienteNome} já foi um cliente Top Tier, mas reduziu drasticamente a frequência. O potencial de recuperação é alto.`,
                    possibleCauses: [
                        'Perda de contato ou esquecimento.',
                        'Mudança de comprador no cliente.',
                        'Falta de visitas/contato proativo.'
                    ],
                    recommendation: 'Reativar relacionamento com visita presencial ou ligação. Focar em "sentimos sua falta".',
                    messageSuggestion: `Oi ${insight.clienteNome}, sumido! Estava analisando aqui e vi que faz tempo que não conversamos. Como estão as coisas por aí?`
                };
            default:
                return {
                    title: 'Análise de Oportunidade',
                    analysis: insight.description,
                    possibleCauses: [],
                    recommendation: 'Verificar histórico e entrar em contato.',
                    messageSuggestion: `Olá ${insight.clienteNome}, vi uma oportunidade para você: ${insight.description}`
                };
        }
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Inteligência Artificial</h1>
                    <p className="text-gray-400 text-sm">Insights e oportunidades gerados pelo Kyra AI</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Atualizar Dados"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all
                            ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                        <span className="hidden md:inline">{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`
                                text-xs px-2 py-0.5 rounded-full
                                ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}
                            `}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm relative">
                {/* Modal Overlay */}
                {activeInsight && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            {analyzing ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Lightbulb className="w-6 h-6 text-purple-400 animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Kyra AI analisando...</h3>
                                    <p className="text-sm text-gray-400">Processando histórico de compras e comportamento do cliente.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                    AI INSIGHT
                                                </span>
                                                <span className="text-xs text-gray-400">{new Date().toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                {getInsightDetails(activeInsight).title}
                                            </h3>
                                        </div>
                                        <button onClick={closeInsightModal} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                                            <X className="w-5 h-5 text-gray-400" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Analysis Section */}
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4" />
                                                Análise do Comportamento
                                            </h4>
                                            <p className="text-sm text-gray-300 leading-relaxed">
                                                {getInsightDetails(activeInsight).analysis}
                                            </p>
                                        </div>

                                        {/* Possible Causes */}
                                        {getInsightDetails(activeInsight).possibleCauses.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Possíveis Causas
                                                </h4>
                                                <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 ml-1">
                                                    {getInsightDetails(activeInsight).possibleCauses.map((cause, idx) => (
                                                        <li key={idx}>{cause}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Recommendation */}
                                        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                                            <h4 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-2">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Recomendação da IA
                                            </h4>
                                            <p className="text-sm text-gray-300">
                                                {getInsightDetails(activeInsight).recommendation}
                                            </p>
                                        </div>

                                        {/* Action Button */}
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(getInsightDetails(activeInsight).messageSuggestion)}`}
                                            target="_blank"
                                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-colors shadow-lg shadow-green-900/20"
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                            Enviar Mensagem Sugerida no WhatsApp
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}


                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* Inactive Clients Tab */}
                        {activeTab === 'inactive' && (
                            // ... (keep existing activeTab === 'inactive' content) ...
                            <div className="space-y-4">
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
                                        {opportunities.map((opp, idx) => {
                                            const typeLabels = {
                                                upgrade: 'Upgrade',
                                                crossSell: 'Venda Cruzada',
                                                seasonal: 'Sazonal',
                                                reactivation: 'Reativação'
                                            };
                                            const typeLabel = typeLabels[opp.type] || opp.type;

                                            // Handle Phone Link
                                            const cleanPhone = opp.clienteTelefone?.replace(/\D/g, '');
                                            const whatsappLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=Olá ${opp.clienteNome}, vi uma oportunidade para você: ${opp.description}` : '#';

                                            return (
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
                                                        <span className="text-xs text-purple-400 uppercase font-semibold">{typeLabel}</span>
                                                        <a
                                                            href={whatsappLink}
                                                            target={cleanPhone ? "_blank" : "_self"}
                                                            onClick={(e) => !cleanPhone && e.preventDefault()}
                                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${cleanPhone
                                                                ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 cursor-pointer'
                                                                : 'bg-gray-600/20 text-gray-400 cursor-not-allowed'}`}
                                                        >
                                                            {opp.actionLabel}
                                                        </a>
                                                    </div>
                                                </div>
                                            )
                                        })}
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
                                                    <button
                                                        onClick={() => handleAction(insight)}
                                                        className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors"
                                                    >
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
