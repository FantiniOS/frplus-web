'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData, Fabrica, Product, Client } from '@/contexts/DataContext';
import { gerarPdfConsultoria, PayloadConsultoria } from '@/lib/gerarPdfConsultoria';
import { calcularGiroConsultoria, CurvaAResult } from '@/app/actions/consultoriaPrimeiroPedido';
import {
    ShoppingCart, Factory, Percent, Gift, TrendingUp, Package, DollarSign,
    Award, BarChart3, Loader2, AlertTriangle, Crown, CheckCircle2,
    Download, CalendarDays, Users, Store, ShieldAlert, User, Building2, Plus, Trash2
} from 'lucide-react';

const TABELAS_PRECO = [
    { value: '50a199', label: 'Varejo Pequeno (50 a 199)' },
    { value: '200a699', label: 'Varejo Médio (200 a 699)' },
    { value: 'atacado', label: 'Atacado' },
    { value: 'avista', label: 'Atacado à Vista' },
    { value: 'redes', label: 'Redes' },
];

const tabelaDisplay: Record<string, string> = {
    '50a199': '50 a 199', '200a699': '200 a 699',
    'atacado': 'Atacado', 'avista': 'À Vista', 'redes': 'Redes'
};

function getPrecoByTabela(product: CurvaAResult | Product, tabela: string): number {
    switch (tabela) {
        case '200a699': return Number(product.preco200a699) || 0;
        case 'atacado': return Number(product.precoAtacado) || 0;
        case 'avista': return Number(product.precoAtacadoAVista) || 0;
        case 'redes': return Number(product.precoRedes) || 0;
        case '50a199': default: return Number(product.preco50a199) || 0;
    }
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ConsultoriaPrimeiroPedido() {
    const { fabricas, products, clients } = useData();

    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [selectedTabela, setSelectedTabela] = useState('');
    const [selectedProdutoIscaId, setSelectedProdutoIscaId] = useState('');
    const [selectedClienteEspelhoId, setSelectedClienteEspelhoId] = useState('');
    const [nomeClienteNovo, setNomeClienteNovo] = useState('');
    const [nomeComprador, setNomeComprador] = useState('');
    const [numLojasNovo, setNumLojasNovo] = useState<number>(1);
    const [percentagemBonus, setPercentagemBonus] = useState<number>(5);
    const [percentualImposto, setPercentualImposto] = useState<number>(12);
    const [caixasPorPallet, setCaixasPorPallet] = useState<number>(60);
    const [quantidades, setQuantidades] = useState<Record<string, number>>({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [aplicarEstrategia, setAplicarEstrategia] = useState(true);

    const [curvaA, setCurvaA] = useState<CurvaAResult[]>([]);
    const [curvaALoading, setCurvaALoading] = useState(false);
    const [curvaAFonte, setCurvaAFonte] = useState<'historico' | 'fallback_empty' | ''>('');
    const [curvaAAlerta, setCurvaAAlerta] = useState<string | null>(null);
    const [diasHistoricoTotal, setDiasHistoricoTotal] = useState<number>(0);
    const [modoEspelho, setModoEspelho] = useState(false);

    // Injeção Manual
    const [produtosManuais, setProdutosManuais] = useState<CurvaAResult[]>([]);
    const [produtoManualSelecionado, setProdutoManualSelecionado] = useState('');

    // Clientes filtrados pela tabela selecionada
    const clientesFiltrados = useMemo(() => {
        if (!selectedTabela) return [];
        return clients.filter((c: Client) => {
            const ct = (c.tabelaPreco || '').toLowerCase().replace(/\s+/g, '');
            const st = selectedTabela.toLowerCase().replace(/\s+/g, '');
            if (st === 'atacado') return ct === 'atacado';
            if (st === 'avista') return ct.includes('vista');
            if (st === '50a199') return ct.includes('199');
            if (st === '200a699') return ct.includes('200') || ct.includes('699');
            if (st === 'redes') return ct.includes('rede');
            return ct === st;
        });
    }, [clients, selectedTabela]);

    const produtosDaFabrica = useMemo(() => {
        if (!selectedFabricaId) return [];
        return products.filter((p: Product) => p.fabricaId === selectedFabricaId && p.ativo !== false);
    }, [products, selectedFabricaId]);

    const produtoIsca = useMemo(() => {
        if (!selectedProdutoIscaId) return null;
        return products.find((p: Product) => p.id === selectedProdutoIscaId) || null;
    }, [products, selectedProdutoIscaId]);

    const fabricaSelecionada = useMemo(() => {
        return fabricas.find((f: Fabrica) => String(f.id) === String(selectedFabricaId)) || null;
    }, [fabricas, selectedFabricaId]);

    // Fetch Curva A
    const fetchCurvaA = useCallback(async (
        fabricaId: string, tabelaPreco: string, palletSize: number,
        espelhoId?: string, lojas: number = 1
    ) => {
        if (!fabricaId || !tabelaPreco) return;
        setCurvaALoading(true);
        setCurvaAAlerta(null);
        setCurvaA([]);
        setCurvaAFonte('');
        setDiasHistoricoTotal(0);
        setProdutosManuais([]);
        setProdutoManualSelecionado('');
        setModoEspelho(false);
        try {
            const data = await calcularGiroConsultoria(fabricaId, tabelaPreco, espelhoId || undefined, lojas);
            setCurvaA(data.curvaA || []);
            setCurvaAFonte(data.fonte || '');
            if (data.alerta) setCurvaAAlerta(data.alerta);
            if (data.diasHistoricoTotal) setDiasHistoricoTotal(data.diasHistoricoTotal);
            if (data.modoEspelho) setModoEspelho(true);

            if (data.curvaA && data.curvaA.length > 0) {
                const initQtds: Record<string, number> = {};
                data.curvaA.forEach((p: CurvaAResult) => {
                    initQtds[p.produtoId] = p.sugestaoCaixas !== undefined ? p.sugestaoCaixas : 0;
                });
                setQuantidades(initQtds);
            }
        } catch (err: unknown) {
            setCurvaAAlerta(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setCurvaALoading(false);
        }
    }, []);

    const handleFabricaChange = (fabricaId: string) => {
        setSelectedFabricaId(fabricaId);
        setSelectedProdutoIscaId('');
        setQuantidades({});
        setCurvaA([]);
        if (fabricaId && selectedTabela) {
            fetchCurvaA(fabricaId, selectedTabela, caixasPorPallet, selectedClienteEspelhoId || undefined, numLojasNovo);
        }
    };

    const handleTabelaChange = (tabelaId: string) => {
        setSelectedTabela(tabelaId);
        setSelectedClienteEspelhoId('');
        setQuantidades({});
        setCurvaA([]);
        if (selectedFabricaId && tabelaId) {
            fetchCurvaA(selectedFabricaId, tabelaId, caixasPorPallet, undefined, numLojasNovo);
        }
    };

    const handleEspelhoChange = (clienteId: string) => {
        setSelectedClienteEspelhoId(clienteId);
        if (selectedFabricaId && selectedTabela) {
            fetchCurvaA(selectedFabricaId, selectedTabela, caixasPorPallet, clienteId || undefined, numLojasNovo);
        }
    };

    // Recalcular sugestões locais para reatividade instantânea
    useEffect(() => {
        if (curvaA.length > 0) {
            const isAtacado = selectedTabela === 'atacado' || selectedTabela === 'redes' || selectedTabela === 'avista';
            const initQtds: Record<string, number> = {};
            curvaA.forEach((p) => {
                let multiplicadorEscalado = numLojasNovo;
                if (numLojasNovo > 10 && numLojasNovo <= 50) multiplicadorEscalado = 10 + ((numLojasNovo - 10) * 0.6);
                else if (numLojasNovo > 50) multiplicadorEscalado = 34 + ((numLojasNovo - 50) * 0.3);

                let sugestaoBase = (p.ticketMedioCaixas || 1) * multiplicadorEscalado;

                const tetoLogistico = Math.max(1, caixasPorPallet) * 4;
                if (sugestaoBase > tetoLogistico) {
                    sugestaoBase = tetoLogistico;
                }

                const giroProjetado = (p.giroDiarioCliente || 0) * multiplicadorEscalado;
                const tetoCobertura = giroProjetado * 40;
                if (giroProjetado > 0 && sugestaoBase > tetoCobertura) {
                    sugestaoBase = Math.max(giroProjetado * 20, tetoCobertura);
                }

                let sugestaoFinal = Math.max(1, Math.round(sugestaoBase));
                if (isAtacado && caixasPorPallet > 0 && sugestaoFinal >= caixasPorPallet / 2) {
                    sugestaoFinal = Math.max(caixasPorPallet, Math.round(sugestaoFinal / caixasPorPallet) * caixasPorPallet);
                }
                initQtds[p.produtoId] = sugestaoFinal;
            });
            setQuantidades(initQtds);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numLojasNovo, caixasPorPallet, selectedTabela]);

    const handleQtdChange = (produtoId: string, qtd: number) => {
        setQuantidades(prev => ({ ...prev, [produtoId]: Math.max(0, qtd) }));
    };

    // === CLASSIFICAÇÃO DE MARGEM POR CATEGORIA ===
    const getMargemByCategoria = useCallback((nome: string, categoria: string): number => {
        const nomeLower = (nome || '').toLowerCase();
        const catLower = (categoria || '').toLowerCase();
        // Álcool / Gel = Curva A (alto giro, margem apertada)
        if (nomeLower.includes('álcool') || nomeLower.includes('alcool') || nomeLower.includes('alcohol') ||
            nomeLower.includes('gel') || catLower.includes('álcool') || catLower.includes('alcool') ||
            catLower.includes('gel')) {
            return 10;
        }
        // Compostos / Limão / Premium = Curva B/C (rentabilidade)
        return 15;
    }, []);

    const handleAddProdutoManual = () => {
        if (!produtoManualSelecionado) return;
        const p = products.find((x: Product) => x.id === produtoManualSelecionado);
        if (p) {
            const newP: CurvaAResult = {
                produtoId: p.id,
                nome: p.nome,
                codigo: p.codigo || '',
                unidade: p.unidade || 'CX',
                categoria: (p as any).categoria || 'Geral',
                ativo: p.ativo !== false,
                preco50a199: Number(p.preco50a199) || 0,
                preco200a699: Number(p.preco200a699) || 0,
                precoAtacado: Number(p.precoAtacado) || 0,
                precoAtacadoAVista: Number(p.precoAtacadoAVista) || 0,
                precoRedes: Number(p.precoRedes) || 0,
                totalQtdVendida: 0,
                totalFaturado: 0,
                clientesUnicos: 0,
                giroDiarioCliente: 0,
                ticketMedioCaixas: 0,
                sugestaoCaixas: 1,
                isLimitadoTeto: false,
                precoSugeridoVenda: Number(p.preco50a199) * 1.4,
                diasHistorico: 0,
                isManual: true,
            };
            setProdutosManuais(prev => [...prev, newP]);
            setQuantidades(prev => ({ ...prev, [p.id]: 1 }));
            setProdutoManualSelecionado('');
        }
    };

    const handleRemoveProdutoManual = (produtoId: string) => {
        setProdutosManuais(prev => prev.filter(p => p.produtoId !== produtoId));
        setQuantidades(prev => {
            const newQtds = { ...prev };
            delete newQtds[produtoId];
            return newQtds;
        });
    };

    const combinedProdutos = useMemo(() => {
        return [...curvaA, ...produtosManuais];
    }, [curvaA, produtosManuais]);

    // === MOTOR DE CÁLCULO B2B ===
    const calculo = useMemo(() => {
        if (!selectedTabela || combinedProdutos.length === 0) return null;

        const fatorImposto = 1 + (percentualImposto / 100);

        const itens = combinedProdutos.map((p) => {
            const custoNF = getPrecoByTabela(p, selectedTabela);
            const custoReal = custoNF * fatorImposto;
            const qtd = quantidades[p.produtoId] || 0;
            const giroD = p.giroDiarioCliente || 0;
            const coberturaDias = (giroD > 0 && qtd > 0) ? Math.round(qtd / giroD) : 0;
            const isLimitado = p.isLimitadoTeto || false;

            // Margem segmentada por categoria
            const margemPercent = getMargemByCategoria(p.nome, p.categoria || 'Geral');
            const sugestaoRevenda = custoReal / (1 - margemPercent / 100);
            const lucroProjetado = (sugestaoRevenda - custoReal) * qtd;

            return {
                id: p.produtoId,
                nome: p.nome,
                codigo: p.codigo,
                unidade: p.unidade || 'CX',
                categoria: p.categoria || 'Geral',
                precoUnitario: custoNF,
                custoReal,
                quantidade: qtd,
                subtotal: custoNF * qtd,
                sugestaoRevenda,
                margemPercent,
                lucroProjetado,
                totalQtdVendida: p.totalQtdVendida,
                giroDiarioCliente: giroD,
                ticketMedioCaixas: p.ticketMedioCaixas || 0,
                coberturaDias,
                isLimitadoTeto: isLimitado,
                isBonificacao: false,
                isManual: p.isManual || false,
            };
        }).filter(item => item.quantidade > 0);

        const totalPedido = itens.reduce((acc, item) => acc + item.subtotal, 0);
        const lucroProjetadoTotal = itens.reduce((acc, item) => acc + item.lucroProjetado, 0);
        const verbaGerada = aplicarEstrategia ? (totalPedido * (percentagemBonus / 100)) : 0;

        let caixasIsca = 0, precoCaixaIsca = 0, nomeIsca = '', codigoIsca = '', unidadeIsca = 'CX';
        if (aplicarEstrategia && produtoIsca && selectedTabela) {
            precoCaixaIsca = getPrecoByTabela(produtoIsca, selectedTabela);
            nomeIsca = produtoIsca.nome;
            codigoIsca = produtoIsca.codigo || '';
            unidadeIsca = produtoIsca.unidade || 'CX';
            if (precoCaixaIsca > 0) caixasIsca = Math.floor(verbaGerada / precoCaixaIsca);
        }

        const valorBonificacaoReal = caixasIsca * precoCaixaIsca;

        const itemBonificado = caixasIsca > 0 ? {
            id: selectedProdutoIscaId, nome: `[BONIFICAÇÃO] ${nomeIsca}`,
            codigo: codigoIsca, unidade: unidadeIsca, precoUnitario: 0,
            quantidade: caixasIsca, subtotal: 0, totalQtdVendida: 0,
            giroDiarioCliente: 0, ticketMedioCaixas: 0, coberturaDias: 0, isBonificacao: true,
        } : null;

        // === DILUIÇÃO DE BONIFICAÇÃO ===
        const totalCaixasPagas = itens.reduce((acc, item) => acc + item.quantidade, 0);
        const totalCaixasBonificadas = caixasIsca;
        const custoRealTotalCarga = itens.reduce((acc, item) => acc + (item.custoReal * item.quantidade), 0);
        const custoMedioCargaSemVerba = totalCaixasPagas > 0 ? custoRealTotalCarga / totalCaixasPagas : 0;
        const custoMedioCargaComVerba = (totalCaixasPagas + totalCaixasBonificadas) > 0
            ? custoRealTotalCarga / (totalCaixasPagas + totalCaixasBonificadas) : 0;

        // === RESUMO EXECUTIVO ===
        const investimentoBruto = totalPedido;
        const impostoEstimado = totalPedido * (percentualImposto / 100);
        const faturamentoPonta = itens.reduce((acc, item) => acc + (item.sugestaoRevenda * item.quantidade), 0)
            + (caixasIsca > 0 ? caixasIsca * (itens.length > 0 ? itens[0].sugestaoRevenda : 0) : 0);
        const lucroLiquidoEsperado = faturamentoPonta - (investimentoBruto + impostoEstimado);

        return {
            itens, itemBonificado, totalPedido, lucroProjetadoTotal, verbaGerada,
            caixasIsca, precoCaixaIsca, nomeIsca, codigoIsca, unidadeIsca, valorBonificacaoReal,
            // Diluição
            custoMedioCargaSemVerba, custoMedioCargaComVerba, totalCaixasPagas, totalCaixasBonificadas,
            // Resumo Executivo
            investimentoBruto, impostoEstimado, faturamentoPonta, lucroLiquidoEsperado,
        };
    }, [combinedProdutos, selectedTabela, percentagemBonus, percentualImposto, produtoIsca, quantidades, selectedProdutoIscaId, aplicarEstrategia, getMargemByCategoria]);

    const isReady = selectedFabricaId && selectedTabela && combinedProdutos.length > 0 && (!aplicarEstrategia || selectedProdutoIscaId !== '');

    // === PDF EXPORT ===
    const generatePDF = async () => {
        if (!calculo) {
            console.error('[PDF] calculo é null');
            alert('Erro: Simulação não calculada. Preencha todos os campos.');
            return;
        }
        if (!fabricaSelecionada) {
            console.error('[PDF] fabricaSelecionada não encontrada. ID:', selectedFabricaId, 'Fabricas:', fabricas.map(f => f.id));
            alert('Erro: Fábrica não encontrada. Selecione novamente.');
            return;
        }
        if (calculo.itens.length === 0) {
            console.error('[PDF] Nenhum item com quantidade > 0');
            alert('Erro: Nenhum produto possui quantidade preenchida.');
            return;
        }

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
                lucroImediato: aplicarEstrategia ? calculo.valorBonificacaoReal : 0,
                lucroEstimadoRevenda: calculo.lucroProjetadoTotal,
                clienteNovo: nomeClienteNovo,
                comprador: nomeComprador,
                // B2B Fields
                percentualImposto,
                custoMedioCargaSemVerba: calculo.custoMedioCargaSemVerba,
                custoMedioCargaComVerba: calculo.custoMedioCargaComVerba,
                totalCaixasPagas: calculo.totalCaixasPagas,
                totalCaixasBonificadas: calculo.totalCaixasBonificadas,
                investimentoBruto: calculo.investimentoBruto,
                impostoEstimado: calculo.impostoEstimado,
                faturamentoPonta: calculo.faturamentoPonta,
                lucroLiquidoEsperado: calculo.lucroLiquidoEsperado,
            };
            console.log('[PDF] Payload:', JSON.stringify(payload, null, 2));
            await gerarPdfConsultoria(payload);
        } catch (error) {
            console.error('[PDF] Erro:', error);
            alert('Falha ao gerar o PDF. Verifique o console.');
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
                            Simule o mix ideal com <strong className="text-white">Espelhamento Sniper</strong> e escalone por número de lojas.
                            Histórico de 180 dias. Mínimo recomendado: 15 dias de cobertura.
                        </p>
                    </div>
                </div>
            </div>

            {/* === CONTROLES === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-5">
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Factory className="w-4 h-4 text-blue-400" /> 1. Inteligência Alvo
                    </h4>

                    {/* Perfil */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Perfil do Cliente (Tabela de Preço)</label>
                        <select value={selectedTabela} onChange={(e) => handleTabelaChange(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm">
                            <option value="" className="text-black">Selecione o Perfil...</option>
                            {TABELAS_PRECO.map(t => <option key={t.value} value={t.value} className="text-black">{t.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Nome da Rede / Cliente Novo
                            </label>
                            <input type="text" value={nomeClienteNovo} onChange={(e) => setNomeClienteNovo(e.target.value)} placeholder="Ex: Grupo Carrefour"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-indigo-400" /> A/C Comprador(a)
                            </label>
                            <input type="text" value={nomeComprador} onChange={(e) => setNomeComprador(e.target.value)} placeholder="Ex: João Ferreira"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm" />
                        </div>
                    </div>

                    {/* Espelhamento Sniper */}
                    {selectedTabela && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-cyan-400" /> Espelhar em Cliente Base (Opcional)
                            </label>
                            <select value={selectedClienteEspelhoId} onChange={(e) => handleEspelhoChange(e.target.value)}
                                className="w-full bg-black/20 border border-cyan-500/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm">
                                <option value="" className="text-black">Nenhum (Média do perfil)</option>
                                {clientesFiltrados.map((c: Client) => (
                                    <option key={c.id} value={c.id} className="text-black">
                                        {c.nomeFantasia || c.razaoSocial} — {c.cidade}/{c.estado}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-cyan-400/70 mt-1">
                                {selectedClienteEspelhoId ? '🎯 Modo Sniper ativo.' : `${clientesFiltrados.length} clientes neste perfil.`}
                            </p>
                        </div>
                    )}

                    {/* Número de Lojas */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-amber-400" /> Lojas Atendidas (Fase de Introdução)
                        </label>
                        <input type="number" min={1} max={300} value={numLojasNovo}
                            onChange={(e) => setNumLojasNovo(Math.max(1, Number(e.target.value)))}
                            className="w-full bg-black/20 border border-amber-500/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors text-sm font-bold" />
                        <p className="text-[10px] text-gray-400 mt-1.5">
                            O sistema aplica <span className="text-amber-500 font-medium">redução progressiva de volume (Teto Logístico)</span> para grandes redes, prevenindo excesso de estoque (Overstock).
                        </p>
                    </div>

                    {/* Caixas por Pallet */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Caixas por Pallet</label>
                        <input type="number" min={1} value={caixasPorPallet}
                            onChange={(e) => setCaixasPorPallet(Math.max(1, Number(e.target.value)))}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors text-sm font-bold" />
                        <p className="text-[10px] text-gray-600 mt-1">Arredondamento logístico para atacado/redes.</p>
                    </div>

                    {/* Fábrica */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Fábrica / Representada</label>
                        <select value={selectedFabricaId} onChange={(e) => handleFabricaChange(e.target.value)} disabled={!selectedTabela}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm disabled:opacity-50">
                            <option value="" className="text-black">Selecione a Fábrica...</option>
                            {fabricas.map((f: Fabrica) => <option key={f.id} value={f.id} className="text-black">{f.nome}</option>)}
                        </select>
                    </div>
                </div>

                {/* Painel 2: Bonificação + Custo Variavel */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                            <Gift className="w-4 h-4 text-pink-400" /> 2. Estratégia de Bonificação
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={aplicarEstrategia}
                                onChange={(e) => setAplicarEstrategia(e.target.checked)} />
                            <div className="w-11 h-6 bg-white/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                        </label>
                    </div>
                    {aplicarEstrategia && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Produto Isca (Bonificação)</label>
                                <select value={selectedProdutoIscaId} onChange={(e) => setSelectedProdutoIscaId(e.target.value)}
                                    disabled={!selectedFabricaId}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors text-sm disabled:opacity-50">
                                    <option value="" className="text-black">Selecione o Produto Isca...</option>
                                    {produtosDaFabrica.map((p: Product) => (
                                        <option key={p.id} value={p.id} className="text-black">{p.nome} ({p.codigo})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Percentagem de Bonificação (%)</label>
                                <div className="relative">
                                    <input type="number" min={0} max={100} step={0.5} value={percentagemBonus}
                                        onChange={(e) => setPercentagemBonus(Number(e.target.value))}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm font-bold" />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Custo Variável / Imposto */}
                    <div className="border-t border-white/5 pt-5">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-orange-400" /> 3. Custo Tributário Estimado
                        </h4>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-orange-400" /> % Imposto / Frete Estimado (SP→MG)
                            </label>
                            <div className="relative">
                                <input type="number" min={0} max={50} step={0.5} value={percentualImposto}
                                    onChange={(e) => setPercentualImposto(Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-black/20 border border-orange-500/20 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold" />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                ICMS interestadual + ST/FCP. Altera o <span className="text-orange-400 font-medium">Custo Real</span> da mercadoria no PDF.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {curvaALoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    <span className="text-sm text-gray-400 font-bold">
                        {selectedClienteEspelhoId ? '🎯 Espelhando cliente...' : 'Inquirindo Inteligência Preditiva...'}
                    </span>
                </div>
            )}

            {curvaAAlerta && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-300 font-semibold">{curvaAAlerta}</p>
                </div>
            )}

            {/* === TABELA CURVA A E MANUAIS === */}
            {!curvaALoading && combinedProdutos.length > 0 && selectedTabela && (
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4 animate-in fade-in duration-300">
                    
                    {/* Injeção Manual de Produtos */}
                    {isReady && (
                        <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4 text-emerald-400" /> Injeção Manual de Produto
                            </h4>
                            <div className="flex w-full md:w-auto items-center gap-2">
                                <select
                                    value={produtoManualSelecionado}
                                    onChange={(e) => setProdutoManualSelecionado(e.target.value)}
                                    className="w-full md:w-72 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                >
                                    <option value="" className="text-black">Adicionar item fora da Curva A...</option>
                                    {produtosDaFabrica
                                        .filter(p => !combinedProdutos.find(c => c.produtoId === p.id))
                                        .map(p => (
                                            <option key={p.id} value={p.id} className="text-black">
                                                {p.nome}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    onClick={handleAddProdutoManual}
                                    disabled={!produtoManualSelecionado}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-400" /> Mix de Produtos Calculado
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                            {curvaAFonte === 'historico' && (
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {modoEspelho ? '🎯 SNIPER' : 'PERFIL'} {diasHistoricoTotal > 0 ? `${diasHistoricoTotal}D` : ''} | {numLojasNovo} Loja(s)
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
                                    <th className="px-3 py-3 text-center">Ticket<br/><span className="text-[9px] font-normal text-gray-500">(CX/Pedido)</span></th>
                                    <th className="px-3 py-3 text-center w-28">Sugestão</th>
                                    <th className="px-3 py-3 text-center">Cobertura</th>
                                    <th className="px-3 py-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {calculo?.itens.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-3 py-3">
                                            {index < 3 ? <Crown className={`w-4 h-4 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-amber-600'}`} />
                                                : <span className="text-xs text-gray-500 font-mono">{index + 1}</span>}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-white font-medium">{item.nome}</span>
                                                        {item.isManual && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/20 mr-1" title="Adicionado Manualmente">[MANUAL]</span>
                                                        )}
                                                        {item.isLimitadoTeto && (
                                                            <span title="Volume limitado ao Teto de Segurança para 1º Pedido">
                                                                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="block text-xs font-mono text-gray-500">Cód: {item.codigo} | {formatBRL(item.precoUnitario)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center font-mono">
                                            {item.ticketMedioCaixas > 0 ? (
                                                <span className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded">{item.ticketMedioCaixas.toFixed(1)}</span>
                                            ) : <span className="text-xs text-gray-600">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <input type="number" min={0} value={quantidades[item.id] ?? 0}
                                                onChange={(e) => handleQtdChange(item.id, parseInt(e.target.value) || 0)}
                                                className="w-16 bg-black/40 border border-emerald-500/30 rounded text-center text-sm py-1.5 text-white font-bold focus:outline-none focus:border-emerald-400 transition-colors" />
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {item.giroDiarioCliente > 0 ? (
                                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${item.coberturaDias >= 15 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    <CalendarDays className="w-3 h-3" /> {item.coberturaDias}d
                                                </span>
                                            ) : <span className="text-[10px] text-amber-500">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-right font-semibold text-white">
                                            <div className="flex items-center justify-end gap-3">
                                                <span>{formatBRL(item.subtotal)}</span>
                                                {item.isManual ? (
                                                    <button onClick={() => handleRemoveProdutoManual(item.id)} className="p-1 hover:bg-white/10 rounded-lg text-red-500 transition-colors" title="Remover item manual">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    // Espaçador invisivel pro layout não quebrar
                                                    <span className="w-6 hidden md:block"></span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* BONIFICAÇÃO */}
                                {isReady && calculo?.itemBonificado && (
                                    <tr className="bg-emerald-500/5 border-t border-emerald-500/30">
                                        <td className="px-3 py-3"><Gift className="w-4 h-4 text-emerald-400" /></td>
                                        <td className="px-3 py-3">
                                            <span className="text-emerald-300 font-bold">{calculo.nomeIsca}</span>
                                            <span className="block text-[10px] uppercase font-mono text-emerald-400">Bonificação (Custo Zero)</span>
                                        </td>
                                        <td className="px-3 py-3 text-center">—</td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-16 py-1 bg-emerald-500/20 rounded text-sm text-emerald-400 font-bold">+{calculo.caixasIsca}</span>
                                        </td>
                                        <td className="px-3 py-3 text-center"><span className="text-xs font-mono text-emerald-400">Verba</span></td>
                                        <td className="px-3 py-3 text-right font-bold text-emerald-400">R$ 0,00</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === RESUMO EXECUTIVO === */}
            {isReady && calculo && calculo.itens.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-teal-600/5 to-cyan-600/10" />
                    <div className="relative p-6 space-y-5">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                                <Award className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Resumo do Fechamento</h3>
                                <p className="text-xs text-gray-400">Análise financeira completa antes da exportação</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-2">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Investimento Bruto (NF)</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{formatBRL(calculo.investimentoBruto)}</p>
                            </div>

                            <div className="bg-black/20 border border-orange-500/10 rounded-xl p-5 space-y-2">
                                <div className="flex items-center gap-2 text-orange-400">
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Impacto Tributário ({percentualImposto}%)</span>
                                </div>
                                <p className="text-2xl font-bold text-orange-400">{formatBRL(calculo.impostoEstimado)}</p>
                                <p className="text-[10px] text-orange-500/70">ICMS SP→MG estimado</p>
                            </div>

                            <div className="bg-black/20 border border-cyan-500/10 rounded-xl p-5 space-y-2">
                                <div className="flex items-center gap-2 text-cyan-400">
                                    <BarChart3 className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Faturamento Ponta</span>
                                </div>
                                <p className="text-2xl font-bold text-cyan-400">{formatBRL(calculo.faturamentoPonta)}</p>
                                <p className="text-[10px] text-cyan-500/70">Revenda com margem sugerida</p>
                            </div>

                            <div className="bg-black/20 border border-emerald-500/10 rounded-xl p-5 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Award className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Lucro Líquido Esperado</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-400">{formatBRL(calculo.lucroLiquidoEsperado)}</p>
                            </div>
                        </div>

                        {aplicarEstrategia && calculo.caixasIsca > 0 && (
                            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-6 shadow-inner">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-emerald-100 uppercase tracking-wide">Efeito da Verba — Diluição na Carga</p>
                                        <p className="text-xl sm:text-2xl font-black text-emerald-400">
                                            {calculo.caixasIsca} CX de {calculo.nomeIsca} <span className="text-white">(Custo Zero)</span>
                                        </p>
                                        <p className="text-xs text-emerald-300/70 mt-1">
                                            Custo médio da carga: <span className="text-white font-bold">{formatBRL(calculo.custoMedioCargaSemVerba)}</span> → <span className="text-emerald-400 font-bold">{formatBRL(calculo.custoMedioCargaComVerba)}</span> por CX
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="bg-emerald-950/50 border border-emerald-500/20 px-4 py-2 rounded-lg text-center">
                                            <p className="text-[10px] text-emerald-300 uppercase">Verba ({percentagemBonus}%)</p>
                                            <p className="text-sm font-mono text-emerald-400 font-bold">{formatBRL(calculo.verbaGerada)}</p>
                                        </div>
                                        <div className="bg-emerald-950/50 border border-emerald-500/20 px-4 py-2 rounded-lg text-center">
                                            <p className="text-[10px] text-emerald-300 uppercase">Economia/CX</p>
                                            <p className="text-sm font-mono text-white font-bold">{formatBRL(calculo.custoMedioCargaSemVerba - calculo.custoMedioCargaComVerba)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-emerald-500/10">
                            <button onClick={generatePDF} disabled={isGeneratingPDF || calculo.itens.length === 0}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all disabled:opacity-50">
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
