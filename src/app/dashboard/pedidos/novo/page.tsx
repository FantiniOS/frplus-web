'use client';

import Link from "next/link";
import { ArrowLeft, Save, ShoppingCart, User, Plus, Trash2, Package, Search, DollarSign, Sparkles, Calendar, Factory, Check } from "lucide-react";
import { useData, Order, OrderItem } from "@/contexts/DataContext";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function NovoPedidoPage() {
    const { clients, products, addOrder, showToast, fabricas } = useData();
    const router = useRouter();

    const [selectedFabricaId, setSelectedFabricaId] = useState('all');
    const [selectedCategoria, setSelectedCategoria] = useState('all');

    // Cliente selecionado
    const clienteSelecionado = clients.find(c => c.id === clienteId);

    // Filtrar clientes
    const filteredClients = useMemo(() => {
        if (!searchClient) return clients.slice(0, 5);
        return clients.filter(c =>
            (c.nomeFantasia || c.razaoSocial || '').toLowerCase().includes(searchClient.toLowerCase()) ||
            c.cnpj.includes(searchClient)
        ).slice(0, 5);
    }, [clients, searchClient]);

    // Filtrar produtos (Lógica em Cascata: Busca -> Fábrica -> Categoria)
    const filteredProducts = useMemo(() => {
        let result = products;

        // 1. Busca por texto
        if (searchProduct) {
            const term = searchProduct.toLowerCase();
            result = result.filter(p =>
                p.nome.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term)
            );
        }

        // 2. Filtro de Fábrica
        if (selectedFabricaId !== 'all') {
            result = result.filter(p => p.fabricaId === selectedFabricaId);
        }

        // 3. Filtro de Categoria
        if (selectedCategoria !== 'all') {
            result = result.filter(p => (p.categoria || 'Geral') === selectedCategoria);
        }

        return result;
    }, [products, searchProduct, selectedFabricaId, selectedCategoria]);

    // Categorias disponíveis (Baseado na Fábrica selecionada)
    const availableCategories = useMemo(() => {
        let baseProducts = products;

        // Se tiver fábrica selecionada, pega só as categorias dela
        if (selectedFabricaId !== 'all') {
            baseProducts = baseProducts.filter(p => p.fabricaId === selectedFabricaId);
        }

        const categories = new Set<string>();
        baseProducts.forEach(p => {
            categories.add(p.categoria || 'Geral');
        });

        return Array.from(categories).sort();
    }, [products, selectedFabricaId]);

    // Resetar categoria quando mudar fábrica
    const handleFabricaChange = (fabricaId: string) => {
        setSelectedFabricaId(fabricaId);
        setSelectedCategoria('all');
    };

    const getFabricaNome = (fabricaId?: string) => {
        if (!fabricaId) return '-';
        return fabricas.find(f => f.id === fabricaId)?.nome || '-';
    };

    // Obter preço baseado na tabela do cliente
    const getPrecoForTable = (product: typeof products[0], tabela: string) => {
        switch (tabela) {
            case '200a699': return Number(product.preco200a699);
            case 'atacado': return Number(product.precoAtacado);
            case 'atacadoAVista': return Number(product.precoAtacadoAVista);
            case 'redes': return Number(product.precoRedes);
            default: return Number(product.preco50a199);
        }
    };

    const getPrecoCliente = (product: typeof products[0]) => {
        return getPrecoForTable(product, tabelaPreco);
    };

    // Atualizar tabela quando seleciona cliente
    useMemo(() => {
        if (clienteSelecionado?.tabelaPreco) {
            setTabelaPreco(clienteSelecionado.tabelaPreco);
        }
    }, [clienteSelecionado]);

    // Mudar tabela e atualizar preços dos itens no carrinho
    const handleTabelaChange = (novaTabela: string) => {
        setTabelaPreco(novaTabela);
        setItens(prev => prev.map(item => {
            const product = products.find(p => p.id === item.produtoId);
            if (!product) return item;

            const newPrice = getPrecoForTable(product, novaTabela);
            return {
                ...item,
                precoUnitario: newPrice,
                total: newPrice * item.quantidade
            };
        }));
    };

    // Adicionar item ao pedido
    const addItem = (product: typeof products[0]) => {
        const existingIndex = itens.findIndex(i => i.produtoId === product.id);
        const preco = getPrecoCliente(product);

        if (existingIndex >= 0) {
            setItens(prev => prev.map((item, i) =>
                i === existingIndex
                    ? { ...item, quantidade: item.quantidade + 1, total: (item.quantidade + 1) * item.precoUnitario }
                    : item
            ));
        } else {
            setItens(prev => [...prev, {
                produtoId: product.id,
                nomeProduto: product.nome,
                quantidade: 1,
                precoUnitario: preco,
                total: preco
            }]);
        }
        showToast(`${product.nome} adicionado!`, 'success');
    };

    // Atualizar quantidade
    const updateQuantidade = (index: number, delta: number) => {
        setItens(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const newQtd = Math.max(1, item.quantidade + delta);
            return { ...item, quantidade: newQtd, total: newQtd * item.precoUnitario };
        }));
    };

    const setQuantidade = (index: number, value: number) => {
        setItens(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const newQtd = Math.max(1, value);
            return { ...item, quantidade: newQtd, total: newQtd * item.precoUnitario };
        }));
    };

    const removeItem = (index: number) => {
        setItens(prev => prev.filter((_, i) => i !== index));
    };

    const valorTotal = itens.reduce((acc, item) => acc + item.total, 0);
    const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

    const handleSubmit = () => {
        if (!clienteId) {
            showToast("Selecione um cliente", "error");
            return;
        }
        if (itens.length === 0) {
            showToast("Adicione pelo menos um produto", "error");
            return;
        }

        const newOrder: Order = {
            id: Date.now().toString(),
            clienteId,
            nomeCliente: clienteSelecionado?.nomeFantasia || clienteSelecionado?.razaoSocial || '',
            data: new Date(dataPedido + 'T12:00:00').toISOString(),
            itens,
            valorTotal,
            observacoes,
            status: 'Pendente',
            tabelaPreco: tabelaPreco || 'preco50a199',
            condicaoPagamento: condicaoPagamento || '30 dias'
        };

        addOrder(newOrder);
        router.push('/dashboard/pedidos');
    };

    return (
        <div className="h-[calc(100vh-100px)] flex gap-4">

            {/* Coluna Esquerda - Tabela de Produtos */}
            <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                {/* Header Superior: Título e Busca */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/pedidos" className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Novo Pedido</h1>
                        </div>
                    </div>

                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            value={searchProduct}
                            onChange={(e) => setSearchProduct(e.target.value)}
                            placeholder="Buscar produto por nome ou código..."
                            className="input-compact pl-10 w-full"
                        />
                    </div>
                </div>

                {/* Filtros: Fábricas e Categorias */}
                <div className="bg-black/20 border-b border-white/5 p-2">
                    {/* Abas de Fábricas */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
                        <button
                            onClick={() => handleFabricaChange('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedFabricaId === 'all'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            Todas as Fábricas
                        </button>
                        {fabricas.map(f => (
                            <button
                                key={f.id}
                                onClick={() => handleFabricaChange(f.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedFabricaId === f.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {f.nome}
                            </button>
                        ))}
                    </div>

                    {/* Chips de Categorias */}
                    {availableCategories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            <button
                                onClick={() => setSelectedCategoria('all')}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${selectedCategoria === 'all'
                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                        : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30 hover:text-gray-300'
                                    }`}
                            >
                                Todas
                            </button>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategoria(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${selectedCategoria === cat
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                            : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30 hover:text-gray-300'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabela de Produtos (Estilo Excel) */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 z-10 text-xs font-bold text-gray-400 uppercase tracking-wider backdrop-blur-md">
                            <tr>
                                <th className="px-4 py-3 w-20">Cód.</th>
                                <th className="px-4 py-3">Produto</th>
                                <th className="px-4 py-3 w-32 text-right">Preço Un.</th>
                                <th className="px-4 py-3 w-24 text-center">Qtd</th>
                                <th className="px-4 py-3 w-32 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map((product) => {
                                const preco = getPrecoCliente(product);
                                const item = itens.find(i => i.produtoId === product.id);
                                const quantidade = item?.quantidade || 0;
                                const subtotal = quantidade * preco;

                                return (
                                    <tr
                                        key={product.id}
                                        className={`group transition-colors ${quantidade > 0 ? 'bg-blue-500/5' : 'hover:bg-white/5'}`}
                                    >
                                        <td className="px-4 py-2 font-mono text-xs text-gray-500">
                                            {product.codigo}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">{product.nome}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                        {getFabricaNome(product.fabricaId)}
                                                    </span>
                                                    {product.categoria && (
                                                        <span className="text-[10px] text-gray-500 border border-white/10 px-1.5 py-0.5 rounded">
                                                            {product.categoria}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm text-gray-300">
                                            R$ {preco.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={quantidade || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                    if (!isNaN(val)) {
                                                        const existingIndex = itens.findIndex(i => i.produtoId === product.id);
                                                        if (existingIndex >= 0) {
                                                            if (val === 0) {
                                                                removeItem(existingIndex);
                                                            } else {
                                                                setQuantidade(existingIndex, val);
                                                            }
                                                        } else if (val > 0) {
                                                            setItens(prev => {
                                                                const exists = prev.find(i => i.produtoId === product.id);
                                                                if (exists) {
                                                                    if (val === 0) return prev.filter(i => i.produtoId !== product.id);
                                                                    return prev.map(i => i.produtoId === product.id ? { ...i, quantidade: val, total: val * preco } : i);
                                                                }
                                                                if (val > 0) {
                                                                    return [...prev, {
                                                                        produtoId: product.id,
                                                                        nomeProduto: product.nome,
                                                                        quantidade: val,
                                                                        precoUnitario: preco,
                                                                        total: val * preco
                                                                    }];
                                                                }
                                                                return prev;
                                                            });
                                                        }
                                                    }
                                                }}
                                                className={`w-full text-center bg-black/20 border border-white/10 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-1 text-sm font-bold ${quantidade > 0 ? 'text-blue-400 border-blue-500/50' : 'text-gray-400'}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-sm">
                                            {subtotal > 0 ? (
                                                <span className="text-green-400 font-bold">R$ {subtotal.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredProducts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum produto encontrado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Direita - Resumo e Finalização */}
            <div className="w-80 flex flex-col gap-4">

                {/* Painel do Cliente e Configuração */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Configuração</h2>

                    {/* Cliente */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Cliente</label>
                        {clienteSelecionado ? (
                            <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20 mb-2">
                                <User className="h-4 w-4 text-blue-400" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{clienteSelecionado.nomeFantasia || clienteSelecionado.razaoSocial}</p>
                                </div>
                                <button onClick={() => setClienteId('')} className="text-red-400 hover:bg-red-500/10 p-1 rounded">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative mb-2">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchClient}
                                    onChange={(e) => setSearchClient(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="input-compact pl-7 w-full text-sm"
                                />
                                <div className="max-h-60 overflow-y-auto space-y-1 mt-2 border-t border-white/10 pt-2">
                                    {filteredClients.length > 0 ? (
                                        filteredClients.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => { setClienteId(c.id); setSearchClient(''); }}
                                                className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors flex flex-col"
                                            >
                                                <span className="font-bold">{c.nomeFantasia || c.razaoSocial}</span>
                                                <span className="text-[10px] text-gray-500">{c.cnpj}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-2">Nenhum cliente encontrado</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tabela de Preço */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Tabela</label>
                        <select
                            value={tabelaPreco}
                            onChange={(e) => handleTabelaChange(e.target.value)}
                            className="input-compact w-full text-sm"
                        >
                            <option value="50a199">50 a 199 CX</option>
                            <option value="200a699">200 a 699 CX</option>
                            <option value="atacado">Atacado</option>
                            <option value="atacadoAVista">Atacado à Vista</option>
                            <option value="redes">Redes</option>
                        </select>
                    </div>

                    {/* Data */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Data</label>
                        <input
                            type="date"
                            value={dataPedido}
                            onChange={(e) => setDataPedido(e.target.value)}
                            className="input-compact w-full text-sm"
                        />
                    </div>
                </div>

                {/* Resumo do Pedido (Sticky) */}
                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl border border-blue-500/30 p-4 space-y-4 sticky top-4">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-300">Itens</span>
                        <span className="text-xl font-bold text-white">{totalItens}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-gray-300">Total</span>
                        <span className="text-2xl font-bold text-green-400">
                            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>

                    <div className="pt-2">
                        <textarea
                            rows={2}
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Obs. do pedido..."
                            className="input-compact w-full text-xs resize-none mb-3"
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={!clienteId || itens.length === 0}
                            className="w-full py-3 rounded-lg bg-green-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-green-600/20"
                        >
                            <Check className="h-5 w-5" />
                            FECHAR PEDIDO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

