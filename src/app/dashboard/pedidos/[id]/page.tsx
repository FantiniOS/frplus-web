'use client';

import Link from "next/link";
import { ArrowLeft, Save, ShoppingCart, User, Plus, Trash2, Package, Search, DollarSign, Sparkles, Factory, Check } from "lucide-react";
import { useData, Order, OrderItem } from "@/contexts/DataContext";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function EditarPedidoPage({ params }: { params: { id: string } }) {
    const { orders, clients, products, updateOrder, showToast, fabricas } = useData();
    const router = useRouter();

    const [clienteId, setClienteId] = useState('');
    const [searchClient, setSearchClient] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [itens, setItens] = useState<OrderItem[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [isBonificacao, setIsBonificacao] = useState(false);
    const [tabelaPreco, setTabelaPreco] = useState('50a199');
    const [condicaoPagamento, setCondicaoPagamento] = useState('A vista');
    const [debugMode, setDebugMode] = useState(false);
    const [lastPayload, setLastPayload] = useState<any>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    // Carregar dados do pedido
    const [dataLoaded, setDataLoaded] = useState(false);

    useEffect(() => {
        if (dataLoaded) return;

        const found = orders.find(o => o.id === params.id);
        if (found) {
            setClienteId(found.clienteId);
            setItens(found.itens);
            setObservacoes(found.observacoes || '');
            setIsBonificacao(found.tipo === 'Bonificacao');
            setTabelaPreco(found.tabelaPreco || '50a199');
            setCondicaoPagamento(found.condicaoPagamento || 'A vista');
            setDataLoaded(true);
        }
    }, [orders, params.id, dataLoaded]);

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

    // Filtrar produtos
    const filteredProducts = useMemo(() => {
        if (!searchProduct) return products;
        return products.filter(p =>
            p.nome.toLowerCase().includes(searchProduct.toLowerCase()) ||
            p.codigo.toLowerCase().includes(searchProduct.toLowerCase())
        );
    }, [products, searchProduct]);

    const getFabricaNome = (fabricaId?: string) => {
        if (!fabricaId) return '-';
        return fabricas.find(f => f.id === fabricaId)?.nome || '-';
    };

    // Agrupar produtos por fábrica
    const productsByFabrica = useMemo(() => {
        return filteredProducts.reduce((acc, product) => {
            const fabricaId = product.fabricaId || 'sem-fabrica';
            if (!acc[fabricaId]) {
                acc[fabricaId] = [];
            }
            acc[fabricaId].push(product);
            return acc;
        }, {} as Record<string, typeof products>);
    }, [filteredProducts]);

    // Obter preço baseado na tabela do cliente
    const getPrecoCliente = (product: typeof products[0]) => {
        const tabela = clienteSelecionado?.tabelaPreco || '50a199';
        // @ts-ignore - dynamic access
        const preco = product[tabela] || product.preco50a199;
        return Number(preco);
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

    const updatePrecoItem = (index: number, novoPreco: number) => {
        if (novoPreco < 0) return;
        setItens(prev => prev.map((item, i) => {
            if (i !== index) return item;
            return { ...item, precoUnitario: novoPreco, total: item.quantidade * novoPreco };
        }));
    };

    const removeItem = (index: number) => {
        setItens(prev => prev.filter((_, i) => i !== index));
    };

    const valorTotal = itens.reduce((acc, item) => acc + item.total, 0);
    const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

    const handleSubmit = async () => {
        setLastError(null);
        if (!clienteId) {
            showToast("Selecione um cliente", "error");
            return;
        }
        if (itens.length === 0) {
            showToast("Adicione pelo menos um produto", "error");
            return;
        }

        const updatedOrder: Partial<Order> = {
            clienteId,
            nomeCliente: clienteSelecionado?.nomeFantasia || clienteSelecionado?.razaoSocial || 'Cliente Desconhecido',
            itens: itens.map(i => ({
                produtoId: i.produtoId,
                nomeProduto: i.nomeProduto,
                quantidade: i.quantidade,
                precoUnitario: i.precoUnitario,
                total: i.total
            })),
            valorTotal,
            observacoes,
            tipo: (isBonificacao ? 'Bonificacao' : 'Venda') as any,
            status: 'Pendente', // Default or preserve if we had status state
            tabelaPreco,
            condicaoPagamento
        };

        setLastPayload(updatedOrder);

        console.log('--- DEBUG: Submitting Order Update ---');
        console.log('Order ID:', params.id);
        console.log('Payload:', JSON.stringify(updatedOrder, null, 2));

        try {
            const success = await updateOrder(params.id, updatedOrder);
            console.log('Update Result:', success);

            if (success) {
                router.push('/dashboard/pedidos');
            } else {
                setLastError("Falha ao atualizar. Verifique o console ou o painel de debug.");
            }
        } catch (e: any) {
            setLastError(e.message || "Erro desconhecido");
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex gap-4 relative">
            {/* DEBUG PANEL */}
            {debugMode && (
                <div className="absolute inset-0 z-50 bg-black/90 p-8 overflow-auto font-mono text-xs text-green-400">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">DEBUG MODE</h2>
                        <button onClick={() => setDebugMode(false)} className="px-4 py-2 bg-red-600 text-white rounded">FECHAR</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="border border-white/20 p-4 rounded">
                            <h3 className="text-white font-bold mb-2">Current State</h3>
                            <pre>{JSON.stringify({ clienteId, isBonificacao, tabelaPreco, condicaoPagamento, itensCount: itens.length }, null, 2)}</pre>
                        </div>
                        <div className="border border-white/20 p-4 rounded">
                            <h3 className="text-white font-bold mb-2">Last Error</h3>
                            <pre className="text-red-400">{lastError || 'None'}</pre>
                            <h3 className="text-white font-bold mt-4 mb-2">Last Payload</h3>
                            <pre>{JSON.stringify(lastPayload, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setDebugMode(!debugMode)}
                className="fixed bottom-4 left-4 z-40 p-2 bg-gray-800 text-gray-500 rounded-full hover:text-white text-[10px]"
                title="Toggle Debug"
            >
                🐛
            </button>

            {/* Coluna Esquerda - Catálogo de Produtos */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/pedidos" className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Editar Pedido #{params.id.slice(-6)}</h1>
                            <p className="text-xs text-gray-500">Modifique os itens abaixo</p>
                        </div>
                    </div>
                </div>

                {/* Busca de Produtos */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        placeholder="Buscar produto por nome ou código..."
                        className="input-compact pl-10 w-full"
                    />
                </div>

                {/* Lista de Produtos por Fábrica */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                    {Object.keys(productsByFabrica).length > 0 ? (
                        Object.entries(productsByFabrica).sort((a, b) => {
                            // Ordenar por nome da fábrica
                            const nomeA = a[0] === 'sem-fabrica' ? 'Outros' : getFabricaNome(a[0]);
                            const nomeB = b[0] === 'sem-fabrica' ? 'Outros' : getFabricaNome(b[0]);
                            if (a[0] === 'sem-fabrica') return 1;
                            if (b[0] === 'sem-fabrica') return -1;
                            return nomeA.localeCompare(nomeB);
                        }).map(([fabricaId, groupProducts]) => (
                            <div key={fabricaId} className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Factory className="h-4 w-4 text-blue-400" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                        {fabricaId === 'sem-fabrica' ? 'Outros' : getFabricaNome(fabricaId)}
                                    </h3>
                                    <div className="h-px flex-1 bg-white/10 ml-4"></div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {groupProducts.map((product, index) => {
                                        const preco = getPrecoCliente(product);
                                        const isInCart = itens.some(i => i.produtoId === product.id);

                                        return (
                                            <motion.button
                                                key={product.id}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                                onClick={() => addItem(product)}
                                                className={`relative group p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${isInCart
                                                    ? 'border-green-500/50 bg-green-500/10'
                                                    : 'border-white/10 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5'
                                                    }`}
                                            >
                                                {/* Badge no carrinho */}
                                                {isInCart && (
                                                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center z-10 shadow-lg shadow-green-500/20">
                                                        <span className="text-[10px] font-bold text-white">
                                                            {itens.find(i => i.produtoId === product.id)?.quantidade}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-start gap-3">
                                                    {/* Imagem/Ícone */}
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${isInCart ? 'bg-green-500/20' : 'bg-white/5'}`}>
                                                        {product.imagem ? (
                                                            <>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={product.imagem} alt={product.nome} className="w-full h-full object-cover" />
                                                            </>
                                                        ) : (
                                                            <Package className={`h-5 w-5 ${isInCart ? 'text-green-400' : 'text-gray-400'}`} />
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-[10px] text-gray-500 font-mono">{product.codigo}</p>
                                                            {isInCart && <Check className="h-3 w-3 text-green-400" />}
                                                        </div>
                                                        <p className="text-xs font-medium text-white truncate my-0.5" title={product.nome}>{product.nome}</p>
                                                        <p className="text-sm font-bold text-green-400">
                                                            R$ {preco.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Overlay de adicionar */}
                                                <div className="absolute inset-0 rounded-xl bg-blue-600/0 group-hover:bg-blue-600/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                                                    <Plus className="h-6 w-6 text-blue-400 drop-shadow-lg" />
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhum produto encontrado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Direita - Carrinho */}
            <div className="w-96 flex flex-col bg-white/5 rounded-2xl border border-white/10 overflow-hidden">

                {/* Header do Carrinho */}
                <div className="p-4 border-b border-white/10 bg-gradient-to-r from-orange-600/20 to-amber-600/20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/10">
                                <ShoppingCart className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white">Editando Pedido</h2>
                                <p className="text-xs text-gray-400">{totalItens} itens</p>
                            </div>
                        </div>
                    </div>
                    {/* Order Type Selector */}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setIsBonificacao(false)}
                            className={`flex-1 py-1.5 px-3 rounded-md text-[10px] font-bold uppercase transition-all ${!isBonificacao ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                            Venda
                        </button>
                        <button
                            onClick={() => setIsBonificacao(true)}
                            className={`flex-1 py-1.5 px-3 rounded-md text-[10px] font-bold uppercase transition-all ${isBonificacao ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                            Bonificação
                        </button>
                    </div>
                </div>

                {/* Seletor de Cliente */}
                <div className="p-4 border-b border-white/10">
                    <label className="text-xs text-gray-400 mb-1 block">Cliente</label>
                    {clienteSelecionado ? (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div className="p-1.5 rounded-lg bg-green-500/20">
                                <User className="h-4 w-4 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{clienteSelecionado.nomeFantasia || clienteSelecionado.razaoSocial}</p>
                                <p className="text-[10px] text-gray-400">
                                    Tabela: {clienteSelecionado.tabelaPreco || '50a199'}
                                </p>
                            </div>
                            <button
                                onClick={() => setClienteId('')}
                                className="text-gray-400 hover:text-white"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchClient}
                                    onChange={(e) => setSearchClient(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="input-compact pl-7 w-full text-sm"
                                />
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {filteredClients.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setClienteId(c.id); setSearchClient(''); }}
                                        className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-sm text-gray-300 hover:text-white transition-colors"
                                    >
                                        {c.nomeFantasia || c.razaoSocial}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Lista de Itens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <AnimatePresence>
                        {itens.map((item, index) => (
                            <motion.div
                                key={item.produtoId}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{item.nomeProduto}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <label className="text-[10px] text-gray-500">R$ Unit:</label>
                                            <input
                                                type="number"
                                                value={item.precoUnitario}
                                                onChange={(e) => updatePrecoItem(index, parseFloat(e.target.value))}
                                                className="w-20 bg-black/20 border border-white/10 rounded px-1 py-0.5 text-xs text-yellow-400 font-mono focus:border-yellow-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="text-[10px] text-red-400 hover:text-red-300 p-1"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                    <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
                                        <button
                                            onClick={() => updateQuantidade(index, -1)}
                                            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white"
                                        >
                                            -
                                        </button>
                                        <span className="w-8 text-center text-sm font-bold text-white">{item.quantidade}</span>
                                        <button
                                            onClick={() => updateQuantidade(index, 1)}
                                            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <p className="text-sm font-bold text-green-400">R$ {item.total.toFixed(2)}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {itens.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Clique nos produtos para adicionar</p>
                        </div>
                    )}
                </div>

                {/* Observações */}
                <div className="px-4 pb-2">
                    <input
                        type="text"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        placeholder="Observações do pedido..."
                        className="input-compact w-full text-sm"
                    />
                </div>

                {/* Footer - Total e Salvar */}
                <div className="p-4 border-t border-white/10 bg-gradient-to-r from-orange-600/10 to-amber-600/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400">Total</span>
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-400" />
                            <span className="text-2xl font-bold text-white">
                                {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!clienteId || itens.length === 0}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2 hover:from-orange-500 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/30"
                    >
                        <Save className="h-4 w-4" />
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}
