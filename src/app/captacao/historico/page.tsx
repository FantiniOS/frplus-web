'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, PackageSearch, ChevronDown, ChevronUp, Calendar, User, DollarSign, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Produto = { id: string; nome: string; codigo: string; unidade: string | null };
type ItemPedido = { id: string; quantidade: number; precoUnitario: string | number; produto: Produto };
type Cliente = { id: string; razaoSocial: string; nomeFantasia: string; cnpj: string };
type Pedido = {
  id: string;
  data: string;
  status: string;
  motivoRejeicao?: string | null;
  valorTotal: string | number;
  cliente: Cliente;
  itens: ItemPedido[];
  createdAt: string;
};

export default function HistoricoPedidosPage() {
  const { usuario, logout, loading: authLoading } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const res = await fetch('/api/vendedor/pedidos');
        if (!res.ok) throw new Error('Falha ao carregar histórico');
        const data = await res.json();
        setPedidos(data.pedidos || []);
      } catch (err) {
        setError('Erro ao carregar o histórico de pedidos.');
      } finally {
        setLoading(false);
      }
    };

    if (usuario) {
      fetchPedidos();
    }
  }, [usuario]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDENTE':
        return <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pendente</span>;
      case 'ENVIADO_FABRICA':
      case 'ENVIADO À FÁBRICA':
      case 'APROVADO':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Aprovado</span>;
      case 'REJEITADO':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Rejeitado</span>;
      case 'CONCLUIDO':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Concluído</span>;
      case 'CANCELADO':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Cancelado</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <PackageSearch className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Meus Pedidos</h1>
              <p className="text-xs text-gray-400">Histórico de envios</p>
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

      <main className="max-w-4xl mx-auto p-4 mt-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {pedidos.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border border-white/10 rounded-2xl">
            <PackageSearch className="h-16 w-16 text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-300">Nenhum pedido encontrado</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-xs">
              Você ainda não enviou nenhum pedido. Eles aparecerão aqui quando você finalizar a captação.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20">
                {/* Card Header (Always visible) */}
                <div className="p-4 sm:p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(pedido.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    {getStatusBadge(pedido.status)}
                  </div>

                  {pedido.status === 'REJEITADO' && pedido.motivoRejeicao && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                      <strong>Motivo da Rejeição:</strong> {pedido.motivoRejeicao}
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-white/10 p-2 rounded-lg mt-1">
                      <User className="h-5 w-5 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-200">{pedido.cliente.razaoSocial}</h3>
                      {pedido.cliente.nomeFantasia && (
                        <p className="text-xs text-gray-400">{pedido.cliente.nomeFantasia}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">CNPJ: {pedido.cliente.cnpj}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Valor Total</span>
                      <div className="flex items-center gap-1 text-blue-400 font-bold text-lg">
                        <DollarSign className="h-4 w-4" />
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pedido.valorTotal))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleExpand(pedido.id)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                    >
                      {expandedId === pedido.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                      {expandedId === pedido.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Card Expanded Content (Accordion) */}
                <AnimatePresence>
                  {expandedId === pedido.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/40 border-t border-white/10"
                    >
                      <div className="p-4 sm:p-5">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Itens do Pedido ({pedido.itens.length})
                        </h4>
                        <div className="space-y-3">
                          {pedido.itens.map((item) => (
                            <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                              <div className="flex-1 pr-4">
                                <p className="text-sm font-medium text-gray-200 line-clamp-1">{item.produto.nome}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.quantidade} {item.produto.unidade || 'UN'} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.precoUnitario))}
                                </p>
                              </div>
                              <div className="text-sm font-semibold text-gray-300 whitespace-nowrap">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * Number(item.precoUnitario))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
