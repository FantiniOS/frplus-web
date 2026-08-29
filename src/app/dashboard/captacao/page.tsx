'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Check, X, Loader2, PackageSearch, RefreshCw } from 'lucide-react';

type Produto = { nome: string; unidade: string | null };
type ItemPedido = { id: string; quantidade: number; precoUnitario: string | number; produto: Produto };
type PrePedido = {
  id: string;
  data: string;
  createdAt: string;
  status: string;
  motivoRejeicao?: string | null;
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

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const handleUpdateStatus = async (id: string, novoStatus: string, motivoRejeicao?: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/pre-pedidos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus, motivoRejeicao })
      });

      if (!res.ok) throw new Error('Falha ao atualizar status');

      // Update local state
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus, motivoRejeicao } : p))
      );
      
      setRejectingId(null);
      setRejectionReason('');
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
    if (status === 'APROVADO' || status === 'ENVIADO_FABRICA') {
      return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Aprovado</span>;
    }
    if (status === 'REJEITADO') {
      return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Rejeitado</span>;
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
                        {pedido.status === 'REJEITADO' && pedido.motivoRejeicao && (
                          <div className="text-[10px] text-red-400 mt-1 max-w-[150px] truncate" title={pedido.motivoRejeicao}>
                            Motivo: {pedido.motivoRejeicao}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {pedido.status === 'PENDENTE' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(pedido.id, 'APROVADO')}
                                disabled={updating === pedido.id}
                                className="flex items-center gap-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                title="Aprovar Pedido"
                              >
                                {updating === pedido.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setRejectingId(pedido.id)}
                                disabled={updating === pedido.id}
                                className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                title="Rejeitar Pedido"
                              >
                                {updating === pedido.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === pedido.id ? null : pedido.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors ml-2"
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

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Rejeitar Pré-Pedido</h3>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo da Rejeição (Opcional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Produto X fora de estoque. Refazer pedido sem ele."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none h-24"
              />
            </div>
            <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-white/[0.02]">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                disabled={updating === rejectingId}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingId, 'REJEITADO', rejectionReason)}
                disabled={updating === rejectingId}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {updating === rejectingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirmar Rejeição'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
