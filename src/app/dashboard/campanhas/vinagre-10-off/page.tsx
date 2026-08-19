/* eslint-disable */
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { PrintHeader } from '@/components/ui/PrintHeader';
import { useReactToPrint } from 'react-to-print';
import { motion } from 'framer-motion';
import {
  Search,
  Wine,
  Users,
  AlertTriangle,
  TrendingUp,
  Target,
  ExternalLink,
  Filter,
  Loader2,
  Phone,
  MapPin,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  FileText,
  FileDown,
  Printer,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { getHitListVinagre, ApuracaoDashboardData, HitListClient } from '@/app/actions/apuracaoVinagre';
import { salvarMetaCampanha } from '@/app/actions/salvarMetaCampanha';
import { toggleCampanhaVinagre } from '@/app/actions/toggleCampanhaVinagre';

// ═══════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    if (word.length === 0) return '';
    if (['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no'].includes(word)) return word;
    if (['s/a', 's.a', 'ltda', 'me', 'epp'].includes(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════
type SortField = 'nome' | 'volumeAnterior' | 'metaCaixas' | 'volumeComprado';
type SortDir = 'asc' | 'desc';

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════
export default function CampanhaVinagre10OffDashboard() {
  const [hitListData, setHitListData] = useState<ApuracaoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPendentesOnly, setShowPendentesOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handleExportPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: '10pct_OFF_Vinagre_Alcool_HitList'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleMetaChange = async (clienteId: string, metaCaixas: number) => {
    setHitListData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        hitList: prev.hitList.map(c =>
          c.id === clienteId ? { ...c, metaCaixas, metaAlcancada: metaCaixas > 0 && c.volumeComprado >= metaCaixas } : c
        )
      };
    });

    try {
      await salvarMetaCampanha(clienteId, 'vinagre-10-off', metaCaixas);
    } catch (err) {
      console.error('Erro ao salvar meta', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const data = await getHitListVinagre();
      if (data && 'error' in data) {
        setError((data as any).error);
      } else {
        const apuracao = data as ApuracaoDashboardData;
        setHitListData(apuracao);
        setCampanhaAtiva(apuracao.campanhaAtiva ?? false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async () => {
    try {
      setIsTogglingStatus(true);
      const newStatus = campanhaAtiva ? 'ENCERRADA' : 'ATIVA';
      await toggleCampanhaVinagre(newStatus);
      await fetchData();
    } catch (err) {
      console.error('Erro ao alterar status', err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // ═══ SORTING ═══
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  // ═══ STATUS BADGE ═══
  const renderStatusBadge = (cliente: HitListClient) => {
    const volumeAtual = cliente.volumeComprado ?? 0;
    const meta = cliente.metaCaixas ?? 0;

    if (volumeAtual === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
          ⏳ Pendente
        </span>
      );
    }
    if (meta > 0 && volumeAtual < meta) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
          ⚠️ Volume Insuficiente
        </span>
      );
    }
    if (meta > 0 && volumeAtual >= meta) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ✅ 10% OFF Liberado
        </span>
      );
    }
    // Meta = 0 mas comprou (sem histórico anterior para comparar)
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        🔄 Comprou (sem meta)
      </span>
    );
  };

  // ═══ FILTRO E SORT ═══
  const filteredClients = useMemo(() => {
    if (!hitListData?.hitList) return [];

    let list = [...hitListData.hitList];

    // Filtro de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c =>
        (c.nomeFantasia || '').toLowerCase().includes(term) ||
        (c.razaoSocial || '').toLowerCase().includes(term) ||
        (c.cnpj || '').toLowerCase().includes(term) ||
        (c.cidade || '').toLowerCase().includes(term)
      );
    }

    // Filtro de pendentes
    if (showPendentesOnly) {
      list = list.filter(c => (c.volumeComprado ?? 0) === 0);
    }

    // Sort
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;
      switch (sortField) {
        case 'nome':
          valA = (a.nomeFantasia || a.razaoSocial || '').toLowerCase();
          valB = (b.nomeFantasia || b.razaoSocial || '').toLowerCase();
          if (sortDir === 'desc') return valB > valA ? 1 : valB < valA ? -1 : 0;
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        case 'volumeAnterior':
          valA = a.volumeAnterior ?? 0;
          valB = b.volumeAnterior ?? 0;
          break;
        case 'metaCaixas':
          valA = a.metaCaixas ?? 0;
          valB = b.metaCaixas ?? 0;
          break;
        case 'volumeComprado':
          valA = a.volumeComprado ?? 0;
          valB = b.volumeComprado ?? 0;
          break;
      }
      if (sortDir === 'desc') return (valB as number) - (valA as number);
      return (valA as number) - (valB as number);
    });

    return list;
  }, [hitListData, searchTerm, showPendentesOnly, sortField, sortDir]);

  // ═══ LOADING ═══
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-400 text-sm">Calculando campanha 10% OFF Vinagre...</p>
        </div>
      </div>
    );
  }

  // ═══ ERROR ═══
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-red-400 font-medium">Erro ao carregar campanha</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!hitListData) return null;

  // ═══ MÉTRICAS CALCULADAS ═══
  const totalElegiveis = hitListData.clientesAtacadistasBase ?? 0;
  const totalConvertidos = hitListData.clientesConvertidos ?? 0;
  const taxaConversao = hitListData.taxaConversao ?? 0;
  const volumeTotal = hitListData.volumeTotalEscoado ?? 0;
  const receitaTotal = hitListData.receitaTotalGerada ?? 0;
  const basePendente = totalElegiveis - totalConvertidos;

  return (
    <div className="space-y-6 print:h-auto print:overflow-visible print:bg-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* ═══ PRINT HEADER ═══ */}
      <div className="hidden print:block mb-8">
        <PrintHeader titulo="10% OFF Vinagre de Álcool — Hit List Atacado" />
        <p className="text-center text-sm text-gray-500 mt-2 font-medium">Período: Ano vigente até a data de hoje</p>
        
        <div className="mt-8 grid grid-cols-3 gap-6 border-y border-gray-200 py-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Conversão</p>
            <p className="text-2xl font-bold text-gray-900">{taxaConversao}%</p>
            <p className="text-xs text-gray-500 mt-1">{totalConvertidos} de {totalElegiveis}</p>
          </div>
          <div className="text-center border-l border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Volume Total</p>
            <p className="text-2xl font-bold text-gray-900">{volumeTotal.toLocaleString('pt-BR')} cx</p>
          </div>
          <div className="text-center border-l border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Receita Gerada</p>
            <p className="text-2xl font-bold text-gray-900">R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
              <Wine className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                10% OFF Vinagre de Álcool (Atacado)
              </h1>
              <p className="text-sm text-gray-400">
                Mapa de Caça — Meta: +50% sobre a última compra
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {campanhaAtiva ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              ● Campanha Ativa
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Campanha Encerrada
            </span>
          )}
          
          <button
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className="px-3 py-1 text-xs font-medium bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {isTogglingStatus ? 'Atualizando...' : campanhaAtiva ? 'Encerrar Campanha' : 'Reativar Campanha'}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Printer className="h-3 w-3" />
            Imprimir
          </button>
          <button
            onClick={() => handleExportPDF()}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
          >
            <FileDown className="h-3 w-3" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ═══ PRODUTO DETECTADO ═══ */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium bg-white/5 text-gray-300 border border-white/10">
          <Wine className="h-3 w-3 text-blue-400" />
          Vinagre de Álcool 750ml
        </span>
      </div>

      {/* ═══ BARRA DE CONVERSÃO ═══ */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 print:hidden">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">Conversão da Base Atacadista</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {totalConvertidos} <span className="text-gray-500 text-lg font-normal">de {totalElegiveis} atacadistas</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-blue-500">{taxaConversao}%</span>
          </div>
        </div>
        <div className="w-full bg-black/50 rounded-full h-4 mt-4 overflow-hidden border border-white/5">
          <div
            className="bg-gradient-to-r from-blue-600 to-cyan-400 h-4 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, taxaConversao)}%` }}
          ></div>
        </div>
      </div>

      {/* ═══ CARDS DE RESUMO (Padrão Belmont - Dark Mode) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Clientes Elegíveis */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-blue-500">
            <Users className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Clientes Elegíveis</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-500">{totalElegiveis}</p>
            <p className="text-xs text-slate-500 mt-1">Atacado e Atacado à Vista</p>
          </div>
        </div>

        {/* Card 2: Convertidos */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Convertidos</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-emerald-500">{totalConvertidos}</p>
            <p className="text-xs text-slate-500 mt-1">{taxaConversao}% da base</p>
          </div>
        </div>

        {/* Card 3: Volume Escoado */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-cyan-500">
            <TrendingUp className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Volume Total</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-cyan-500">{volumeTotal.toLocaleString('pt-BR')} <span className="text-xl font-bold text-cyan-600">cx</span></p>
            <p className="text-xs text-slate-500 mt-1">Vinagre de Álcool 750ml</p>
          </div>
        </div>

        {/* Card 4: Base Pendente */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-amber-500">
            <Target className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Base Pendente</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-amber-500">{basePendente}</p>
            <p className="text-xs text-slate-500 mt-1">Não compraram ainda</p>
          </div>
        </div>
      </div>

      {/* ═══ FILTROS ═══ */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nome ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <button
          onClick={() => setShowPendentesOnly(!showPendentesOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            showPendentesOnly
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
          }`}
        >
          <Filter className="h-4 w-4" />
          Apenas Pendentes
        </button>

        <span className="text-xs text-gray-500 whitespace-nowrap">
          {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ═══ AVISO DE REGRA ═══ */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3 print:hidden">
        <Wine className="h-5 w-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-400">Regra da Campanha: +50% sobre a última compra</p>
          <p className="text-xs text-gray-400 mt-1">
            A meta é calculada automaticamente como 150% do volume de Vinagre de Álcool 750ml do último pedido do cliente. Ao atingir a meta, o desconto de 10% é liberado.
          </p>
        </div>
      </div>

      {/* ═══ TABELA DE MONITORAMENTO ═══ */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden overflow-x-auto backdrop-blur-sm print:border-none print:bg-white print:text-black">
        <table className="w-full text-left text-sm print:text-xs">
          <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
            <tr>
              <th className="px-3 py-4 font-medium w-8 text-center">#</th>
              <th
                className="px-3 py-4 font-medium cursor-pointer hover:text-white transition-colors select-none min-w-[200px]"
                onClick={() => handleSort('nome')}
              >
                Cliente <SortIcon field="nome" />
              </th>
              <th className="px-3 py-4 font-medium hidden md:table-cell">Cidade</th>
              <th className="px-3 py-4 font-medium text-center">Status na Campanha</th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('volumeAnterior')}
              >
                Última Compra (cx) <SortIcon field="volumeAnterior" />
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('metaCaixas')}
              >
                <span className="text-emerald-400">Meta (cx)</span> <SortIcon field="metaCaixas" />
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('volumeComprado')}
              >
                <span className="text-cyan-400">Volume na Campanha (cx)</span> <SortIcon field="volumeComprado" />
              </th>
              <th className="px-3 py-4 font-medium text-right">Última Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 print:divide-gray-200">
            {filteredClients.map((cliente, idx) => {
              const volumeAnterior = cliente.volumeAnterior ?? 0;
              const meta = cliente.metaCaixas ?? 0;
              const volumeAtual = cliente.volumeComprado ?? 0;
              const progresso = meta > 0 ? Math.min(100, Math.round((volumeAtual / meta) * 100)) : 0;

              return (
                <motion.tr
                  key={cliente.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  className={`group transition-colors print:break-inside-avoid print:text-black ${
                    volumeAtual === 0
                      ? 'hover:bg-amber-500/5 bg-amber-500/[0.02] print:bg-amber-50'
                      : 'hover:bg-white/5 print:bg-white'
                  }`}
                >
                  {/* # */}
                  <td className="px-3 py-3 text-center text-xs text-gray-600 font-mono">
                    {idx + 1}
                  </td>

                  {/* Cliente */}
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white print:text-black truncate">
                            {cliente.razaoSocial || 'Sem Nome'}
                          </span>
                          <Link href={`/dashboard/clientes/${cliente.id}/raio-x`} title="Raio-X do Cliente" className="print:hidden">
                            <ExternalLink className="h-3 w-3 text-gray-500 hover:text-blue-400 transition-colors" />
                          </Link>
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          {cliente.cnpj || 'Sem CNPJ'}
                        </div>
                        {cliente.comprador && (
                          <div className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                            {cliente.comprador}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-0.5">
                          {cliente.cidade && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 md:hidden">
                              <MapPin className="h-2.5 w-2.5" />
                              {cliente.cidade}
                            </span>
                          )}
                          {(cliente.telefone || cliente.celular) && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 print:text-gray-600">
                              <Phone className="h-2.5 w-2.5 print:text-gray-500" />
                              {cliente.celular || cliente.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Cidade */}
                  <td className="px-3 py-3 text-gray-400 hidden md:table-cell print:text-gray-700">
                    {cliente.cidade || '-'}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 text-center">
                    {renderStatusBadge(cliente)}
                  </td>

                  {/* Última Compra (cx) */}
                  <td className="px-3 py-3 text-right text-gray-300 print:text-gray-800">
                    {cliente.volumeAnterior ?? 0} cx
                  </td>

                  {/* Meta (cx) */}
                  <td className="px-3 py-3 text-right">
                    {meta > 0 ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 shadow-[0_0_10px_rgba(16,185,129,0.08)] print:border-emerald-500 print:bg-emerald-50 print:shadow-none">
                        <span className="font-bold text-emerald-400 text-sm font-mono print:text-emerald-700">
                          {meta}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm">-</span>
                    )}
                  </td>

                  {/* Volume na Campanha (cx) */}
                  <td className="px-3 py-3 text-right">
                    {volumeAtual > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1 print:border-cyan-500 print:bg-cyan-50">
                          <span className="font-bold text-cyan-400 text-sm font-mono print:text-cyan-700">
                            {volumeAtual}
                          </span>
                        </div>
                        {meta > 0 && (
                          <div className="flex items-center gap-1.5 w-20">
                            <div className="flex-1 bg-white/10 rounded-full h-1 overflow-hidden print:bg-gray-200">
                              <div
                                className={`h-full rounded-full ${
                                  progresso >= 100 ? 'bg-emerald-500' :
                                  progresso >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, progresso))}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${
                              progresso >= 100 ? 'text-emerald-400' :
                              progresso >= 50 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {progresso}%
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm">-</span>
                    )}
                  </td>

                  {/* Última Ação */}
                  <td className="px-3 py-3 text-right text-gray-400 text-xs">
                    {cliente.dataUltimaCompra
                      ? new Date(cliente.dataUltimaCompra).toLocaleDateString('pt-BR')
                      : cliente.ultimaAcao
                        ? new Date(cliente.ultimaAcao).toLocaleDateString('pt-BR')
                        : '-'}
                  </td>
                </motion.tr>
              );
            })}

            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="text-gray-500 space-y-2">
                    <Search className="h-8 w-8 mx-auto text-gray-600" />
                    <p className="text-sm">Nenhum cliente encontrado.</p>
                    {showPendentesOnly && (
                      <button
                        onClick={() => setShowPendentesOnly(false)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Limpar filtro de pendentes
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ LEGENDA ═══ */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400/60"></span>
          <span>Pendente = Ainda não comprou na campanha</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400/60"></span>
          <span>Volume Insuficiente = Comprou, mas abaixo da meta</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/60"></span>
          <span>10% OFF Liberado = Meta atingida (Última compra × 1.5)</span>
        </div>
      </div>

      {/* ═══ COMPONENTE DE IMPRESSÃO (react-to-print) ═══ */}
      <div className="hidden">
        <div ref={printRef} className="p-8 bg-white text-black min-h-screen">
          <PrintHeader titulo="10% OFF Vinagre de Álcool — Mapa de Caça (Atacado)" />

          <div className="mt-4 mb-8">
            <p className="text-gray-600 mb-2"><strong>Período Analisado:</strong> Ano vigente até a data de hoje</p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 text-center">
              <p className="text-sm text-gray-600 font-bold uppercase mb-1">Conversão</p>
              <p className="text-2xl font-black text-blue-600">{taxaConversao}%</p>
              <p className="text-xs text-gray-500 mt-1">{totalConvertidos} de {totalElegiveis}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 text-center">
              <p className="text-sm text-gray-600 font-bold uppercase mb-1">Base Pendente</p>
              <p className="text-2xl font-black text-amber-600">{basePendente}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 text-center">
              <p className="text-sm text-gray-600 font-bold uppercase mb-1">Volume (Cx)</p>
              <p className="text-2xl font-black text-gray-900">{volumeTotal.toLocaleString('pt-BR')}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 text-center">
              <p className="text-sm text-gray-600 font-bold uppercase mb-1">Receita Gerada</p>
              <p className="text-2xl font-black text-gray-900">R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <h4 className="font-bold text-gray-900 mb-3 border-b border-gray-300 pb-2">Mapa de Caça (Relação de Atacadistas)</h4>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 border-y border-gray-300 text-gray-800">
              <tr>
                <th className="py-2 px-3 font-bold">Cliente</th>
                <th className="py-2 px-3 font-bold">Cidade</th>
                <th className="py-2 px-3 font-bold text-center">Status</th>
                <th className="py-2 px-3 font-bold text-right">Últ. Compra (Cx)</th>
                <th className="py-2 px-3 font-bold text-right">Meta (Cx)</th>
                <th className="py-2 px-3 font-bold text-right">Vol. Campanha (Cx)</th>
              </tr>
            </thead>
            <tbody>
              {(hitListData?.hitList ?? []).map(cliente => {
                const va = cliente.volumeAnterior ?? 0;
                const m = cliente.metaCaixas ?? 0;
                const vc = cliente.volumeComprado ?? 0;

                let statusText = 'Pendente';
                let statusColor = 'text-amber-600';
                if (vc > 0 && m > 0 && vc < m) { statusText = 'Insuficiente'; statusColor = 'text-orange-600'; }
                if (m > 0 && vc >= m) { statusText = '10% OFF Liberado'; statusColor = 'text-green-600'; }
                if (vc > 0 && m === 0) { statusText = 'Comprou'; statusColor = 'text-blue-600'; }

                return (
                  <tr key={cliente.id} className="border-b border-gray-200">
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-900">{cliente.razaoSocial || 'Sem Nome'}</div>
                      <div className="text-xs text-gray-500">{cliente.cnpj || 'Sem CNPJ'}</div>
                      {cliente.comprador && <div className="text-xs text-gray-500">{cliente.comprador}</div>}
                    </td>
                    <td className="py-2 px-3">{cliente.cidade || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`${statusColor} font-bold`}>{statusText}</span>
                    </td>
                    <td className="py-2 px-3 text-right">{cliente.volumeAnterior ?? 0} cx</td>
                    <td className="py-2 px-3 text-right">{m > 0 ? m : '-'}</td>
                    <td className="py-2 px-3 text-right">{vc > 0 ? vc : '-'}</td>
                  </tr>
                );
              })}
              {(!hitListData?.hitList || hitListData.hitList.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-4 px-3 text-center text-gray-500">
                    Nenhum cliente atacadista encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
