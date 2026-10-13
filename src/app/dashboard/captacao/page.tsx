'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  Loader2, 
  PackageSearch, 
  RefreshCw,
  Printer,
  Pencil,
  Trash2,
  Plus,
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { gerarPdfPrePedido, PrePedidoPDFData } from '@/lib/gerarPdfPrePedido';

type Produto = { id?: string; codigo?: string; nome: string; unidade?: string | null };
type ItemPedido = { id: string; quantidade: number; precoUnitario: string | number; produto: Produto; produtoId?: string };

type Cliente = { 
  id?: string;
  razaoSocial: string; 
  nomeFantasia?: string | null; 
  cnpj: string;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  celular?: string | null;
  tabelaPreco?: string | null;
};

type PrePedido = {
  id: string;
  data: string;
  createdAt: string;
  status: string;
  motivoRejeicao?: string | null;
  valorTotal: string | number;
  cliente: Cliente;
  vendedor: { id?: string; nome: string };
  itens: ItemPedido[];
};

type CatalogoProduto = {
  id: string;
  codigo: string;
  nome: string;
  preco50a199: number;
  preco200a699: number;
  precoAtacado: number;
  precoAtacadoAVista: number;
  precoRedes: number;
  unidade?: string;
};

type EditItem = {
  produtoId: string;
  codigo?: string;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
};

