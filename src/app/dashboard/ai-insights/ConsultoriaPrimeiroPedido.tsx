'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData, Fabrica, Product } from '@/contexts/DataContext';
import { gerarPdfConsultoria, PayloadConsultoria } from '@/lib/gerarPdfConsultoria';
import { calcularGiroConsultoria, CurvaAResult, ConsultoriaResponse } from '@/app/actions/consultoriaPrimeiroPedido';
import {
    ShoppingCart,
    Factory,
    Tag,
    Percent,
    Gift,
    Calculator,
    TrendingUp,
    Package,
    DollarSign,
    Sparkles,
    ChevronRight,
    Box as BoxIcon,
    Award,
    BarChart3,
    Loader2,
    AlertTriangle,
    Crown,
    Zap,
    CheckCircle2,
    Info,
    Download,
    CalendarDays,
} from 'lucide-react';

// === Tabela de preço labels ===
const TABELAS_PRECO = [
    { value: '50a199', label: 'Varejo Pequeno (50 a 199)' },
    { value: '200a699', label: 'Varejo Médio (200 a 699)' },
    { value: 'atacado', label: 'Atacado' },
    { value: 'avista', label: 'Atacado à Vista' },
    { value: 'redes', label: 'Redes' },
];

function getPrecoByTabela(product: CurvaAResult | Product, tabela: string): number {
    switch (tabela) {
        case '200a699': return Number(product.preco200a699) || 0;
        case 'atacado': return Number(product.precoAtacado) || 0;
        case 'avista': return Number(product.precoAtacadoAVista) || 0;
        case 'redes': return Number(product.precoRedes) || 0;
        case '50a199':
        default: return Number(product.preco50a199) || 0;
    }
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// === Image helper para PDF ===
async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        let finalUrl = url;
        if (url.startsWith('/')) {
            finalUrl = window.location.origin + url;
        }
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = finalUrl;
    });
}

