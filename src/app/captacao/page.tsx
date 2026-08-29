'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Minus, ShoppingCart, CheckCircle, LogOut, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Cliente = { id: string; razaoSocial: string; nomeFantasia: string; cnpj: string };
type Produto = { id: string; nome: string; precoUnitario: string | number };

export default function CaptacaoPage() {
  const { usuario, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tabelaCliente, setTabelaCliente] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [error, setError] = useState('');

  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [cart, setCart] = useState<{ [produtoId: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !usuario) {
      router.push('/');
    }
  }, [usuario, authLoading, router]);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch('/api/captacao');
        if (!res.ok) throw new Error('Falha ao carregar dados');
        const data = await res.json();
        setClientes(data.clientes || []);
      } catch (err) {
        setError('Erro ao carregar clientes do sistema.');
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  useEffect(() => {
    if (!selectedCliente) {
      setProdutos([]);
      setTabelaCliente('');
      setCart({});
      return;
    }

    const fetchProdutos = async () => {
      setLoadingProdutos(true);
      try {
        const res = await fetch(`/api/captacao?clienteId=${selectedCliente}`);
        if (!res.ok) throw new Error('Falha ao carregar produtos');
        const data = await res.json();
        setProdutos(data.produtos || []);
        setTabelaCliente(data.tabela || '');
        setCart({}); // Limpa o carrinho ao trocar de cliente
      } catch (err) {
        setError('Erro ao carregar tabela de preços.');
      } finally {
        setLoadingProdutos(false);
      }
    };

    fetchProdutos();
  }, [selectedCliente]);

  const handleUpdateQuantity = (produtoId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[produtoId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[produtoId];
      } else {
        newCart[produtoId] = next;
      }
      return newCart;
    });
  };

  const valorTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [produtoId, quantidade]) => {
      const produto = produtos.find((p) => p.id === produtoId);
      const preco = produto ? Number(produto.precoUnitario) : 0;
      return acc + preco * quantidade;
    }, 0);
  }, [cart, produtos]);

  const totalItems = useMemo(() => {
    return Object.values(cart).reduce((acc, q) => acc + q, 0);
  }, [cart]);

  const handleSubmit = async () => {
    if (!selectedCliente) {
      setError('Selecione um cliente antes de enviar o pedido.');
      return;
    }
    if (totalItems === 0) {
      setError('Adicione pelo menos um produto ao pedido.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const itens = Object.entries(cart).map(([produtoId, quantidade]) => {
        const produto = produtos.find((p) => p.id === produtoId);
        return {
          produtoId,
          quantidade,
          precoUnitario: produto ? Number(produto.precoUnitario) : 0
        };
      });

      const res = await fetch('/api/captacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: selectedCliente,
          itens,
          valorTotal
        })
      });

      if (!res.ok) throw new Error('Falha ao enviar pedido');

      setCart({});
      setSelectedCliente('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError('Ocorreu um erro ao enviar o pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <Package className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Novo Pré-Pedido</h1>
              <p className="text-xs text-gray-400">Vendedor: {usuario.nome}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        {/* Success Message */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-500/20 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3"
            >
              <CheckCircle className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Sucesso!</p>
                <p className="text-sm">Pedido enviado para análise na fábrica.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Client Selection */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            1. Selecione o Cliente
          </h2>
          <select
            value={selectedCliente}
            onChange={(e) => setSelectedCliente(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          >
            <option value="">-- Selecione --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial} {c.nomeFantasia ? `(${c.nomeFantasia})` : ''} - {c.cnpj}
              </option>
            ))}
          </select>
          {clientes.length === 0 && (
            <p className="text-xs text-yellow-500 mt-2">
              Você não possui clientes vinculados à sua carteira.
            </p>
          )}
        </section>

        {/* Product List */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider flex justify-between items-center">
            <span>2. Produtos</span>
            {selectedCliente && !loadingProdutos && (
              <span className="text-xs bg-blue-600/20 text-blue-400 py-1 px-2 rounded-full">
                {produtos.length} itens (Tabela: {tabelaCliente})
              </span>
            )}
          </h2>
          
          {!selectedCliente ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium">Selecione um cliente acima para carregar a tabela de preços.</p>
            </div>
          ) : loadingProdutos ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
              <p className="text-gray-500">Carregando tabela de preços do cliente...</p>
            </div>
          ) : produtos.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Nenhum produto disponível.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {produtos.map((produto) => {
                const qty = cart[produto.id] || 0;
                const preco = Number(produto.precoUnitario);
                
                return (
                  <div
                    key={produto.id}
                    className={`flex flex-col p-4 rounded-xl border transition-all ${
                      qty > 0 
                        ? 'bg-blue-600/10 border-blue-500/30' 
                        : 'bg-black/40 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex-1 mb-3">
                      <h3 className="font-medium text-gray-200 line-clamp-2">{produto.nome}</h3>
                      <p className="text-blue-400 font-semibold mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco)}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-sm text-gray-500">
                        {qty > 0 ? `Subtotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco * qty)}` : ' '}
                      </span>
                      
                      <div className="flex items-center gap-3 bg-black/60 rounded-lg p-1 border border-white/10">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(produto.id, -1)}
                          disabled={qty === 0}
                          className="p-2 rounded-md hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        
                        <span className="w-6 text-center font-semibold text-white">
                          {qty}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(produto.id, 1)}
                          className="p-2 rounded-md hover:bg-white/10 text-gray-300 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Fixed Bottom Cart Panel (adjusted for bottom navbar) */}
      <div className="fixed bottom-[64px] left-0 right-0 z-40 bg-black border-t border-white/10 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Total do Pedido
            </span>
            <span className="text-xl md:text-2xl font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
            </span>
            <span className="text-xs text-blue-400">
              {totalItems} {totalItems === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || totalItems === 0 || !selectedCliente}
            className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 md:p-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)]"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden sm:inline">ENVIAR PEDIDO</span>
                <span className="sm:hidden">ENVIAR</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
