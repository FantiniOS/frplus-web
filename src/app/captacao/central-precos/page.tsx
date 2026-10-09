'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, LogOut, Tags, CheckCircle, Send, Newspaper, RefreshCw, Store, UserCircle2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Cliente = { id: string; razaoSocial: string; nomeFantasia: string; cnpj: string };
type Marca = { id: string; nome: string };
type Registro = {
  id: string;
  dataColeta: string;
  produtoBase: string;
  precoPrateleira: number;
  vendedorId: string | null;
  cliente: { id: string; nomeFantasia: string; razaoSocial: string; cidade: string } | null;
  vendedor: { id: string; nome: string } | null;
  marcaConcorrente: { id: string; nome: string };
};

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tempoRelativo = (iso: string) => {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

const inputClass = 'w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all';

export default function CentralPrecosVendedorPage() {
  const { usuario, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [aba, setAba] = useState<'registrar' | 'mural'>('registrar');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [produtosSistema, setProdutosSistema] = useState<{id: string; nome: string}[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMural, setLoadingMural] = useState(false);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  // Form
  const [clienteId, setClienteId] = useState('');
  const [produtoBaseNome, setProdutoBaseNome] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [preco, setPreco] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !usuario) {
      router.push('/');
    }
  }, [usuario, authLoading, router]);

  const fetchMural = async () => {
    setLoadingMural(true);
    try {
      const res = await fetch('/api/central-precos?limit=200');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRegistros(data.registros || []);
    } catch {
      setError('Erro ao carregar o mural de preços.');
    } finally {
      setLoadingMural(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [cliRes, marRes, prodRes] = await Promise.all([
          fetch('/api/captacao'), // Reutiliza rota existente: retorna apenas a carteira do vendedor
          fetch('/api/marcas-concorrentes'),
          fetch('/api/products?ativo=true')
        ]);
        if (cliRes.ok) {
          const d = await cliRes.json();
          setClientes(d.clientes || []);
        }
        if (marRes.ok) {
          const d = await marRes.json();
          setMarcas(d.marcas || []);
        }
        if (prodRes.ok) {
          const d = await prodRes.json();
          setProdutosSistema(Array.isArray(d) ? d : []);
        }
      } catch {
        setError('Erro ao carregar dados do sistema.');
      } finally {
        setLoading(false);
      }
    };
    init();
    fetchMural();
  }, []);

  const registrosFiltrados = useMemo(() => {
    const t = busca.toLowerCase().trim();
    if (!t) return registros;
    return registros.filter(r =>
      r.produtoBase.toLowerCase().includes(t) ||
      r.marcaConcorrente.nome.toLowerCase().includes(t) ||
      (r.cliente?.nomeFantasia || r.cliente?.razaoSocial || '').toLowerCase().includes(t) ||
      (r.vendedor?.nome || '').toLowerCase().includes(t)
    );
  }, [registros, busca]);

  const handleSubmit = async () => {
    if (!clienteId) return setError('Selecione o cliente onde o preço foi coletado.');
    if (!produtoBaseNome) return setError('Selecione o produto base.');
    if (!marcaId) return setError('Selecione a marca concorrente.');
    if (!preco || Number(preco.replace(',', '.')) <= 0) return setError('Informe um preço válido.');

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/central-precos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          produtoBase: produtoBaseNome,
          marcaConcorrenteId: marcaId,
          precoPrateleira: preco
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao registrar');

      // Mantém o cliente selecionado para agilizar múltiplas coletas no mesmo PDV
      setProdutoBaseNome('');
      setMarcaId('');
      setPreco('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchMural();
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar o preço. Tente novamente.');
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
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600/20 p-2 rounded-lg">
              <Tags className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Central de Preços</h1>
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

        {/* Tabs */}
        <div className="max-w-4xl mx-auto mt-4 grid grid-cols-2 gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => { setAba('registrar'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              aba === 'registrar' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400'
            }`}
          >
            <Send className="h-4 w-4" />
            Registrar
          </button>
          <button
            onClick={() => { setAba('mural'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              aba === 'mural' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400'
            }`}
          >
            <Newspaper className="h-4 w-4" />
            Mural
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4 mt-2">
        {/* Success */}
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
                <p className="font-semibold">Preço registrado!</p>
                <p className="text-sm">Já está visível no Mural para a equipe.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ═══════════ ABA: REGISTRAR ═══════════ */}
        {aba === 'registrar' && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">1. Cliente / PDV</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputClass}>
                <option value="">-- Selecione --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeFantasia || c.razaoSocial}
                  </option>
                ))}
              </select>
              {clientes.length === 0 && (
                <p className="text-xs text-yellow-500 mt-2">Você não possui clientes vinculados à sua carteira.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">2. Produto Base</label>
              <select
                value={produtoBaseNome}
                onChange={(e) => setProdutoBaseNome(e.target.value)}
                className={inputClass}
              >
                <option value="">-- Selecione nosso produto --</option>
                {produtosSistema.map((p) => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">3. Marca Concorrente</label>
              <select value={marcaId} onChange={(e) => setMarcaId(e.target.value)} className={inputClass}>
                <option value="">-- Selecione --</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              {marcas.length === 0 && (
                <p className="text-xs text-yellow-500 mt-2">Nenhuma marca cadastrada ainda. Solicite ao administrador.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">4. Preço na Prateleira</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className={`${inputClass} pl-10 text-lg font-bold tabular-nums`}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {isSubmitting ? 'Enviando...' : 'Registrar Preço'}
            </button>
          </section>
        )}

        {/* ═══════════ ABA: MURAL ═══════════ */}
        {aba === 'mural' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto, marca, cliente..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button
                onClick={fetchMural}
                disabled={loadingMural}
                className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${loadingMural ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingMural && registros.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : registrosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <Tags className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma coleta registrada ainda.</p>
              </div>
            ) : (
              registrosFiltrados.map((r) => {
                const isMine = r.vendedorId === usuario.id;
                const clienteNome = r.cliente ? (r.cliente.nomeFantasia || r.cliente.razaoSocial) : 'Sem cliente vinculado';
                return (
                  <article
                    key={r.id}
                    className={`bg-white/5 border rounded-2xl p-4 ${isMine ? 'border-blue-500/30' : 'border-white/10'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border bg-rose-500/10 text-rose-400 border-rose-500/20 mb-1.5">
                          {r.marcaConcorrente.nome}
                        </span>
                        <h3 className="font-semibold text-white leading-tight">{r.produtoBase}</h3>
                      </div>
                      <span className="text-xl font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                        {formatBRL(r.precoPrateleira)}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <Store className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                        <span className="truncate">{clienteNome}{r.cliente?.cidade ? ` • ${r.cliente.cidade}` : ''}</span>
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <UserCircle2 className={`h-3.5 w-3.5 ${isMine ? 'text-blue-400' : 'text-cyan-500'}`} />
                          <span className={isMine ? 'text-blue-400 font-medium' : ''}>
                            {isMine ? 'Você' : r.vendedor?.nome || 'Administrador'}
                          </span>
                        </span>
                        <span className="text-gray-600">{tempoRelativo(r.dataColeta)}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}
      </main>
    </div>
  );
}
