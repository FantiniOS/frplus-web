'use client';

import Link from "next/link";
import { ArrowLeft, Save, User, Search, Factory } from "lucide-react";
import { useData, Order, OrderItem } from "@/contexts/DataContext";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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

    // --- Lógica de Histórico de Preços ---
    const [priceHistory, setPriceHistory] = useState<Record<string, number>>({});

    const fetchPriceHistory = async (clientId: string) => {
        try {
            const res = await fetch(`/api/clients/${clientId}/product-history`);
            if (res.ok) {
                const history = await res.json();
                setPriceHistory(history);
            }
        } catch (error) {
            console.error("Error fetching price history:", error);
        }
    };

    // --- Lógica de Cliente ---
    const handleSelectClient = (id: string) => {
        setClienteId(id);
        fetchPriceHistory(id); // Fetch history when client is selected
        setStep('order');
    };

    // ... (rest of code)

    // Inside Render (Product List Row)
    const item = itens.find(i => i.produtoId === product.id);
    const qtd = item?.quantidade || 0;
    const preco = getPrecoCliente(product);
    const lastPrice = priceHistory[product.id]; // Get last price

    return (
        <tr
            key={product.id}
            className={`
                                                group transition-colors 
                                                ${qtd > 0 ? 'bg-blue-900/20' : 'even:bg-gray-800/30 hover:bg-gray-800'}
                                            `}
        >
            <td className="px-3 py-1.5 text-xs text-gray-500 font-mono border-r border-gray-800/50">{product.codigo}</td>
            <td className="px-3 py-1.5 text-sm font-medium text-gray-200 border-r border-gray-800/50">
                <div className="line-clamp-2">{product.nome}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    {lastPrice && (
                        <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1 rounded" title="Último preço pago por este cliente">
                            Últ. Pagto: {lastPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    )}
                </div>
                <div className="sm:hidden text-xs text-green-400 font-bold mt-1">
                    {qtd > 0 && (qtd * preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
            </td>
            <td className="px-3 py-1.5 text-xs text-gray-500 border-r border-gray-800/50 truncate max-w-[100px] hidden sm:table-cell">{product.categoria || '-'}</td>
            <td className="px-3 py-1.5 text-sm text-gray-400 text-right border-r border-gray-800/50">
                {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>

            {/* Painel Direito: Configurações do Pedido (SIMPLIFICADO) */}
            <div className="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col order-1 lg:order-2 max-h-[250px] lg:max-h-none overflow-y-auto">
                <div className="p-4 space-y-4">
                    {/* Info Cliente (Read-Only) */}
                    <div className="space-y-2 hidden lg:block">
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
                                <option value="preco200a699">200 a 699</option>
                                <option value="atacado">Atacado</option>
                                <option value="atacadoAVista">Atacado à Vista</option>
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

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Emissão</label>
                            <input
                                type="date"
                                value={dataPedido}
                                onChange={(e) => setDataPedido(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 outline-none text-white"
                            />
                        </div>

                        <div className="space-y-1 lg:hidden">
                            <label className="text-xs uppercase font-bold text-gray-500">Itens/Total</label>
                            <div className="bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1.5 text-white flex justify-between">
                                <span>{totalItens} itens</span>
                                <span className="font-bold text-green-400">R$ {valorTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 hidden lg:block">
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

                <div className="mt-auto p-4 bg-gray-800/50 border-t border-gray-700 hidden lg:block">
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
        </div >
    );
}
