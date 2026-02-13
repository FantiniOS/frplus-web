'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useData } from '@/contexts/DataContext';
import { ArrowLeft, AlertTriangle, TrendingUp, Lightbulb, Phone, Mail, MessageCircle, ChevronRight, Filter, RefreshCw, X, CheckCircle2, Megaphone, Copy, Zap, Target, Search, Send, Building2, ShoppingBag, Briefcase } from 'lucide-react';

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
    motivo?: string; // Reason for the alert
    cicloMedio?: number; // Average cycle in days
    messageSuggestion?: string;
}

interface Opportunity {
    type: 'upgrade' | 'crossSell' | 'seasonal' | 'reactivation';
    clienteId: string;
    clienteNome: string;
    clienteTelefone?: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
    actionLabel: string;
    messageSuggestion?: string;
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
    const { products, fabricas, clients } = useData();
    const [activeTab, setActiveTab] = useState<'inactive' | 'opportunities' | 'insights' | 'campaigns'>('inactive');
    const [daysFilter, setDaysFilter] = useState(15);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [generatedScripts, setGeneratedScripts] = useState<{ launch: string; reactivation: string; prospecting: string } | null>(null);
    const [selectedScriptType, setSelectedScriptType] = useState<'launch' | 'reactivation' | 'prospecting'>('launch');
    const [clientSearch, setClientSearch] = useState('');
    const [campaignMode, setCampaignMode] = useState<'lancamento' | 'empresa' | 'vitrine'>('lancamento');
    const [selectedShowcaseProducts, setSelectedShowcaseProducts] = useState<string[]>([]);
    const [activeMessage, setActiveMessage] = useState<string>(''); // Currently active message for sending
    const [companyMessages, setCompanyMessages] = useState<{ formal: string; casual: string; pitch: string } | null>(null);
    const [showcaseMessage, setShowcaseMessage] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [salesInsights, setSalesInsights] = useState<SalesInsight[]>([]);
    const [summaries, setSummaries] = useState({
        inactive: { total: 0, vermelho: 0, laranja: 0, amarelo: 0 },
        opportunities: { total: 0, upgrade: 0, crossSell: 0, seasonal: 0 },
        insights: { total: 0, lowTicket: 0, decliningVolume: 0, untappedPotential: 0 },
        campaigns: { total: 1 } // Always available
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
        { id: 'insights' as const, label: 'Alavancagem', icon: TrendingUp, color: 'text-blue-400', count: summaries.insights.total },
        { id: 'campaigns' as const, label: 'Campanhas', icon: Megaphone, color: 'text-purple-400', count: 0 }
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

    const handleGenerateScripts = (productId: string) => {
        setSelectedProduct(productId);
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const fabrica = product.fabricaNome || fabricas.find(f => f.id === product.fabricaId)?.nome || '';

        const scripts = {
            launch: `🚀 *LANÇAMENTO: ${product.nome}* 🚀\n\nOlá [Nome]! Acabou de chegar uma novidade incrível aqui na nossa representação${fabrica ? ` da ${fabrica}` : ''}: *${product.nome}*. É um item que está com alta demanda e tem tudo a ver com o perfil da sua loja. Separei um lote especial para você. Vamos aproveitar?`,
            reactivation: `👋 Oi [Nome], tudo bem? Lembrei de você hoje! Chegou o *${product.nome}*${fabrica ? ` da ${fabrica}` : ''} e, conhecendo seu negócio, sei que vai girar super bem. Estou com uma condição diferenciada de retorno para fecharmos esse pedido. O que acha de reativarmos nossa parceria com esse item campeão?`,
            prospecting: `👋 Olá! Gostaria de apresentar o *${product.nome}*${fabrica ? ` da ${fabrica}` : ''}, um dos itens de maior liquidez do momento. Ideal para atrair novos clientes e aumentar seu ticket médio. Posso te enviar a tabela?`
        };
        setGeneratedScripts(scripts);
        setActiveMessage(scripts[selectedScriptType]);
    };

    // --- Company Presentation ---
    const generateCompanyMessages = () => {
        const fabricasList = fabricas.map(f => f.nome).filter(Boolean);
        const marcasText = fabricasList.length > 0 ? fabricasList.join(', ') : 'diversas marcas líderes';

        const msgs = {
            formal: `🏢 *FANTINI REPRESENTAÇÕES*\n\n_Excelência em Vendas e Parcerias Comerciais_\n\nOlá [Nome]! Meu nome é Fantini, da *Fantini Representações*. Somos uma empresa com mais de *três décadas de experiência* no mercado de vendas e representação comercial, atuando com compromisso, transparência e foco em resultados.\n\nTrabalhamos com marcas de alta performance: *${marcasText}*.\n\nNosso diferencial é o atendimento personalizado e o profundo conhecimento do mercado mineiro. Oferecemos atuação estratégica, acompanhamento próximo, visitas constantes aos PDVs e análise de oportunidades de crescimento.\n\nPosso agendar uma visita para apresentar nosso portfólio?`,
            casual: `👋 Oi [Nome], tudo bem? Aqui é o Fantini, da *Fantini Representações*! 😊\n\nSomos representantes comerciais com mais de *30 anos de estrada*, atendendo o varejo mineiro com as melhores marcas do mercado: *${marcasText}*.\n\nA gente trabalha de perto com cada cliente — visita, acompanhamento, reposição — tudo pra garantir que o produto gire bem na sua loja.\n\nQuer conhecer nosso portfólio? Posso te mandar a tabela ou passar aí pra conversar! 🚀`,
            pitch: `⚡ *Fantini Representações* — +30 anos no mercado mineiro\n\n✅ Marcas: *${marcasText}*\n✅ Atendimento personalizado e visitas ao PDV\n✅ Condições competitivas\n✅ Foco em resultado para o varejista\n\nVamos conversar? 📲`
        };
        setCompanyMessages(msgs);
        setActiveMessage(msgs.formal);
    };

    // --- Product Showcase ---
    const toggleShowcaseProduct = (productId: string) => {
        setSelectedShowcaseProducts(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const generateShowcaseMessage = () => {
        const selected = products.filter(p => selectedShowcaseProducts.includes(p.id));
        if (selected.length === 0) return;

        const productLines = selected.map(p => {
            const fabrica = p.fabricaNome || fabricas.find(f => f.id === p.fabricaId)?.nome || '';
            return `✨ *${p.nome}*${fabrica ? ` (${fabrica})` : ''}`;
        }).join('\n');

        const msg = `🛍️ *VITRINE FANTINI REPRESENTAÇÕES* 🛍️\n\nOlá [Nome]! Separei alguns destaques do nosso portfólio especialmente para você:\n\n${productLines}\n\nTodos com condições especiais e pronta entrega. Quer que eu envie a tabela completa? 📋`;
        setShowcaseMessage(msg);
        setActiveMessage(msg);
    };

    // --- Unified message for client send ---
    const getMessageForClient = (clientName: string) => {
        return activeMessage.replace(/\[Nome\]/g, clientName);
    };

    const filteredClients = clients.filter(c =>
        clientSearch === '' ||
        c.nomeFantasia.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.razaoSocial.toLowerCase().includes(clientSearch.toLowerCase())
    ).slice(0, 50);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const campaignSubTabs = [
        { id: 'lancamento' as const, label: 'Lançamento', icon: Zap, color: 'text-blue-400' },
        { id: 'empresa' as const, label: 'Apresentação', icon: Building2, color: 'text-amber-400' },
        { id: 'vitrine' as const, label: 'Vitrine', icon: ShoppingBag, color: 'text-pink-400' }
    ];

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
                    <p className="text-gray-400 text-sm">Insights e oportunidades gerados pelo FRP AI</p>
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
                        <tab.icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                        <span className="hidden sm:inline truncate">{tab.label}</span>
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
                                    <span className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white font-medium">
                                        15+ dias
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                                                <th className="px-4 py-3 text-left hidden sm:table-cell">Cidade</th>
                                                <th className="px-4 py-3 text-center">Dias Inativo</th>
                                                <th className="px-4 py-3 text-right hidden md:table-cell">Total Gasto</th>
                                                <th className="px-4 py-3 text-center hidden md:table-cell">Pedidos</th>
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
                                                    <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{client.cidade}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs ${(alertColors[client.alertLevel] || alertColors.verde)}`}>
                                                            {client.diasInativo ? `${client.diasInativo} dias` : 'Nunca comprou'}
                                                        </span>
                                                        {client.motivo && (
                                                            <div className="text-[10px] text-gray-500 mt-1 max-w-[150px] mx-auto leading-tight italic">
                                                                {client.motivo}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-white hidden md:table-cell">
                                                        R$ {(client.totalGasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-300 hidden md:table-cell">{client.totalPedidos}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <a
                                                                href={`https://wa.me/55${(client.celular || client.telefone)?.replace(/\D/g, '')}?text=${encodeURIComponent(client.messageSuggestion || '')}`}
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
                                            const messageText = opp.messageSuggestion || `Olá ${opp.clienteNome}, vi uma oportunidade para você: ${opp.description}`;
                                            const whatsappLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(messageText)}` : '#';

                                            return (
                                                <div key={idx} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg">
                                                                {opp.type === 'upgrade' ? '⬆️' : opp.type === 'crossSell' ? '🛒' : opp.type === 'seasonal' ? '📅' : '🔄'}
                                                            </span>
                                                            <p className="font-medium text-white">{opp.clienteNome}</p>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded-full text-xs border ${(priorityColors[opp.priority] || priorityColors.baixa)}`}>
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
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${(priorityColors[insight.priority] || priorityColors.baixa)}`}>
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

                        {/* Campaigns Tab */}
                        {activeTab === 'campaigns' && (
                            <div className="space-y-6">
                                {/* Sub-Tab Navigation */}
                                <div className="flex gap-2 flex-wrap">
                                    {campaignSubTabs.map(st => (
                                        <button
                                            key={st.id}
                                            onClick={() => setCampaignMode(st.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${campaignMode === st.id
                                                ? 'bg-white/10 border border-white/20 text-white shadow-lg'
                                                : 'bg-white/5 border border-transparent text-gray-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <st.icon className={`w-4 h-4 ${campaignMode === st.id ? st.color : ''}`} />
                                            {st.label}
                                        </button>
                                    ))}
                                </div>

                                {/* ===== SUB-TAB: LANÇAMENTO ===== */}
                                {campaignMode === 'lancamento' && (
                                    <>
                                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                                <Target className="w-5 h-5 text-blue-400" />
                                                Selecione o Produto Foco
                                            </h3>
                                            <select
                                                value={selectedProduct}
                                                onChange={(e) => handleGenerateScripts(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            >
                                                <option value="" className="text-black">Selecione um produto...</option>
                                                {products.sort((a, b) => a.nome.localeCompare(b.nome)).map(product => {
                                                    const fabricaNome = product.fabricaNome || fabricas.find(f => f.id === product.fabricaId)?.nome || 'N/A';
                                                    return (
                                                        <option key={product.id} value={product.id} className="text-black">
                                                            {product.nome} - {fabricaNome}
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                        </div>

                                        {generatedScripts && (
                                            <>
                                                <div className="grid gap-4 md:grid-cols-3">
                                                    {([{
                                                        key: 'launch' as const, label: 'Lançamento (Ativos)', icon: Zap,
                                                        activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/5',
                                                        gradient: 'bg-gradient-to-r from-blue-600/20 to-blue-900/20',
                                                        textColor: 'text-blue-400'
                                                    }, {
                                                        key: 'reactivation' as const, label: 'Reativação (Inativos)', icon: RefreshCw,
                                                        activeClass: 'border-orange-500 ring-1 ring-orange-500 bg-orange-500/5',
                                                        gradient: 'bg-gradient-to-r from-orange-600/20 to-orange-900/20',
                                                        textColor: 'text-orange-400'
                                                    }, {
                                                        key: 'prospecting' as const, label: 'Prospecção (Novos)', icon: Megaphone,
                                                        activeClass: 'border-green-500 ring-1 ring-green-500 bg-green-500/5',
                                                        gradient: 'bg-gradient-to-r from-green-600/20 to-green-900/20',
                                                        textColor: 'text-green-400'
                                                    }] as const).map(card => (
                                                        <div
                                                            key={card.key}
                                                            onClick={() => { setSelectedScriptType(card.key); setActiveMessage(generatedScripts[card.key]); }}
                                                            className={`bg-white/5 rounded-xl border overflow-hidden flex flex-col cursor-pointer transition-all ${selectedScriptType === card.key ? card.activeClass : 'border-white/10 hover:border-white/20'}`}
                                                        >
                                                            <div className={`p-4 ${card.gradient} border-b border-white/10 flex justify-between items-center`}>
                                                                <h4 className={`font-semibold ${card.textColor} flex items-center gap-2`}>
                                                                    <card.icon className="w-4 h-4" />
                                                                    {card.label}
                                                                </h4>
                                                                {selectedScriptType === card.key && <CheckCircle2 className={`w-5 h-5 ${card.textColor}`} />}
                                                            </div>
                                                            <div className="p-4 flex-1">
                                                                <textarea
                                                                    readOnly
                                                                    className="w-full h-40 bg-black/20 text-gray-300 text-sm p-3 rounded-lg border border-white/5 resize-none focus:outline-none"
                                                                    value={generatedScripts[card.key]}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* ===== SUB-TAB: APRESENTAÇÃO DA EMPRESA ===== */}
                                {campaignMode === 'empresa' && (
                                    <>
                                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                                    <Building2 className="w-5 h-5 text-amber-400" />
                                                    Apresentação da Empresa
                                                </h3>
                                                <button
                                                    onClick={generateCompanyMessages}
                                                    className="px-4 py-2 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors text-sm font-medium flex items-center gap-2"
                                                >
                                                    <Briefcase className="w-4 h-4" />
                                                    Gerar Mensagens
                                                </button>
                                            </div>
                                            <p className="text-gray-400 text-sm">Gere mensagens profissionais para apresentar a Fantini Representações. As marcas representadas são carregadas automaticamente do sistema.</p>
                                        </div>

                                        {companyMessages && (
                                            <div className="grid gap-4 md:grid-cols-3">
                                                {([{
                                                    key: 'formal' as const, label: 'Formal', desc: 'Ideal para contatos corporativos',
                                                    activeClass: 'border-amber-500 ring-1 ring-amber-500 bg-amber-500/5',
                                                    gradient: 'bg-gradient-to-r from-amber-600/20 to-amber-900/20',
                                                    textColor: 'text-amber-400',
                                                    btnClass: 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                                                }, {
                                                    key: 'casual' as const, label: 'Casual', desc: 'Tom amigável para WhatsApp',
                                                    activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/5',
                                                    gradient: 'bg-gradient-to-r from-emerald-600/20 to-emerald-900/20',
                                                    textColor: 'text-emerald-400',
                                                    btnClass: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                                }, {
                                                    key: 'pitch' as const, label: 'Pitch Rápido', desc: 'Curto e direto ao ponto',
                                                    activeClass: 'border-violet-500 ring-1 ring-violet-500 bg-violet-500/5',
                                                    gradient: 'bg-gradient-to-r from-violet-600/20 to-violet-900/20',
                                                    textColor: 'text-violet-400',
                                                    btnClass: 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30'
                                                }] as const).map(card => (
                                                    <div
                                                        key={card.key}
                                                        onClick={() => setActiveMessage(companyMessages[card.key])}
                                                        className={`bg-white/5 rounded-xl border overflow-hidden flex flex-col cursor-pointer transition-all ${activeMessage === companyMessages[card.key] ? card.activeClass : 'border-white/10 hover:border-white/20'}`}
                                                    >
                                                        <div className={`p-4 ${card.gradient} border-b border-white/10 flex justify-between items-center`}>
                                                            <div>
                                                                <h4 className={`font-semibold ${card.textColor}`}>{card.label}</h4>
                                                                <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
                                                            </div>
                                                            {activeMessage === companyMessages[card.key] && <CheckCircle2 className={`w-5 h-5 ${card.textColor}`} />}
                                                        </div>
                                                        <div className="p-4 flex-1">
                                                            <textarea
                                                                readOnly
                                                                className="w-full h-48 bg-black/20 text-gray-300 text-sm p-3 rounded-lg border border-white/5 resize-none focus:outline-none"
                                                                value={companyMessages[card.key]}
                                                            />
                                                        </div>
                                                        <div className="p-3 border-t border-white/10 bg-black/20">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(companyMessages[card.key]); }}
                                                                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg ${card.btnClass} transition-colors text-sm font-medium`}
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                                Copiar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ===== SUB-TAB: VITRINE DE PRODUTOS ===== */}
                                {campaignMode === 'vitrine' && (
                                    <>
                                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                                    <ShoppingBag className="w-5 h-5 text-pink-400" />
                                                    Vitrine de Produtos
                                                </h3>
                                                <button
                                                    onClick={generateShowcaseMessage}
                                                    disabled={selectedShowcaseProducts.length === 0}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${selectedShowcaseProducts.length > 0 ? 'bg-pink-600/20 text-pink-400 hover:bg-pink-600/30' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                                                >
                                                    <Megaphone className="w-4 h-4" />
                                                    Gerar Mensagem ({selectedShowcaseProducts.length})
                                                </button>
                                            </div>
                                            <p className="text-gray-400 text-sm mb-4">Selecione os produtos que deseja apresentar e gere uma mensagem de vitrine personalizada.</p>

                                            <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                                                {products.sort((a, b) => a.nome.localeCompare(b.nome)).map(product => {
                                                    const fabricaNome = product.fabricaNome || fabricas.find(f => f.id === product.fabricaId)?.nome || '';
                                                    const isSelected = selectedShowcaseProducts.includes(product.id);
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => toggleShowcaseProduct(product.id)}
                                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                                                ? 'bg-pink-500/10 border border-pink-500/30'
                                                                : 'bg-white/5 border border-transparent hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-gray-600'}`}>
                                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-white text-sm truncate">{product.nome}</p>
                                                                {fabricaNome && <p className="text-xs text-gray-500">{fabricaNome}</p>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {showcaseMessage && (
                                            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-lg font-medium text-white">Mensagem Gerada</h3>
                                                    <button
                                                        onClick={() => copyToClipboard(showcaseMessage)}
                                                        className="px-3 py-1.5 rounded-lg bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 transition-colors text-sm font-medium flex items-center gap-2"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                        Copiar
                                                    </button>
                                                </div>
                                                <textarea
                                                    readOnly
                                                    className="w-full h-48 bg-black/20 text-gray-300 text-sm p-4 rounded-lg border border-white/5 resize-none focus:outline-none"
                                                    value={showcaseMessage}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* === Shared Client Send Section === */}
                                {activeMessage && (
                                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                                        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                            <Send className="w-5 h-5 text-green-400" />
                                            Enviar para Clientes
                                        </h3>

                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente para enviar..."
                                                value={clientSearch}
                                                onChange={(e) => setClientSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                                            />
                                        </div>

                                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white/5 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Cliente</th>
                                                        <th className="px-4 py-2 text-left text-gray-400 font-medium hidden sm:table-cell">Comprador</th>
                                                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Ação</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredClients.map(client => {
                                                        const greetingName = client.comprador?.split(' ')[0] || client.nomeFantasia;
                                                        const message = getMessageForClient(greetingName);
                                                        const whatsappLink = `https://wa.me/55${(client.celular || client.telefone)?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                                                        return (
                                                            <tr key={client.id} className="hover:bg-white/5">
                                                                <td className="px-4 py-2 text-white">{client.nomeFantasia}</td>
                                                                <td className="px-4 py-2 text-gray-400 hidden sm:table-cell">{client.comprador || '-'}</td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <a
                                                                        href={whatsappLink}
                                                                        target="_blank"
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors font-medium text-xs"
                                                                    >
                                                                        <MessageCircle className="w-3 h-3" />
                                                                        Enviar WhatsApp
                                                                    </a>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
                {/* ... existing content inside the relative div ... */}
            </div>

            {/* Modal Overlay - Moved outside to prevent positioning issues */}
            {activeInsight && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        {analyzing ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Lightbulb className="w-6 h-6 text-purple-400 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold text-white">FRP AI analisando...</h3>
                                <p className="text-sm text-gray-400">Processando histórico de compras e comportamento do cliente.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gradient-to-r from-purple-500/10 to-blue-500/10 sticky top-0 bg-[#1a1a1a] z-10">
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
        </div>
    );
}