export default function ConsultoriaPrimeiroPedido() {
    const { fabricas, products } = useData();

    // --- State ---
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [selectedTabela, setSelectedTabela] = useState('');
    const [selectedProdutoIscaId, setSelectedProdutoIscaId] = useState('');
    const [percentagemBonus, setPercentagemBonus] = useState<number>(5);
    const [caixasPorPallet, setCaixasPorPallet] = useState<number>(60);
    const [quantidades, setQuantidades] = useState<Record<string, number>>({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [aplicarEstrategia, setAplicarEstrategia] = useState(true);

    // Curva A from API
    const [curvaA, setCurvaA] = useState<CurvaAResult[]>([]);
    const [curvaALoading, setCurvaALoading] = useState(false);
    const [curvaAFonte, setCurvaAFonte] = useState<'historico' | 'fallback_empty' | ''>('');
    const [curvaAAlerta, setCurvaAAlerta] = useState<string | null>(null);
    const [diasHistoricoTotal, setDiasHistoricoTotal] = useState<number>(0);

    // Produtos da fábrica para o select de Produto Isca
    const produtosDaFabrica = useMemo(() => {
        if (!selectedFabricaId) return [];
        return products.filter(
            (p: Product) => p.fabricaId === selectedFabricaId && p.ativo !== false
        );
    }, [products, selectedFabricaId]);

    const produtoIsca = useMemo(() => {
        if (!selectedProdutoIscaId) return null;
        return products.find((p: Product) => p.id === selectedProdutoIscaId) || null;
    }, [products, selectedProdutoIscaId]);

    const fabricaSelecionada = useMemo(() => {
        return fabricas.find((f: Fabrica) => f.id === selectedFabricaId) || null;
    }, [fabricas, selectedFabricaId]);

    // Fetch Curva A via Server Action ISOLADA (não usa /api/inteligencia/curva-a)
    const fetchCurvaA = useCallback(async (fabricaId: string, tabelaPreco: string, fallbackPallet: number = 60) => {
        if (!fabricaId || !tabelaPreco) return;
        setCurvaALoading(true);
        setCurvaAAlerta(null);
        setCurvaA([]);
        setCurvaAFonte('');
        setDiasHistoricoTotal(0);
        try {
            const data = await calcularGiroConsultoria(fabricaId, tabelaPreco);
            
            setCurvaA(data.curvaA || []);
            setCurvaAFonte(data.fonte || '');
            if (data.alerta) setCurvaAAlerta(data.alerta);
            if (data.diasHistoricoTotal) setDiasHistoricoTotal(data.diasHistoricoTotal);
            
            if (data.curvaA && data.curvaA.length > 0) {
                const initQtds: Record<string, number> = {};
                // Determine se é atacado para usar logistica de pallet
                const isAtacado = tabelaPreco === 'atacado' || tabelaPreco === 'redes';
                const multiplicadores = [2, 2, 1, 1, 1];

                data.curvaA.forEach((p: CurvaAResult, idx: number) => {
                    if (isAtacado) {
                        const m = multiplicadores[idx] || 1;
                        initQtds[p.produtoId] = fallbackPallet * m;
                    } else {
                        const giro = p.giroDiarioCliente || 0.1;
                        initQtds[p.produtoId] = Math.max(1, Math.ceil(giro * 15));
                    }
                });
                setQuantidades(initQtds);
            }

        } catch (err: unknown) {
            if (err instanceof Error) {
                setCurvaAAlerta(err.message || 'Erro desconhecido');
            } else {
                setCurvaAAlerta('Erro desconhecido');
            }
        } finally {
            setCurvaALoading(false);
        }
    }, []);

    // Quando fábrica muda: limpa dados e aguarda a tabela estar setada
    const handleFabricaChange = (fabricaId: string) => {
        setSelectedFabricaId(fabricaId);
        setSelectedProdutoIscaId('');
        setQuantidades({});
        setCurvaA([]);
        if (fabricaId && selectedTabela) {
            fetchCurvaA(fabricaId, selectedTabela, caixasPorPallet);
        }
    };

    // Quando tabela muda: aciona a busca para trazer a Curva A EXATA deste perfil
    const handleTabelaChange = (tabelaId: string) => {
        setSelectedTabela(tabelaId);
        setQuantidades({});
        setCurvaA([]);
        if (selectedFabricaId && tabelaId) {
            fetchCurvaA(selectedFabricaId, tabelaId, caixasPorPallet);
        }
    }

    // Efeito para recalcular as inicializações se mudar o CaixasPorPallet e a Tabela já for atacado.
    useEffect(() => {
        if (curvaA.length > 0 && (selectedTabela === 'atacado' || selectedTabela === 'redes')) {
            const initQtds: Record<string, number> = {};
            const multiplicadores = [2, 2, 1, 1, 1];
            curvaA.forEach((p, idx) => {
                const m = multiplicadores[idx] || 1;
                initQtds[p.produtoId] = caixasPorPallet * m;
            });
            setQuantidades(initQtds);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caixasPorPallet, selectedTabela]);

    const handleQtdChange = (produtoId: string, qtd: number) => {
        setQuantidades(prev => ({ ...prev, [produtoId]: Math.max(0, qtd) }));
    };

    // === MOTOR DE CÁLCULO PREDITIVO ===
    const calculo = useMemo(() => {
        if (!selectedTabela || curvaA.length === 0) return null;

        const itens = curvaA.map((p) => {
            const preco = getPrecoByTabela(p, selectedTabela);
            const qtd = quantidades[p.produtoId] || 0; // Se apagar o input, fica 0
            
            // Dias de Cobertura Reais (Qtd / Giro)
            const giroD = p.giroDiarioCliente || 0;
            const coberturaDias = (giroD > 0 && qtd > 0) ? Math.round(qtd / giroD) : 0;

            return {
                id: p.produtoId,
                nome: p.nome,
                codigo: p.codigo,
                unidade: p.unidade || 'CX',
                precoUnitario: preco,
                quantidade: qtd,
                subtotal: preco * qtd,
                totalQtdVendida: p.totalQtdVendida,
                giroDiarioCliente: giroD,
                coberturaDias: coberturaDias,
                isBonificacao: false,
            };
        }).filter(item => item.quantidade > 0); // No final filtramos o que ta zerado

        const totalPedido = itens.reduce((acc, item) => acc + item.subtotal, 0);
        const verbaGerada = aplicarEstrategia ? (totalPedido * (percentagemBonus / 100)) : 0;

        let caixasIsca = 0;
        let precoCaixaIsca = 0;
        let nomeIsca = '';
        let codigoIsca = '';
        let unidadeIsca = 'CX';
        if (aplicarEstrategia && produtoIsca && selectedTabela) {
            precoCaixaIsca = getPrecoByTabela(produtoIsca, selectedTabela);
            nomeIsca = produtoIsca.nome;
            codigoIsca = produtoIsca.codigo || '';
            unidadeIsca = produtoIsca.unidade || 'CX';
            if (precoCaixaIsca > 0) {
                caixasIsca = Math.floor(verbaGerada / precoCaixaIsca);
            }
        }

        const valorBonificacaoReal = caixasIsca * precoCaixaIsca;

        // Item bonificado
        const itemBonificado = caixasIsca > 0 ? {
            id: selectedProdutoIscaId,
            nome: `[BONIFICAÇÃO] ${nomeIsca}`,
            codigo: codigoIsca,
            unidade: unidadeIsca,
            precoUnitario: 0,
            quantidade: caixasIsca,
            subtotal: 0,
            totalQtdVendida: 0,
            giroDiarioCliente: 0,
            coberturaDias: 0,
            isBonificacao: true,
        } : null;

        return {
            itens,
            itemBonificado,
            totalPedido,
            verbaGerada,
            caixasIsca,
            precoCaixaIsca,
            nomeIsca,
            codigoIsca,
            unidadeIsca,
            valorBonificacaoReal,
        };
    }, [curvaA, selectedTabela, percentagemBonus, produtoIsca, quantidades, selectedProdutoIscaId, aplicarEstrategia]);

    const isReady = selectedFabricaId && selectedTabela && curvaA.length > 0 && (!aplicarEstrategia || selectedProdutoIscaId !== '');
    const tabelaDisplay: Record<string, string> = { '50a199': '50 a 199', '200a699': '200 a 699', 'atacado': 'Atacado', 'avista': 'À Vista', 'redes': 'Redes' };

    // === PDF EXPORT ===
    const generatePDF = async () => {
        if (!calculo || !fabricaSelecionada) return;
        setIsGeneratingPDF(true);

        try {
            const payload: PayloadConsultoria = {
                fabrica: fabricaSelecionada.nome,
                perfil: tabelaDisplay[selectedTabela] || selectedTabela,
                bonusPorcentagem: aplicarEstrategia ? percentagemBonus : 0,
                data: new Date().toLocaleDateString('pt-BR'),
                itensPagos: calculo.itens,
                itemBonificado: aplicarEstrategia ? calculo.itemBonificado : null,
                totalPedido: calculo.totalPedido,
                verbaGerada: aplicarEstrategia ? calculo.verbaGerada : 0,
                lucroImediato: aplicarEstrategia ? calculo.valorBonificacaoReal : 0
            };

            await gerarPdfConsultoria(payload);
        } catch (error) {
            console.error('Erro ao gerar', error);
            alert('Falha ao gerar o PDF da Consultoria.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-6 rounded-xl border border-emerald-500/20">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                        <ShoppingCart className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            Consultoria de 1º Pedido
                            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                MODO PREDITIVO
                            </span>
                        </h3>
                        <p className="text-sm text-gray-400 mt-1 max-w-xl">
                            Simule o mix ideal baseado <strong className="text-white">exclusivamente no histórico de 180 dias</strong>. A Curva A cruza dados para o perfil selecionado indicando a cobertura exata (dias de estoque) para giro fluido. Mínimo recomendado: 15 dias de cobertura.
                        </p>
                    </div>
                </div>
            </div>

            {/* === CONTROLES === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Painel 1: Contexto do Pedido */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-5">
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Factory className="w-4 h-4 text-blue-400" />
                        1. Inteligência Alvo
                    </h4>

                    {/* Tabela de Preço PRIMEIRO, já que impacta os produtos reais */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Perfil do Cliente (Tabela de Preço)</label>
                        <select
                            value={selectedTabela}
                            onChange={(e) => handleTabelaChange(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        >
                            <option value="" className="text-black">Selecione o Perfil...</option>
                            {TABELAS_PRECO.map(t => (
                                <option key={t.value} value={t.value} className="text-black">{t.label}</option>
                            ))}
                        </select>
                        {selectedTabela && (
                            <p className="mt-1.5 text-[10px] text-emerald-400/80">Histórico de vendas focado 100% neste perfil selecionado.</p>
                        )}
                    </div>

                    {/* Caixas por Pallet */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                            Caixas por Pallet (Arredondamento Logístico)
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={caixasPorPallet}
                            onChange={(e) => setCaixasPorPallet(Math.max(1, Number(e.target.value)))}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors text-sm font-bold"
                        />
                        <p className="text-[10px] text-gray-600 mt-1">Usado para atacado/redes — sugere múltiplos exatos deste valor.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Fábrica / Representada</label>
                        <select
                            value={selectedFabricaId}
                            onChange={(e) => handleFabricaChange(e.target.value)}
                            disabled={!selectedTabela}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm disabled:opacity-50"
                        >
                            <option value="" className="text-black">Selecione a Fábrica...</option>
                            {fabricas.map((f: Fabrica) => (
                                <option key={f.id} value={f.id} className="text-black">{f.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Painel 2: Bonificação */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                            <Gift className="w-4 h-4 text-pink-400" />
                            2. Estratégia de Bonificação
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={aplicarEstrategia}
                                onChange={(e) => setAplicarEstrategia(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-white/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                        </label>
                    </div>

                    {aplicarEstrategia && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Produto Isca (Bonificação)</label>
                                <select
                                    value={selectedProdutoIscaId}
                                    onChange={(e) => setSelectedProdutoIscaId(e.target.value)}
                                    disabled={!selectedFabricaId}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors text-sm disabled:opacity-50"
                                >
                                    <option value="" className="text-black">Selecione o Produto Isca...</option>
                                    {produtosDaFabrica.map((p: Product) => (
                                        <option key={p.id} value={p.id} className="text-black">
                                            {p.nome} ({p.codigo})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Percentagem de Bonificação (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={percentagemBonus}
                                        onChange={(e) => setPercentagemBonus(Number(e.target.value))}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm font-bold"
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ALERTAS DA API */}
            {curvaALoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    <span className="text-sm text-gray-400 font-bold">Inquirindo Inteligência Preditiva (180 dias de histórico)...</span>
                </div>
            )}

            {curvaAAlerta && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-300 font-semibold">{curvaAAlerta}</p>
                </div>
            )}

            {/* === TABELA DA VERDADE PREDITIVA === */}
            {!curvaALoading && curvaA.length > 0 && selectedTabela && (
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-400" />
                            Curva A Predita — Mix Calculado
                        </h4>
                        <div className="flex items-center gap-2">
                            {curvaAFonte === 'historico' && (
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> HISTÓRICO REAL {diasHistoricoTotal > 0 ? `${diasHistoricoTotal}D` : 'COMPLETO'} (MÉDIA POR CLIENTE)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10">
                                <tr>
                                    <th className="px-3 py-3 text-left w-8">#</th>
                                    <th className="px-3 py-3 text-left">Produto</th>
                                    <th className="px-3 py-3 text-center">Giro Diário<br/><span className="text-[9px] font-normal text-gray-500">(1 cliente)</span></th>
                                    <th className="px-3 py-3 text-center w-28">Sugestão (CX)</th>
                                    <th className="px-3 py-3 text-center">Cobertura Real</th>
                                    <th className="px-3 py-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {calculo?.itens.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-3 py-3">
                                            {index < 3 ? (
                                                <Crown className={`w-4 h-4 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-amber-600'}`} />
                                            ) : (
                                                <span className="text-xs text-gray-500 font-mono">{index + 1}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <div>
                                                    <span className="text-white font-medium">{item.nome}</span>
                                                    <span className="block text-xs font-mono text-gray-500">Cód: {item.codigo} | {formatBRL(item.precoUnitario)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Giro Diário Cliente */}
                                        <td className="px-3 py-3 text-center font-mono">
                                            {item.giroDiarioCliente > 0 ? (
                                                <span className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded">
                                                    {item.giroDiarioCliente.toFixed(2)} cx/dia
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-600">S/ Histórico</span>
                                            )}
                                        </td>

                                        {/* Input de Sugestão */}
                                        <td className="px-3 py-3 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                value={quantidades[item.id] !== undefined ? quantidades[item.id] : 0}
                                                onChange={(e) => handleQtdChange(item.id, parseInt(e.target.value) || 0)}
                                                className="w-16 bg-black/40 border border-emerald-500/30 rounded text-center text-sm py-1.5 text-white font-bold focus:outline-none focus:border-emerald-400 transition-colors"
                                            />
                                        </td>

                                        {/* Coluna Preditiva de Cobertura */}
                                        <td className="px-3 py-3 text-center">
                                            {item.giroDiarioCliente > 0 ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${item.coberturaDias >= 15 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                        <CalendarDays className="w-3 h-3" />
                                                        {item.coberturaDias} Dias
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-amber-500">Imprevisível</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-3 text-right font-semibold text-white">{formatBRL(item.subtotal)}</td>
                                    </tr>
                                ))}

                                {/* ITEM BONIFICADO (ISCA) */}
                                {isReady && calculo && calculo.itemBonificado && (
                                    <tr className="bg-emerald-500/5 border-t border-emerald-500/30">
                                        <td className="px-3 py-3"><Gift className="w-4 h-4 text-emerald-400" /></td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-300 font-bold">{calculo.nomeIsca}</span>
                                                <span className="text-[10px] uppercase font-mono text-emerald-400">Bonificação (Custo Zero)</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">—</td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-16 py-1 bg-emerald-500/20 rounded text-sm text-emerald-400 font-bold">
                                                +{calculo.caixasIsca}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center"><span className="text-xs font-mono text-emerald-400">Verba Inteira</span></td>
                                        <td className="px-3 py-3 text-right font-bold text-emerald-400">R$ 0,00</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === RESUMO INVESTIMENTO - TELA DO VENDEDOR === */}
            {isReady && calculo && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 animate-in slide-in-from-bottom-4 duration-500 mt-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-teal-600/5 to-cyan-600/10" />
                    
                    <div className="relative p-6 space-y-5">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                                <Award className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Resumo do Investimento</h3>
                                <p className="text-xs text-gray-400">Parâmetros dinâmicos para aprovação antes do PDF</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-2">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Total do Pedido Pago</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{formatBRL(calculo.totalPedido)}</p>
                            </div>

                            {aplicarEstrategia && (
                                <div className="bg-black/20 border border-emerald-500/10 rounded-xl p-5 space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase tracking-wider">Verba Gerada ({percentagemBonus}%)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-emerald-400">{formatBRL(calculo.verbaGerada)}</p>
                                </div>
                            )}
                        </div>

                        {/* Highlight de Custo Zero (Condicional) */}
                        {aplicarEstrategia && (
                            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-6 shadow-inner">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-emerald-100 uppercase tracking-wide">Conversão Física em Mercadoria</p>
                                        <p className="text-xl sm:text-2xl font-black text-emerald-400">
                                            {calculo.caixasIsca} Caixas de {calculo.nomeIsca.replace('[BONIFICAÇÃO] ', '')} <span className="text-white">(Custo Zero)</span>
                                        </p>
                                    </div>
                                    <div className="bg-emerald-950/50 border border-emerald-500/20 px-4 py-2 rounded-lg text-center">
                                        <p className="text-[10px] text-emerald-300 uppercase">Preço Ref. Isca</p>
                                        <p className="text-sm font-mono text-white">{formatBRL(calculo.precoCaixaIsca)} / CX</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-emerald-500/10 gap-3">
                            <button
                                onClick={generatePDF}
                                disabled={isGeneratingPDF || calculo.itens.length === 0}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all disabled:opacity-50"
                            >
                                <Download className="w-5 h-5" />
                                {isGeneratingPDF ? 'Gerando...' : 'Exportar Proposta Comercial (PDF)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
