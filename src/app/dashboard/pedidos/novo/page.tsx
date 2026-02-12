'use client';

import Link from "next/link";
import { ArrowLeft, Save, User, Search, Factory, ShoppingCart, Calendar, FileText, Check, AlertTriangle, X } from "lucide-react";
import { useData, OrderItem, Product, Client } from "@/contexts/DataContext";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function NovoPedidoPage() {
    const { clients, products, addOrder, showToast, fabricas } = useData();
    const router = useRouter();

    // --- State: Wizard Step ---
    const [step, setStep] = useState<'factory' | 'client' | 'order'>('factory');

    // --- State: Selection ---
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [clienteId, setClienteId] = useState('');

    // --- State: Order Details ---
    const [itens, setItens] = useState<OrderItem[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
    const [tabelaPreco, setTabelaPreco] = useState('preco50a199');
    const [condicaoPagamento, setCondicaoPagamento] = useState('30 dias');
    const [searchProduct, setSearchProduct] = useState('');
    const [searchClient, setSearchClient] = useState('');
    const [selectedCategoria, setSelectedCategoria] = useState('all');
    const [isBonificacao, setIsBonificacao] = useState(false);

    // --- State: Pricing History ---
    const [priceHistory, setPriceHistory] = useState<Record<string, number>>({});

    // --- Helper: Get Current Factory ---
    const fabricaSelecionada = fabricas.find(f => f.id === selectedFabricaId);
    const clienteSelecionado = clients.find(c => c.id === clienteId);

    // --- Fetch Price History ---
    const fetchPriceHistory = async (cid: string) => {
        try {
            const res = await fetch(`/api/clients/${cid}/product-history`);
            if (res.ok) {
                const history = await res.json();
                setPriceHistory(history);
            }
        } catch (error) {
            console.error("Error fetching price history:", error);
        }
    };

    // --- Handlers: Wizard Navigation ---
    const handleSelectFabrica = (id: string) => {
        setSelectedFabricaId(id);
        setStep('client');
        setItens([]); // Reset items when changing factory
    };

    const handleSelectClient = (id: string) => {
        setClienteId(id);
        // Set default price table from client if available, else default
        const client = clients.find(c => c.id === id);
        if (client?.tabelaPreco) {
            // Map legacy names if necessary, or just use direct
            setTabelaPreco(client.tabelaPreco);
        }
        fetchPriceHistory(id);
        setStep('order');
    };

    const handleBack = () => {
        if (step === 'order') setStep('client');
        else if (step === 'client') setStep('factory');
        else router.back();
    };

    // --- Logic: Pricing ---
    const getPrecoCliente = (produto: Product) => {
        // @ts-ignore - dynamic access
        const preco = produto[tabelaPreco] || produto.preco50a199;
        return Number(preco);
    };

    // --- Handlers: Order Items ---
    const addItem = (produto: Product, customPrice?: number) => {
        const preco = customPrice !== undefined ? customPrice : getPrecoCliente(produto);
        setItens(prev => {
            const existing = prev.find(i => i.produtoId === produto.id);
            if (existing) {
                // If custom price is provided, update it. Otherwise keep existing.
                const finalPrice = customPrice !== undefined ? customPrice : existing.precoUnitario;
                return prev.map(i => i.produtoId === produto.id
                    ? { ...i, quantidade: i.quantidade + 1, precoUnitario: finalPrice, total: (i.quantidade + 1) * finalPrice }
                    : i
                );
            }
            return [...prev, {
                produtoId: produto.id,
                nomeProduto: produto.nome,
                quantidade: 1,
                precoUnitario: preco,
                total: preco
            }];
        });
    };

    const removeItem = (produtoId: string) => {
        setItens(prev => {
            const existing = prev.find(i => i.produtoId === produtoId);
            if (existing && existing.quantidade > 1) {
                return prev.map(i => i.produtoId === produtoId
                    ? { ...i, quantidade: i.quantidade - 1, total: (i.quantidade - 1) * i.precoUnitario }
                    : i
                );
            }
            return prev.filter(i => i.produtoId !== produtoId);
        });
    };

    const updateItemQuantity = (produtoId: string, qtd: number) => {
        if (qtd < 0) return;
        if (qtd === 0) {
            setItens(prev => prev.filter(i => i.produtoId !== produtoId));
            return;
        }
        setItens(prev => prev.map(i => {
            if (i.produtoId === produtoId) {
                return { ...i, quantidade: qtd, total: qtd * i.precoUnitario };
            }
            return i;
        }));
    };

    const updateItemPrice = (produto: Product, novoPreco: number) => {
        if (novoPreco < 0) return;
        setItens(prev => {
            const existing = prev.find(i => i.produtoId === produto.id);
            if (existing) {
                return prev.map(i => {
                    if (i.produtoId === produto.id) {
                        return { ...i, precoUnitario: novoPreco, total: i.quantidade * novoPreco };
                    }
                    return i;
                });
            } else {
                // Item doesn't exist, add it with custom price (qty 1)
                return [...prev, {
                    produtoId: produto.id,
                    nomeProduto: produto.nome,
                    quantidade: 1,
                    precoUnitario: novoPreco,
                    total: novoPreco
                }];
            }
        });
    };

    // --- Filtering ---
    const produtosFiltrados = useMemo(() => {
        if (!fabricaSelecionada) return [];
        return products.filter(p => {
            const matchFabrica = p.fabricaId === fabricaSelecionada.id;
            const matchSearch = p.nome.toLowerCase().includes(searchProduct.toLowerCase()) ||
                p.codigo.toLowerCase().includes(searchProduct.toLowerCase());
            const matchCategoria = selectedCategoria === 'all' || p.categoria === selectedCategoria;
            return matchFabrica && matchSearch && matchCategoria;
        });
    }, [products, fabricaSelecionada, searchProduct, selectedCategoria]);

    const categorias = useMemo(() => {
        if (!fabricaSelecionada) return [];
        const cats = products
            .filter(p => p.fabricaId === fabricaSelecionada.id)
            .map(p => p.categoria)
            .filter((c): c is string => !!c);
        return Array.from(new Set(cats));
    }, [products, fabricaSelecionada]);

    const clientesFiltrados = useMemo(() => {
        return clients.filter(c =>
            c.nomeFantasia.toLowerCase().includes(searchClient.toLowerCase()) ||
            c.razaoSocial.toLowerCase().includes(searchClient.toLowerCase()) ||
            c.cnpj.includes(searchClient)
        );
    }, [clients, searchClient]);

    // --- Totals ---
    const valorTotal = itens.reduce((acc, i) => acc + i.total, 0);
    const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);

    // --- Submit ---
    const handleSave = async () => {
        if (!clienteId || itens.length === 0) {
            showToast("Selecione um cliente e adicione itens.", "error");
            return;
        }

        try {
            const success = await addOrder({
                clienteId,
                nomeCliente: clienteSelecionado?.nomeFantasia || 'Cliente',
                fabricaId: selectedFabricaId,
                data: new Date(dataPedido).toISOString(),
                status: 'Pendente' as any,
                tipo: (isBonificacao ? 'Bonificacao' : 'Venda') as any,
                valorTotal,
                tabelaPreco,
                condicaoPagamento,
                observacoes,
                itens: itens.map(i => ({
                    produtoId: i.produtoId,
                    nomeProduto: i.nomeProduto,
                    quantidade: i.quantidade,
                    precoUnitario: i.precoUnitario,
                    total: i.total
                }))
            });

            if (success) {
                router.push('/dashboard/pedidos');
            }
        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar pedido", "error");
        }
    };

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-[#121214] text-white flex flex-col">

            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-[#121214] flex items-center justify-between px-4 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                            {step === 'factory' ? 'Nova Venda / Selecionar Fábrica' :
                                step === 'client' ? 'Nova Venda / Selecionar Cliente' :
                                    `Pedido: ${fabricaSelecionada?.nome}`}
                        </h1>
                        {step === 'order' && clienteSelecionado && (
                            <p className="text-xs text-blue-400 font-medium">{clienteSelecionado.nomeFantasia}</p>
                        )}
                    </div>
                </div>

                {step === 'order' && (
                    <button
                        onClick={handleSave}
                        disabled={itens.length === 0}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/20"
                    >
                        <Save className="w-4 h-4" />
                        <span className="hidden sm:inline">Finalizar</span>
                    </button>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">

                    {/* STEP 1: FACTORY SELECTION */}
                    {step === 'factory' && (
                        <motion.div
                            key="factory"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="p-6 max-w-4xl mx-auto"
                        >
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Factory className="text-purple-400" />
                                Escolha a Fábrica
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {fabricas.map(fab => (
                                    <button
                                        key={fab.id}
                                        onClick={() => handleSelectFabrica(fab.id)}
                                        className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-purple-600/20 hover:border-purple-500/50 transition-all group text-left"
                                    >
                                        <h3 className="text-lg font-bold text-white group-hover:text-purple-400 mb-2">{fab.nome}</h3>
                                        <p className="text-sm text-gray-500">{fab.produtosCount || 0} produtos</p>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: CLIENT SELECTION */}
                    {step === 'client' && (
                        <motion.div
                            key="client"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="p-6 max-w-4xl mx-auto h-full flex flex-col"
                        >
                            <div className="mb-6">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <User className="text-blue-400" />
                                    Selecione o Cliente
                                </h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome, razão social ou CNPJ..."
                                        value={searchClient}
                                        onChange={(e) => setSearchClient(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {clientesFiltrados.map(client => (
                                    <button
                                        key={client.id}
                                        onClick={() => handleSelectClient(client.id)}
                                        className="w-full p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-left transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{client.nomeFantasia}</p>
                                            <p className="text-xs text-gray-500 uppercase">{client.razaoSocial}</p>
                                            <p className="text-xs text-gray-600 font-mono mt-1">{client.cnpj}</p>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            <p>{client.cidade}/{client.estado}</p>
                                            {client.ultima_compra && <p className="mt-1">Última compra: {new Date(client.ultima_compra).toLocaleDateString()}</p>}
                                        </div>
                                    </button>
                                ))}
                                {clientesFiltrados.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        Nenhum cliente encontrado.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: ORDER ENTRY */}
                    {step === 'order' && (
                        <motion.div
                            key="order"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col h-full lg:flex-row"
                        >
                            {/* LEFT COLUMN: PRODUCTS */}
                            <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0e]">
                                {/* Toolbar */}
                                <div className="p-4 border-b border-white/5 space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            type="text"
                                            value={searchProduct}
                                            onChange={(e) => setSearchProduct(e.target.value)}
                                            placeholder="Buscar produto por código ou nome..."
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    {/* Categories */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                        <button
                                            onClick={() => setSelectedCategoria('all')}
                                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategoria === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            Todos
                                        </button>
                                        {categorias.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategoria(cat)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategoria === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Product List (Table) */}
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[#121214] sticky top-0 z-10 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3 border-b border-white/5">Cod</th>
                                                <th className="px-4 py-3 border-b border-white/5 w-full">Produto</th>
                                                <th className="px-4 py-3 border-b border-white/5 text-center hidden sm:table-cell">Categ.</th>
                                                <th className="px-4 py-3 border-b border-white/5 text-right w-[100px]">Preço</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {produtosFiltrados.map(product => {
                                                const item = itens.find(i => i.produtoId === product.id);
                                                const qtd = item?.quantidade || 0;
                                                const preco = getPrecoCliente(product);
                                                const lastPrice = priceHistory[product.id];

                                                return (
                                                    <tr
                                                        key={product.id}
                                                        onClick={() => addItem(product)}
                                                        className={`
                                                            group cursor-pointer transition-colors
                                                            ${qtd > 0 ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'hover:bg-white/5'}
                                                        `}
                                                    >
                                                        {/* Code */}
                                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono border-r border-white/5">
                                                            {product.codigo}
                                                        </td>

                                                        {/* Name & Pricing Info */}
                                                        <td className="px-4 py-3 border-r border-white/5">
                                                            <div className="font-medium text-gray-200 group-hover:text-white transition-colors">
                                                                {product.nome}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {lastPrice && (
                                                                    <span className="text-[10px] bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-400/20" title="Último preço pago">
                                                                        Últ: {lastPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Mobile price/qty controls could go here */}
                                                        </td>

                                                        {/* Category */}
                                                        <td className="px-4 py-3 text-xs text-gray-500 text-center hidden sm:table-cell border-r border-white/5">
                                                            {product.categoria || '-'}
                                                        </td>

                                                        {/* Price & Controls */}
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="text-sm font-medium text-gray-300" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item ? item.precoUnitario : getPrecoCliente(product)}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value);
                                                                        if (!isNaN(val)) updateItemPrice(product, val);
                                                                    }}
                                                                    className={`w-[80px] bg-transparent text-right border-b focus:outline-none ${item ? 'border-blue-500 text-white font-bold' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                                                                        }`}
                                                                />
                                                            </div>

                                                            {/* In-row Controls */}
                                                            <div className="flex items-center justify-end gap-1mt-1" onClick={(e) => e.stopPropagation()}>
                                                                {qtd > 0 && (
                                                                    <div className="flex items-center bg-gray-900 rounded-lg border border-gray-700 mt-1">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); removeItem(product.id); }}
                                                                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-l-lg"
                                                                        >-</button>
                                                                        <input
                                                                            type="number"
                                                                            value={qtd}
                                                                            onChange={(e) => {
                                                                                const val = parseInt(e.target.value);
                                                                                if (!isNaN(val)) updateItemQuantity(product.id, val);
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="w-10 h-7 bg-transparent text-center text-sm font-bold text-blue-400 focus:outline-none appearance-none"
                                                                        />
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); addItem(product); }}
                                                                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-r-lg"
                                                                        >+</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: SUMMARY & SETTINGS */}
                            <div className="w-full lg:w-[350px] bg-[#121214] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col z-20 shadow-2xl">
                                {/* Settings Panel */}
                                <div className="p-4 space-y-4 border-b border-white/5 bg-gray-900/50">
                                    <div className="space-y-3">
                                        {/* Order Type Selector */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Tipo de Pedido</label>
                                            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                                                <button
                                                    onClick={() => setIsBonificacao(false)}
                                                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${!isBonificacao ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                                                >
                                                    Venda
                                                </button>
                                                <button
                                                    onClick={() => setIsBonificacao(true)}
                                                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${isBonificacao ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                                                >
                                                    Bonificação
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Tabela de Preço</label>
                                                <select
                                                    value={tabelaPreco}
                                                    onChange={(e) => setTabelaPreco(e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                >
                                                    <option value="preco50a199">Padrão</option>
                                                    <option value="preco200a699">200 a 699</option>
                                                    <option value="atacado">Atacado</option>
                                                    <option value="atacadoAVista">Atacado à Vista</option>
                                                    <option value="redes">Redes</option>
                                                </select>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Condição Pagto</label>
                                                <select
                                                    value={condicaoPagamento}
                                                    onChange={(e) => setCondicaoPagamento(e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                >
                                                    <option>A Vista</option>
                                                    <option>30 Dias</option>
                                                    <option>30/60 Dias</option>
                                                    <option>30/60/90 Dias</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Data Emissão</label>
                                            <input
                                                type="date"
                                                value={dataPedido}
                                                onChange={(e) => setDataPedido(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs px-3 py-2 text-white focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Observações</label>
                                            <textarea
                                                rows={2}
                                                value={observacoes}
                                                onChange={(e) => setObservacoes(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs px-3 py-2 text-white resize-none focus:border-blue-500 outline-none"
                                                placeholder="Obs. do pedido..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Items Summary List (Scrollable) */}
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#0f0f10]">
                                    {itens.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                                            <ShoppingCart className="w-8 h-8 opacity-20" />
                                            <p className="text-xs">Carrinho vazio</p>
                                        </div>
                                    ) : (
                                        itens.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5 text-xs">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-medium text-gray-300 truncate">{item.nomeProduto}</p>
                                                    <p className="text-gray-500">{item.quantidade} x R$ {item.precoUnitario.toFixed(2)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-white">R$ {item.total.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Total Footer */}
                                <div className="p-4 bg-gray-900 border-t border-white/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-400">Itens</span>
                                        <span className="text-sm font-mono text-white">{totalItens}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-bold text-gray-400">TOTAL</span>
                                        <span className="text-2xl font-bold text-green-400">
                                            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>
        </div>
    );
}
