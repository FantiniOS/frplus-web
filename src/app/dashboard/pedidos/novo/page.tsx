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

    const [clienteId, setClienteId] = useState('');
    const [searchClient, setSearchClient] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [itens, setItens] = useState<OrderItem[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
    const [tabelaPreco, setTabelaPreco] = useState('preco50a199');
    const [condicaoPagamento, setCondicaoPagamento] = useState('30 dias');

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
        switch (tabela) {
            case '200a699': return product.preco200a699;
            case 'atacado': return product.precoAtacado;
            case 'atacadoAVista': return product.precoAtacadoAVista;
            case 'redes': return product.precoRedes;
            default: return product.preco50a199;
        }
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

            {/* Coluna Esquerda - Catálogo de Produtos */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/pedidos" className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Novo Pedido</h1>
                            <p className="text-xs text-gray-500">Selecione os produtos abaixo</p>
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

                {/* Grid de Produtos */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Lista de Produtos por Fábrica */}
                    <div className="space-y-8">
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
                                                    className={`relative group p-2 rounded-xl border text-left transition-all hover:scale-[1.02] ${isInCart
                                                        ? 'border-green-500/50 bg-green-500/10'
                                                        : 'border-white/10 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5'
                                                        }`}
                                                >
                                                    {/* Badge no carrinho */}
                                                    {isInCart && (
                                                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center z-10 shadow-lg shadow-green-500/20">
                                                            <span className="text-[9px] font-bold text-white">
                                                                {itens.find(i => i.produtoId === product.id)?.quantidade}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-start gap-2">
                                                        {/* Imagem/Ícone */}
                                                        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden ${isInCart ? 'bg-green-500/20' : 'bg-white/5'}`}>
                                                            {product.imagem ? (
                                                                <img src={product.imagem} alt={product.nome} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className={`h-4 w-4 ${isInCart ? 'text-green-400' : 'text-gray-400'}`} />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <p className="text-[9px] text-gray-500 font-mono leading-none">{product.codigo}</p>
                                                                {isInCart && <Check className="h-2.5 w-2.5 text-green-400" />}
                                                            </div>
                                                            <p className="text-[10px] font-medium text-white leading-tight my-0.5 line-clamp-2" title={product.nome}>{product.nome}</p>
                                                            <p className="text-sm font-bold text-green-400 leading-none">
                                                                R$ {preco.toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Overlay de adicionar */}
                                                    <div className="absolute inset-0 rounded-xl bg-blue-600/0 group-hover:bg-blue-600/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                                                        <Plus className="h-5 w-5 text-blue-400 drop-shadow-lg" />
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
                        )
                        }
                    </div>
                </div>
            </div>

            {/* Coluna Direita - Carrinho */}
            <div className="w-96 flex flex-col bg-white/5 rounded-2xl border border-white/10 overflow-hidden">

                {/* Header do Carrinho */}
                <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/10">
                            <ShoppingCart className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Carrinho</h2>
                            <p className="text-xs text-gray-400">{totalItens} itens</p>
                        </div>
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
                                <p className="text-sm font-medium text-white truncate">{clienteSelecionado.nome}</p>
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

                {/* Data do Pedido */}
                <div className="px-4 pb-2 border-b border-white/10">
                    <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Data do Pedido
                    </label>
                    <input
                        type="date"
                        value={dataPedido}
                        onChange={(e) => setDataPedido(e.target.value)}
                        className="input-compact w-full text-sm"
                    />
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
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{item.nomeProduto}</p>
                                    <p className="text-xs text-gray-400">R$ {item.precoUnitario.toFixed(2)} un.</p>
                                </div>

                                {/* Controles de quantidade */}
                                <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
                                    <button
                                        onClick={() => updateQuantidade(index, -1)}
                                        className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantidade}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val > 0) {
                                                setQuantidade(index, val);
                                            }
                                        }}
                                        className="w-12 text-center text-sm font-bold text-white bg-transparent border-none focus:ring-0 p-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => updateQuantidade(index, 1)}
                                        className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Total e remover */}
                                < div className="text-right" >
                                    <p className="text-sm font-bold text-green-400">R$ {item.total.toFixed(2)}</p>
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="text-[10px] text-red-400 hover:text-red-300"
                                    >
                                        remover
                                    </button>
                                </div>
                            </div>
                            </motion.div>
                        ))}
                </AnimatePresence>

                {
                    itens.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Clique nos produtos para adicionar</p>
                        </div>
                    )
                }
            </div >

            {/* Observações */}
            < div className="px-4 pb-2" >
                <input
                    type="text"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações do pedido..."
                    className="input-compact w-full text-sm"
                />
            </div >

            {/* Footer - Total e Finalizar */}
            < div className="p-4 border-t border-white/10 bg-gradient-to-r from-green-600/10 to-emerald-600/10" >
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
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30"
                >
                    <Save className="h-4 w-4" />
                    Finalizar Pedido
                </button>
            </div>
        </div>
        </div >
    );
}