export default function AdminCaptacaoPage() {
  const [pedidos, setPedidos] = useState<PrePedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Rejeição
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Exclusão
  const [deletingPedido, setDeletingPedido] = useState<PrePedido | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Exportação PDF
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  // Edição
  const [editingPedido, setEditingPedido] = useState<PrePedido | null>(null);
  const [editItens, setEditItens] = useState<EditItem[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoProduto[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [selectedNewProdId, setSelectedNewProdId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // Carregar catálogo de produtos para edição quando necessário
  const loadCatalogo = async () => {
    if (catalogo.length > 0 || loadingCatalogo) return;
    setLoadingCatalogo(true);
    try {
      const res = await fetch('/api/products?ativo=true');
      if (res.ok) {
        const data = await res.json();
        setCatalogo(data || []);
      }
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    } finally {
      setLoadingCatalogo(false);
    }
  };

  // Status update (Aprovar / Rejeitar)
  const handleUpdateStatus = async (id: string, novoStatus: string, motivoRejeicao?: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/pre-pedidos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus, motivoRejeicao })
      });

      if (!res.ok) throw new Error('Falha ao atualizar status');

      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus, motivoRejeicao } : p))
      );
      
      setRejectingId(null);
      setRejectionReason('');
      setSuccessMessage(`Pedido ${novoStatus === 'APROVADO' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert('Erro ao atualizar o status do pedido.');
    } finally {
      setUpdating(null);
    }
  };

  // Excluir pré-pedido
  const handleConfirmDelete = async () => {
    if (!deletingPedido) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pre-pedidos/${deletingPedido.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Falha ao apagar pedido');

      setPedidos((prev) => prev.filter((p) => p.id !== deletingPedido.id));
      if (expandedId === deletingPedido.id) setExpandedId(null);
      setDeletingPedido(null);
      setSuccessMessage('Pré-pedido apagado com sucesso.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert('Erro ao apagar o pré-pedido.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (pedido: PrePedido) => {
    setEditingPedido(pedido);
    loadCatalogo();

    // Mapear itens para o estado de edição
    const formattedItens: EditItem[] = pedido.itens.map((item) => ({
      produtoId: item.produto?.id || item.produtoId || '',
      codigo: item.produto?.codigo,
      nome: item.produto?.nome || 'Produto',
      unidade: item.produto?.unidade || 'CX',
      quantidade: Number(item.quantidade),
      precoUnitario: Number(item.precoUnitario)
    }));

    setEditItens(formattedItens);
    setSelectedNewProdId('');
  };

  // Atualizar quantidade no item em edição
  const handleEditItemQty = (index: number, newQty: number) => {
    const val = Math.max(1, newQty);
    setEditItens((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantidade: val };
      return next;
    });
  };

  // Atualizar preço unitário no item em edição
  const handleEditItemPrice = (index: number, newPrice: number) => {
    const val = Math.max(0, newPrice);
    setEditItens((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], precoUnitario: val };
      return next;
    });
  };

  // Remover item na edição
  const handleRemoveEditItem = (index: number) => {
    if (editItens.length <= 1) {
      alert('O pedido precisa ter pelo menos um item.');
      return;
    }
    setEditItens((prev) => prev.filter((_, i) => i !== index));
  };

  // Adicionar produto no pedido
  const handleAddNewItem = () => {
    if (!selectedNewProdId) return;
    const prod = catalogo.find((p) => p.id === selectedNewProdId);
    if (!prod) return;

    // Verificar se já existe no pedido
    const existingIndex = editItens.findIndex((i) => i.produtoId === prod.id);
    if (existingIndex >= 0) {
      handleEditItemQty(existingIndex, editItens[existingIndex].quantidade + 1);
      setSelectedNewProdId('');
      return;
    }

    // Preço baseado na tabela do cliente ou padrão 50a199
    const tab = editingPedido?.cliente?.tabelaPreco?.toLowerCase() || '50a199';
    let preco = prod.preco50a199;
    if (tab.includes('200a699')) preco = prod.preco200a699;
    else if (tab.includes('avista') || tab.includes('vista')) preco = prod.precoAtacadoAVista;
    else if (tab.includes('atacado')) preco = prod.precoAtacado;
    else if (tab.includes('redes')) preco = prod.precoRedes;

    setEditItens((prev) => [
      ...prev,
      {
        produtoId: prod.id,
        codigo: prod.codigo,
        nome: prod.nome,
        unidade: prod.unidade || 'CX',
        quantidade: 1,
        precoUnitario: Number(preco)
      }
    ]);

    setSelectedNewProdId('');
  };

  // Total do pedido em edição
  const editValorTotal = useMemo(() => {
    return editItens.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
  }, [editItens]);

  // Salvar alterações da edição
  const handleSaveEdit = async () => {
    if (!editingPedido) return;
    if (editItens.length === 0) {
      alert('Adicione pelo menos um produto ao pedido.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/pre-pedidos/${editingPedido.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: editItens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario
          }))
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao atualizar pedido');
      }

      const data = await res.json();
      const updated = data.prePedido;

      // Atualizar lista local
      setPedidos((prev) =>
        prev.map((p) => (p.id === editingPedido.id ? updated : p))
      );

      setEditingPedido(null);
      setSuccessMessage('Pré-pedido atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alterações no pré-pedido.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Exportar PDF com o layout padrão oficial
  const handleExportarPDF = async (pedido: PrePedido) => {
    setExportingPdfId(pedido.id);
    try {
      const pdfData: PrePedidoPDFData = {
        id: pedido.id,
        createdAt: pedido.createdAt,
        data: pedido.data,
        status: pedido.status,
        motivoRejeicao: pedido.motivoRejeicao,
        valorTotal: pedido.valorTotal,
        cliente: {
          id: pedido.cliente?.id,
          razaoSocial: pedido.cliente?.razaoSocial,
          nomeFantasia: pedido.cliente?.nomeFantasia,
          cnpj: pedido.cliente?.cnpj,
          endereco: pedido.cliente?.endereco,
          numero: pedido.cliente?.numero,
          bairro: pedido.cliente?.bairro,
          cidade: pedido.cliente?.cidade,
          estado: pedido.cliente?.estado,
          cep: pedido.cliente?.cep,
          telefone: pedido.cliente?.telefone,
          celular: pedido.cliente?.celular
        },
        vendedor: {
          nome: pedido.vendedor?.nome || 'Não informado'
        },
        itens: pedido.itens.map((it) => ({
          id: it.id,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitario,
          produto: {
            id: it.produto?.id,
            codigo: it.produto?.codigo,
            nome: it.produto?.nome,
            unidade: it.produto?.unidade
          }
        }))
      };

      await gerarPdfPrePedido(pdfData);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Erro ao gerar o documento PDF. Tente novamente.');
    } finally {
      setExportingPdfId(null);
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
              Revise, edite, exporte em PDF e gerencie os pré-pedidos enviados pelos vendedores.
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

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-400/60 hover:text-green-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabela de Pré-Pedidos */}
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
                        <div className="text-gray-500 text-xs mt-1">{pedido.vendedor?.nome}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{pedido.cliente?.razaoSocial}</div>
                        <div className="text-gray-500 text-xs mt-1">CNPJ: {pedido.cliente?.cnpj}</div>
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Exportar PDF (Layout Padrão) */}
                          <button
                            onClick={() => handleExportarPDF(pedido)}
                            disabled={exportingPdfId === pedido.id}
                            className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Exportar PDF (Layout Oficial FRPlus)"
                          >
                            {exportingPdfId === pedido.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden xl:inline">PDF</span>
                          </button>

                          {/* Editar Pedido */}
                          <button
                            onClick={() => handleOpenEdit(pedido)}
                            className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            title="Editar Pedido (quantidades, itens e preços)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Editar</span>
                          </button>

                          {/* Apagar Pedido */}
                          <button
                            onClick={() => setDeletingPedido(pedido)}
                            className="flex items-center gap-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            title="Excluir Pré-Pedido"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Apagar</span>
                          </button>

                          {/* Aprovar / Rejeitar se estiver Pendente */}
                          {pedido.status === 'PENDENTE' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(pedido.id, 'APROVADO')}
                                disabled={updating === pedido.id}
                                className="flex items-center gap-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                title="Aprovar Pedido"
                              >
                                {updating === pedido.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setRejectingId(pedido.id)}
                                disabled={updating === pedido.id}
                                className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                title="Rejeitar Pedido"
                              >
                                {updating === pedido.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </>
                          )}

                          {/* Expandir / Recolher Itens */}
                          <button
                            onClick={() => setExpandedId(expandedId === pedido.id ? null : pedido.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors ml-1"
                            title={expandedId === pedido.id ? 'Recolher detalhes' : 'Ver detalhes dos itens'}
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
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Itens do Pedido ({pedido.itens.length})
                              </h4>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleExportarPDF(pedido)}
                                  disabled={exportingPdfId === pedido.id}
                                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                                >
                                  {exportingPdfId === pedido.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Printer className="h-3 w-3" />
                                  )}
                                  Baixar PDF
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(pedido)}
                                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Editar Itens
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {pedido.itens.map((item) => (
                                <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                  <div className="overflow-hidden mr-3">
                                    <p className="text-sm font-medium text-gray-200 truncate" title={item.produto?.nome}>
                                      {item.produto?.nome}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {item.quantidade} {item.produto?.unidade || 'UN'} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.precoUnitario))}
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

      {/* MODAL DE EDIÇÃO DO PRÉ-PEDIDO */}
      {editingPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-amber-400" />
                  Editar Pré-Pedido #{editingPedido.id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Cliente: <strong className="text-gray-200">{editingPedido.cliente?.razaoSocial}</strong> | Vendedor: <strong className="text-gray-200">{editingPedido.vendedor?.nome}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingPedido(null)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Adicionar Produto */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Adicionar Produto ao Pedido
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedNewProdId}
                    onChange={(e) => setSelectedNewProdId(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Selecione um produto para adicionar --</option>
                    {catalogo.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.codigo ? `[${prod.codigo}] ` : ''}{prod.nome} ({prod.unidade || 'UN'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    disabled={!selectedNewProdId}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Lista de Itens Editáveis */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Itens Selecionados ({editItens.length})</span>
                  <span className="text-amber-400 normal-case font-normal">Ajuste quantidades ou preços unitários</span>
                </h4>

                <div className="space-y-2.5">
                  {editItens.map((item, idx) => {
                    const itemTotal = item.quantidade * item.precoUnitario;
                    return (
                      <div
                        key={`${item.produtoId}-${idx}`}
                        className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate" title={item.nome}>
                            {item.codigo ? `[${item.codigo}] ` : ''}{item.nome}
                          </p>
                          <span className="text-xs text-gray-500">Unidade: {item.unidade}</span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Quantidade */}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">Qtd</span>
                            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                              <button
                                type="button"
                                onClick={() => handleEditItemQty(idx, item.quantidade - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:bg-white/10 text-xs font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => handleEditItemQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center bg-transparent text-white font-bold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleEditItemQty(idx, item.quantidade + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:bg-white/10 text-xs font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Preço Unitário */}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">Preço Unit. (R$)</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precoUnitario}
                              onChange={(e) => handleEditItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="flex flex-col text-right min-w-[90px]">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">Subtotal</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal)}
                            </span>
                          </div>

                          {/* Remover */}
                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(idx)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Modal com Total e Botões */}
            <div className="p-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block">Novo Valor Total:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(editValorTotal)}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({editItens.reduce((acc, i) => acc + i.quantidade, 0)} volumes)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPedido(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Apagar Pré-Pedido</h3>
                <p className="text-xs text-gray-400">Esta ação é irreversível</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-300">
                Tem certeza que deseja apagar o pré-pedido de{' '}
                <strong className="text-white">{deletingPedido.cliente?.razaoSocial}</strong>?
              </p>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-xs text-gray-400 space-y-1">
                <p>Pedido: #{deletingPedido.id.slice(-6).toUpperCase()}</p>
                <p>Vendedor: {deletingPedido.vendedor?.nome}</p>
                <p>
                  Valor:{' '}
                  <span className="text-blue-400 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(deletingPedido.valorTotal))}
                  </span>
                </p>
                <p>Itens: {deletingPedido.itens.length} produtos</p>
              </div>
            </div>

            <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setDeletingPedido(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Apagando...
                  </>
                ) : (
                  'Sim, Apagar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
