'use client';

import Link from "next/link";
import { ArrowLeft, Save, User, Search, Factory } from "lucide-react";
import { useData, Order, OrderItem } from "@/contexts/DataContext";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function NovoPedidoPage() {
    const { clients, products, addOrder, showToast, fabricas } = useData();
    const router = useRouter();

    // Estado do fluxo
    const [step, setStep] = useState<'factory' | 'client' | 'order'>('factory');
    const [selectedFabricaId, setSelectedFabricaId] = useState('');

    // Estados do Pedido
    const [clienteId, setClienteId] = useState('');
    const [searchClient, setSearchClient] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [itens, setItens] = useState<OrderItem[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
    const [tabelaPreco, setTabelaPreco] = useState('preco50a199');
    const [condicaoPagamento, setCondicaoPagamento] = useState('30 dias');
    const [selectedCategoria, setSelectedCategoria] = useState('all');

    // --- Lógica de Fábrica ---
    const handleSelectFabrica = (id: string) => {
        setSelectedFabricaId(id);
        setStep('client');
        setItens([]); // Limpa itens se mudar fábrica (regra de negócio)
    };

    const fabricaSelecionada = fabricas.find(f => f.id === selectedFabricaId);

    // --- Lógica de Cliente ---
    const handleSelectClient = (id: string) => {
        setClienteId(id);
        setStep('order');
    };

    const clienteSelecionado = clients.find(c => c.id === clienteId);

    const filteredClients = useMemo(() => {
        if (!searchClient) return clients;
        return clients.filter(c =>
            (c.nomeFantasia || c.razaoSocial || '').toLowerCase().includes(searchClient.toLowerCase()) ||
            c.cnpj.includes(searchClient) ||
            (c.cidade || '').toLowerCase().includes(searchClient.toLowerCase())
        );
    }, [clients, searchClient]);

    // --- Lógica de Dados (Produtos) ---
    // Strict Filtering: Apenas produtos da fábrica selecionada
    const filteredProducts = useMemo(() => {
        if (step !== 'order') return [];

        // 1. Filtro Absoluto de Fábrica
        let result = products.filter(p => p.fabricaId === selectedFabricaId);

        // 2. Filtro de Texto
        if (searchProduct) {
            const term = searchProduct.toLowerCase();
            result = result.filter(p =>
                p.nome.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term)
            );
        }

        // 3. Filtro de Categoria
        if (selectedCategoria !== 'all') {
            result = result.filter(p => (p.categoria || 'Geral') === selectedCategoria);
        }

        return result;
    }, [products, searchProduct, selectedFabricaId, selectedCategoria, step]);

    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        products
            .filter(p => p.fabricaId === selectedFabricaId)
            .forEach(p => cats.add(p.categoria || 'Geral'));
        return Array.from(cats).sort();
    }, [products, selectedFabricaId]);

    // --- Helpers de Preço ---
    const getPrecoForTable = (product: typeof products[0], tabela: string) => {
        switch (tabela) {
            case '200a699': return Number(product.preco200a699);
            case 'atacado': return Number(product.precoAtacado);
            case 'atacadoAVista': return Number(product.precoAtacadoAVista);
            case 'redes': return Number(product.precoRedes);
            default: return Number(product.preco50a199);
        }
    };

    const getPrecoCliente = (product: typeof products[0]) => getPrecoForTable(product, tabelaPreco);

    // --- Manipulação do Pedido ---
    const handleTabelaChange = (novaTabela: string) => {
        setTabelaPreco(novaTabela);
        setItens(prev => prev.map(item => {
            const product = products.find(p => p.id === item.produtoId);
            if (!product) return item;
            const newPrice = getPrecoForTable(product, novaTabela);
            return { ...item, precoUnitario: newPrice, total: newPrice * item.quantidade };
        }));
    };

    const setQuantidade = (produtoId: string, quantidade: number, product: typeof products[0]) => {
        const preco = getPrecoCliente(product);
        if (quantidade <= 0) {
            setItens(prev => prev.filter(i => i.produtoId !== produtoId));
            return;
        }

        setItens(prev => {
            const exists = prev.find(i => i.produtoId === produtoId);
            if (exists) {
                return prev.map(i => i.produtoId === produtoId ? { ...i, quantidade, total: quantidade * preco } : i);
            }
            return [...prev, {
                produtoId,
                nomeProduto: product.nome,
                quantidade,
                precoUnitario: preco,
                total: quantidade * preco
            }];
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextInput = document.getElementById(`qtd-${index + 1}`);
            nextInput?.focus();
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevInput = document.getElementById(`qtd-${index - 1}`);
            prevInput?.focus();
        }
    };

    const valorTotal = itens.reduce((acc, item) => acc + item.total, 0);
    const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

    const handleSubmit = () => {
        if (!clienteId) return showToast("Selecione um cliente", "error");
        if (itens.length === 0) return showToast("Adicione produtos", "error");

        addOrder({
            clienteId,
            fabricaId: selectedFabricaId,
            nomeCliente: clienteSelecionado?.nomeFantasia || '',
            data: new Date(dataPedido + 'T12:00:00').toISOString(),
            itens,
            valorTotal,
            observacoes,
            status: 'Pendente',
            tabelaPreco,
            condicaoPagamento
        });
        router.push('/dashboard/pedidos');
    };

    // --- RENDER ---

    // TELA 1: SELEÇÃO DE FÁBRICA
    if (step === 'factory') {
        return (
            <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <h1 className="text-3xl font-bold text-white mb-2">Novo Pedido</h1>
                <p className="text-gray-400 mb-8">Passo 1: Selecione a Representada</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl px-4">
                    {fabricas.map(f => (
                        <button
                            key={f.id}
                            onClick={() => handleSelectFabrica(f.id)}
                            className="bg-white/5 border border-white/10 hover:bg-blue-600/20 hover:border-blue-500 p-8 rounded-xl transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:to-blue-500/10 transition-all" />
                            <Factory className="h-8 w-8 text-gray-400 group-hover:text-blue-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-1 relative z-10">{f.nome}</h3>
                            <p className="text-sm text-gray-500 group-hover:text-gray-300 relative z-10">
                                {products.filter(p => p.fabricaId === f.id).length} produtos
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // TELA 2: SELEÇÃO DE CLIENTE
    if (step === 'client') {
        return (
            <div className="h-[calc(100vh-100px)] flex flex-col items-center animate-in slide-in-from-right duration-300">
                <div className="w-full max-w-5xl px-4 pt-8 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Selecione o Cliente</h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Factory className="h-3 w-3" />
                                Pedido para: <span className="text-blue-400">{fabricaSelecionada?.nome}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setStep('factory')}
                            className="text-gray-400 hover:text-white flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>
                    </div>

                    {/* Busca Grande */}
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <input
                            autoFocus
                            type="text"
                            value={searchClient}
                            onChange={(e) => setSearchClient(e.target.value)}
                            placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ ou Cidade..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl text-lg px-12 py-4 focus:border-blue-500 outline-none text-white shadow-lg"
                        />
                    </div>

                    {/* Lista de Clientes */}
                    <div className="flex-1 overflow-y-auto bg-gray-900/50 border border-gray-800 rounded-xl shadow-inner scrollbar-thin scrollbar-thumb-gray-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-800/50 sticky top-0 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Cliente / Razão Social</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">CNPJ</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Cidade/UF</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filteredClients.map(client => (
                                    <tr
                                        key={client.id}
                                        className="hover:bg-blue-600/10 transition-colors group cursor-pointer"
                                        onClick={() => handleSelectClient(client.id)}
                                    >
                                        <td className="p-4">
                                            <div className="font-bold text-white group-hover:text-blue-300">{client.nomeFantasia}</div>
                                            <div className="text-xs text-gray-500">{client.razaoSocial}</div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400 font-mono">{client.cnpj}</td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {client.cidade} <span className="text-gray-600 text-xs">/ {client.estado}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="bg-blue-600/20 text-blue-400 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowLeft className="h-4 w-4 rotate-180" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredClients.length === 0 && (
                            <div className="p-12 text-center text-gray-500">
                                <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Nenhum cliente encontrado com &quot;{searchClient}&quot;</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // TELA 3: PEDIDO (ERP MODE)
    return (
        <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-900 text-white animate-in slide-in-from-right duration-300">
            {/* Top Bar: Fábrica e Ações */}
            <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 sticky top-0 z-20 shadow-md">
                <div className="flex items-center gap-4">
                    <button onClick={() => setStep('client')} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-medium">
                        <ArrowLeft className="h-4 w-4" />
                        Trocar Cliente
                    </button>
                    <div className="h-6 w-px bg-gray-600 mx-2" />
                    <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-blue-400" />
                        <span className="font-bold text-lg">{fabricaSelecionada?.nome}</span>
                    </div>
                    <div className="h-6 w-px bg-gray-600 mx-2" />
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-300">{clienteSelecionado?.nomeFantasia}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase">Total do Pedido</p>
                        <p className="text-xl font-bold text-green-400 leading-none">
                            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={itens.length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        FINALIZAR (F2)
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Painel Esquerdo: Lista de Produtos (ERP Grid) */}
                <div className="flex-1 flex flex-col border-r border-gray-700">
                    {/* Barra de Filtros Compacta */}
                    <div className="bg-gray-800 p-2 flex gap-2 border-b border-gray-700">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                autoFocus
                                type="text"
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                placeholder={`Buscar produto em ${fabricaSelecionada?.nome}...`}
                                className="w-full bg-gray-900 border border-gray-600 rounded text-sm px-8 py-1 focus:border-blue-500 outline-none text-white h-8"
                            />
                        </div>
                        <select
                            value={selectedCategoria}
                            onChange={(e) => setSelectedCategoria(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded text-sm px-3 py-1 outline-none text-white h-8 w-48"
                        >
                            <option value="all">Todas Categorias</option>
                            {availableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Grid de Dados */}
                    <div className="flex-1 overflow-auto bg-gray-900">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-800 text-xs text-gray-400 uppercase font-semibold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 border-b border-gray-700 w-20">Cód</th>
                                    <th className="px-3 py-2 border-b border-gray-700">Produto</th>
                                    <th className="px-3 py-2 border-b border-gray-700 w-32">Categ.</th>
                                    <th className="px-3 py-2 border-b border-gray-700 w-28 text-right">Preço</th>
                                    <th className="px-3 py-2 border-b border-gray-700 w-24 text-center bg-gray-700/50">Qtd.</th>
                                    <th className="px-3 py-2 border-b border-gray-700 w-32 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filteredProducts.map((product, index) => {
                                    const item = itens.find(i => i.produtoId === product.id);
                                    const qtd = item?.quantidade || 0;
                                    const preco = getPrecoCliente(product);

                                    return (
                                        <tr
                                            key={product.id}
                                            className={`
                                                group transition-colors 
                                                ${qtd > 0 ? 'bg-blue-900/20' : 'even:bg-gray-800/30 hover:bg-gray-800'}
                                            `}
                                        >
                                            <td className="px-3 py-1.5 text-xs text-gray-500 font-mono border-r border-gray-800/50">{product.codigo}</td>
                                            <td className="px-3 py-1.5 text-sm font-medium text-gray-200 border-r border-gray-800/50">{product.nome}</td>
                                            <td className="px-3 py-1.5 text-xs text-gray-500 border-r border-gray-800/50 truncate max-w-[100px]">{product.categoria || '-'}</td>
                                            <td className="px-3 py-1.5 text-sm text-gray-400 text-right border-r border-gray-800/50">
                                                {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-1 py-1 text-center border-r border-gray-800/50 bg-gray-800/20">
                                                <input
                                                    id={`qtd-${index}`}
                                                    type="number"
                                                    min="0"
                                                    value={qtd || ''}
                                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                                    onChange={(e) => setQuantidade(product.id, Number(e.target.value), product)}
                                                    className={`
                                                        w-full text-center bg-transparent outline-none font-bold text-sm
                                                        ${qtd > 0 ? 'text-blue-400' : 'text-gray-600 focus:text-white'}
                                                    `}
                                                    placeholder="-"
                                                />
                                            </td>
                                            <td className="px-3 py-1.5 text-sm text-right">
                                                {qtd > 0 ? (
                                                    <span className="text-green-400 font-bold">{(qtd * preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                ) : <span className="text-gray-700">-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="p-8 text-center text-gray-500">Nenhum produto encontrado.</div>
                        )}
                    </div>
                </div>

                {/* Painel Direito: Configurações do Pedido (SIMPLIFICADO) */}
                <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
                    <div className="p-4 space-y-6">
                        {/* Info Cliente (Read-Only) */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-500">Cliente Selecionado</label>
                            <div className="bg-gray-800 border-l-4 border-blue-500 p-3 rounded">
                                <div className="font-bold text-white leading-tight">{clienteSelecionado?.nomeFantasia}</div>
                                <div className="text-xs text-gray-400 mt-1">{clienteSelecionado?.cnpj}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{clienteSelecionado?.cidade}/{clienteSelecionado?.estado}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs uppercase font-bold text-gray-500">Tabela</label>
                                <select
                                    value={tabelaPreco}
                                    onChange={(e) => handleTabelaChange(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 outline-none text-white"
                                >
                                    <option value="preco50a199">Padrão</option>
                                    <option value="atacado">Atacado</option>
                                    <option value="redes">Redes</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs uppercase font-bold text-gray-500">Pagto.</label>
                                <select
                                    value={condicaoPagamento}
                                    onChange={(e) => setCondicaoPagamento(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 outline-none text-white"
                                >
                                    <option>A Vista</option>
                                    <option>30 Dias</option>
                                    <option>30/60 Dias</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Data de Emissão</label>
                            <input
                                type="date"
                                value={dataPedido}
                                onChange={(e) => setDataPedido(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 outline-none text-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Observações</label>
                            <textarea
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                rows={4}
                                className="w-full bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 outline-none text-white resize-none"
                                placeholder="..."
                            />
                        </div>
                    </div>

                    <div className="mt-auto p-4 bg-gray-800/50 border-t border-gray-700">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Itens</span>
                            <span className="text-white font-mono">{totalItens}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold mb-4">
                            <span className="text-gray-400">Total</span>
                            <span className="text-green-400">{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
