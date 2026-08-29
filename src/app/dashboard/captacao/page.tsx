'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Check, Loader2, PackageSearch, RefreshCw } from 'lucide-react';

type Produto = { nome: string; unidade: string | null };
type ItemPedido = { id: string; quantidade: number; precoUnitario: string | number; produto: Produto };
type PrePedido = {
  id: string;
  data: string;
  createdAt: string;
  status: string;
  valorTotal: string | number;
  cliente: { razaoSocial: string; nomeFantasia: string; cnpj: string };
  vendedor: { nome: string };
  itens: ItemPedido[];
};

export default function AdminCaptacaoPage() {
  const [pedidos, setPedidos] = useState<PrePedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pre-pedidos');
      if (!res.ok) throw new Error('Falha ao buscar pedidos');
      const data = await res.json();
      setPedidos(data.pedidos || []);
      setError('');
    } catch (err) {
      setError('Erro ao carregar pré-pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

  const handleUpdateStatus = async (id: string, novoStatus: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/pre-pedidos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus })
      });

      if (!res.ok) throw new Error('Falha ao atualizar status');

      // Update local state
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p))
      );
    } catch (err) {
      alert('Erro ao atualizar o status do pedido.');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDENTE') {
      return <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pendente</span>;
    }
    if (status === 'ENVIADO_FABRICA') {
      return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Enviado à Fábrica</span>;
    }
    return <span className="bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/20">
            <PackageSearch className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Central de Captação</h1>
            <p className="text-gray-400 text-sm mt-1">
              Revise e gerencie os pré-pedidos enviados pelos vendedores.
            </p>
          </div>
        </div>
        <button
          onClick={fetchPedidos}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Tabela Desktop & Mobile Cards */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/40 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Data / Vendedor</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Valor Total</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-500 mt-2">Carregando pedidos...</p>
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum pré-pedido encontrado.
                  </td>
                </tr>
              ) : (
                pedidos.map((pedido) => (
                  <React.Fragment key={pedido.id}>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">
                          {format(new Date(pedido.createdAt), "dd/MM/yyyy HH:mm")}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">{pedido.vendedor.nome}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{pedido.cliente.razaoSocial}</div>
                        <div className="text-gray-500 text-xs mt-1">CNPJ: {pedido.cliente.cnpj}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pedido.valorTotal))}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(pedido.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {pedido.status === 'PENDENTE' && (
                            <button
                              onClick={() => handleUpdateStatus(pedido.id, 'ENVIADO_FABRICA')}
                              disabled={updating === pedido.id}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {updating === pedido.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4" /> Enviar
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === pedido.id ? null : pedido.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                          >
                            {expandedId === pedido.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Row */}
                    {expandedId === pedido.id && (
                      <tr className="bg-black/20">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Itens do Pedido</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {pedido.itens.map((item) => (
                                <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                  <div className="overflow-hidden mr-3">
                                    <p className="text-sm font-medium text-gray-200 truncate" title={item.produto.nome}>
                                      {item.produto.nome}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {item.quantidade} {item.produto.unidade || 'UN'} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.precoUnitario))}
                                    </p>
                                  </div>
                                  <span className="text-sm font-bold text-gray-300">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.precoUnitario) * item.quantidade)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
