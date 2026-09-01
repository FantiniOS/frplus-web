'use client';

import { DollarSign, Users, ShoppingCart, TrendingUp, Package, Calendar, Award, Gift, X, Wallet, MessageCircle, Download } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
import { InteractiveChart } from "@/components/dashboard/InteractiveChart";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useState, useMemo, Suspense, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Phone } from "lucide-react";
import { VisitasCalendar } from "@/components/dashboard/VisitasCalendar";
import { YoySalesCard } from "@/components/dashboard/YoySalesCard";
import { YtdSalesCard } from "@/components/dashboard/YtdSalesCard";
import { getLembretesProspeccao } from "@/app/actions/prospects";
import { getDashboardChartData, getAvailableYears, ChartDataResponse, ChartViewMode } from "@/app/actions/dashboard";
import { getBonificacaoComissao, BonificacaoComissaoResult } from "@/app/actions/bonificacaoComissao";
import { RelatorioExecutivoPDF } from "@/components/dashboard/RelatorioExecutivoPDF";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { orders, products, clients, fabricas } = useData();

  // ====== MONTH FILTER (UNCHANGED) ======
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [chartView, setChartView] = useState<ChartViewMode>('Mensal');
  const [chartData, setChartData] = useState<ChartDataResponse[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Fetch available years for dropdown
  useEffect(() => {
    getAvailableYears().then(setAvailableYears).catch(console.error);
  }, []);

  const [yearStr, monthStr] = selectedMonth.split('-');
  const filterYear = selectedMonth ? parseInt(yearStr) : null;
  const filterMonth = selectedMonth ? parseInt(monthStr) - 1 : null;

  const monthlyOrders = orders.filter(o => {
    if (!selectedMonth) return true;
    const orderDate = new Date(o.data);
    return orderDate.getUTCMonth() === filterMonth && orderDate.getUTCFullYear() === filterYear;
  });

  const stats = {
    totalSales: monthlyOrders
      .filter(o => o.tipo !== 'Bonificacao' && o.status !== 'Cancelado')
      .reduce((acc, o) => acc + o.valorTotal, 0),
    totalOrders: monthlyOrders.filter(o => o.status !== 'Cancelado').length,
    newClients: clients.length,
    totalProducts: products.length
  };

  useEffect(() => {
    let mounted = true;
    setChartLoading(true);

    // Determina qual ano/mês passar conforme a visão
    const yearToSend = chartView === 'Anual' ? selectedYear : filterYear;
    const monthToSend = chartView === 'Mensal' ? filterMonth : null;

    getDashboardChartData(chartView, yearToSend, monthToSend)
      .then(data => {
        if (mounted) {
          setChartData(data);
          setChartLoading(false);
        }
      })
      .catch(err => {
        console.error("Erro ao buscar dados do gráfico", err);
        if (mounted) setChartLoading(false);
      });

    return () => { mounted = false; };
  }, [chartView, filterYear, filterMonth, selectedYear]);

  // ====== CÁLCULO DE FATURAMENTO ======
  // Sincronizado com os orders globais do DataContext (respeitando qualquer filtro de fábrica/representada)
  const faturamentoData = useMemo(() => {
    let startOfPeriod: Date | null = null;
    let endOfPeriod: Date | null = null;

    if (chartView === 'Mensal' && filterYear !== null && filterMonth !== null) {
        startOfPeriod = new Date(Date.UTC(filterYear, filterMonth, 1, 0, 0, 0));
        endOfPeriod = new Date(Date.UTC(filterYear, filterMonth + 1, 1, 0, 0, 0));
    } else if (chartView === 'Anual' && selectedYear !== null) {
        startOfPeriod = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0));
        endOfPeriod = new Date(Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0));
    }

    console.log(`[Segurança - Faturamento] Visão: ${chartView} | Start: ${startOfPeriod?.toISOString() || 'Global'} | End: ${endOfPeriod?.toISOString() || 'Global'}`);

    const faturamentoOrders = orders.filter(o => {
      if (o.tipo === 'Bonificacao' || (o.status || '').toLowerCase() === 'cancelado') return false;
      const status = (o.status || '').toLowerCase();
      if (status !== 'faturado' && status !== 'concluido') return false;
      if (!o.dataFaturamento) return false;

      const fDate = new Date(o.dataFaturamento);
      
      if (startOfPeriod && endOfPeriod) {
          // Filtro rigoroso: gte start AND lt end (exclusive to not bleed into next month)
          return fDate.getTime() >= startOfPeriod.getTime() && fDate.getTime() < endOfPeriod.getTime();
      }
      
      return true; // Global
    });

    return {
      total: faturamentoOrders.reduce((acc, o) => acc + Number(o.valorTotal), 0),
      count: faturamentoOrders.length
    };
  }, [orders, chartView, filterMonth, filterYear, selectedYear, selectedMonth]);

  // ====== FATURAMENTO ANO ANTERIOR (mesmo mês, ano -1) — para YoySalesCard ======
  const faturamentoAnoAnterior = useMemo(() => {
    let startOfPeriod: Date | null = null;
    let endOfPeriod: Date | null = null;

    if (chartView === 'Mensal' && filterYear !== null && filterMonth !== null) {
      startOfPeriod = new Date(Date.UTC(filterYear - 1, filterMonth, 1, 0, 0, 0));
      endOfPeriod = new Date(Date.UTC(filterYear - 1, filterMonth + 1, 1, 0, 0, 0));
    } else if (chartView === 'Anual' && selectedYear !== null) {
      startOfPeriod = new Date(Date.UTC(selectedYear - 1, 0, 1, 0, 0, 0));
      endOfPeriod = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0));
    }

    const faturamentoOrders = orders.filter(o => {
      if (o.tipo === 'Bonificacao' || (o.status || '').toLowerCase() === 'cancelado') return false;
      const status = (o.status || '').toLowerCase();
      if (status !== 'faturado' && status !== 'concluido') return false;
      if (!o.dataFaturamento) return false;

      const fDate = new Date(o.dataFaturamento);

      if (startOfPeriod && endOfPeriod) {
        return fDate.getTime() >= startOfPeriod.getTime() && fDate.getTime() < endOfPeriod.getTime();
      }

      return true;
    });

    return faturamentoOrders.reduce((acc, o) => acc + Number(o.valorTotal), 0);
  }, [orders, chartView, filterMonth, filterYear, selectedYear]);

  // ====== VENDAS ACUMULADAS DO ANO (YTD) — para YtdSalesCard ======
  const ytdData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;

    // Mesmo dia/mês no ano anterior (teto do período comparativo)
    const todayUTC = Date.UTC(currentYear, today.getMonth(), today.getDate(), 23, 59, 59);
    const sameDatePrevYearUTC = Date.UTC(previousYear, today.getMonth(), today.getDate(), 23, 59, 59);

    const startCurrentYear = Date.UTC(currentYear, 0, 1, 0, 0, 0);
    const startPreviousYear = Date.UTC(previousYear, 0, 1, 0, 0, 0);

    const isValidOrder = (o: typeof orders[0]) =>
      o.tipo !== 'Bonificacao' && (o.status || '').toLowerCase() !== 'cancelado';

    const currentYtd = orders
      .filter(o => {
        if (!isValidOrder(o)) return false;
        const d = new Date(o.data).getTime();
        return d >= startCurrentYear && d <= todayUTC;
      })
      .reduce((acc, o) => acc + Number(o.valorTotal), 0);

    const previousYtd = orders
      .filter(o => {
        if (!isValidOrder(o)) return false;
        const d = new Date(o.data).getTime();
        return d >= startPreviousYear && d <= sameDatePrevYearUTC;
      })
      .reduce((acc, o) => acc + Number(o.valorTotal), 0);

    return { currentYtd, previousYtd };
  }, [orders]);

  const maxSale = Math.max(...chartData.map(d => d.value), 100);
  const chartTotalSales = chartData.reduce((acc, curr) => acc + curr.value, 0);

  const productSalesMap = new Map<string, { qtd: number; total: number }>();
  monthlyOrders.forEach(order => {
    order.itens.forEach(item => {
      const current = productSalesMap.get(item.produtoId) || { qtd: 0, total: 0 };
      productSalesMap.set(item.produtoId, {
        qtd: current.qtd + item.quantidade,
        total: current.total + Number(item.total || 0)
      });
    });
  });

  const topProducts = Array.from(productSalesMap.entries())
    .map(([id, data]) => {
      const product = products.find(p => p.id === id);
      return {
        name: product?.nome || 'Produto Desconhecido',
        qtd: data.qtd,
        total: data.total
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const monthName = selectedMonth
    ? new Date(filterYear!, filterMonth!, 1).toLocaleDateString('pt-BR', { month: 'long' })
    : 'Período Completo';

  const chartTitle = chartView === 'Mensal' 
    ? monthName
    : chartView === 'Anual' 
      ? `Ano ${selectedYear}`
      : 'Todo o Histórico';

  // Ticket médio
  const avgTicket = stats.totalOrders > 0 ? stats.totalSales / stats.totalOrders : 0;

  // Comissão faturada (ponderada por representada)
  const taxaMap = useMemo(() => {
    const m = new Map<string, number>();
    fabricas.forEach(f => m.set(f.id, f.taxaComissao ?? 0));
    return m;
  }, [fabricas]);

  // Mapa produto → fabricaId (fallback quando pedido.fabricaId é null)
  const produtoFabricaMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach(p => { if (p.fabricaId) m.set(p.id, p.fabricaId); });
    return m;
  }, [products]);

  // DEBUG: Registra os pedidos do mês para entender por que a comissão falha
  console.log('Pedidos do Mês atual sendo processados para comissão:', monthlyOrders.map(o => ({
    id: o.id,
    cliente: o.nomeCliente,
    tipo: o.tipo,
    status: o.status,
    valorTotal: o.valorTotal,
    fabricaIdOriginal: o.fabricaId,
    itensFabricas: o.itens?.map(i => produtoFabricaMap.get(i.produtoId)),
    comissaoCalculada: (() => {
      let fabId = o.fabricaId;
      const isImportacao = fabId && fabricas.find(f => f.id === fabId)?.nome === 'Importação';

      if ((!fabId || isImportacao) && o.itens?.length > 0) {
        const validItemFabId = o.itens
          .map(i => produtoFabricaMap.get(i.produtoId))
          .find(id => id && fabricas.find(f => f.id === id)?.nome !== 'Importação');
        if (validItemFabId) {
          fabId = validItemFabId;
        }
      }
      const taxa = (taxaMap.get(fabId || '') || 0) / 100;
      return o.valorTotal * taxa;
    })()
  })));

  const comissaoFaturada = useMemo(() =>
    monthlyOrders
      .filter(o => o.tipo !== 'Bonificacao' && o.status !== 'Cancelado')
      .reduce((acc, pedido) => {
        let fabId = pedido.fabricaId;

        // Se a fábrica do pedido for a padrão de 'Importação', forçamos o fallback para os itens
        // pois a importação tem taxa 0, e queremos a taxa real do produto caso já tenha sido vinculada.
        const isImportacao = fabId && fabricas.find(f => f.id === fabId)?.nome === 'Importação';

        if ((!fabId || isImportacao) && pedido.itens?.length > 0) {
          // Busca a primeira fábrica válida mapiada nos produtos
          const validItemFabId = pedido.itens
            .map(i => produtoFabricaMap.get(i.produtoId))
            .find(id => id && fabricas.find(f => f.id === id)?.nome !== 'Importação');

          if (validItemFabId) {
            fabId = validItemFabId;
          }
        }

        const taxa = (taxaMap.get(fabId || '') || 0) / 100;
        return acc + pedido.valorTotal * taxa;
      }, 0),
    [monthlyOrders, taxaMap, produtoFabricaMap, fabricas]
  );

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Bonificações — respeitando chartView (Mensal / Anual / Global)
  const bonificacaoOrders = useMemo(() => {
    let startOfPeriod: Date | null = null;
    let endOfPeriod: Date | null = null;

    if (chartView === 'Mensal' && filterYear !== null && filterMonth !== null) {
      startOfPeriod = new Date(Date.UTC(filterYear, filterMonth, 1, 0, 0, 0));
      endOfPeriod = new Date(Date.UTC(filterYear, filterMonth + 1, 1, 0, 0, 0));
    } else if (chartView === 'Anual' && selectedYear !== null) {
      startOfPeriod = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0));
      endOfPeriod = new Date(Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0));
    }
    // chartView === 'Global' → sem filtro de data

    return orders.filter(o => {
      if (o.tipo !== 'Bonificacao') return false;
      const d = new Date(o.data);
      if (startOfPeriod && endOfPeriod) {
        return d.getTime() >= startOfPeriod.getTime() && d.getTime() < endOfPeriod.getTime();
      }
      return true; // Global
    });
  }, [orders, chartView, filterMonth, filterYear, selectedYear]);

  const bonificacoes = bonificacaoOrders.length;

  const bonificacaoTotal = useMemo(() =>
    bonificacaoOrders.reduce((acc, o) => acc + o.valorTotal, 0),
    [bonificacaoOrders]
  );

  const bonificacaoDetalhes = useMemo(() => {
    const map = new Map<string, number>();
    bonificacaoOrders.forEach(o => {
      const nome = o.nomeCliente || 'Cliente Desconhecido';
      map.set(nome, (map.get(nome) || 0) + o.valorTotal);
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [bonificacaoOrders]);

  const [showBonifDetails, setShowBonifDetails] = useState(false);

  const bonificacaoAnual = useMemo(() =>
    orders
      .filter(o => {
        if (!filterYear) return false;
        const d = new Date(o.data);
        return o.tipo === 'Bonificacao' && d.getUTCFullYear() === filterYear;
      })
      .reduce((acc, o) => acc + o.valorTotal, 0),
    [orders, filterYear]
  );

  // ====== COMISSÃO VIGENTE DO VENDEDOR FANTINI ======
  const [bonifComissao, setBonifComissao] = useState<BonificacaoComissaoResult>({
    taxaPeriodo: 0, comissaoPeriodo: 0, comissaoAnual: 0
  });
  useEffect(() => {
    if (filterYear !== null) {
      getBonificacaoComissao(filterYear, filterMonth)
        .then(setBonifComissao)
        .catch(console.error);
    }
  }, [filterYear, filterMonth]);
  
  // ====== LEADS / PROSPECTS ======
  const [lembretes, setLembretes] = useState<any[]>([]);
  useEffect(() => {
    getLembretesProspeccao().then(setLembretes).catch(console.error);
  }, []);
  
  // ====== END DATA LOGIC ======

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('pdf-report-container');
      
      if (!element) return;

      // Ensure it's temporarily visible if it was hidden
      const originalDisplay = element.style.display;
      element.style.display = 'block';

      const opt: any = {
        margin:       [10, 0, 10, 0],
        filename:     `Relatorio_Executivo_${selectedMonth || selectedYear}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      
      // Hide again
      element.style.display = originalDisplay;
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const kpis = [
    {
      label: 'Vendas Totais',
      value: `R$ ${stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${stats.totalOrders} pedidos emitidos`,
      icon: ShoppingCart,
      gradient: 'from-blue-500/20 to-blue-500/[0.02]',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      borderHover: 'hover:border-blue-500/30',
      glow: 'group-hover:shadow-blue-500/10'
    },
    {
      label: 'Faturamento',
      value: `R$ ${faturamentoData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${faturamentoData.count} pedidos faturados`,
      icon: DollarSign,
      gradient: 'from-emerald-500/20 to-emerald-500/[0.02]',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      borderHover: 'hover:border-emerald-500/30',
      glow: 'group-hover:shadow-emerald-500/10'
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ===== HEADER ===== */}
      <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {getGreeting()}, <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">{usuario?.nome?.split(' ')[0] || 'Bem-vindo'}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{selectedMonth ? `${monthName} / ${filterYear}` : 'Todo o Histórico'}</span>
          </p>
        </div>

        {/* Export and Filters */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExportingPDF ? 'Gerando...' : 'Exportar PDF'}
          </button>
          
          <div className="hidden sm:flex bg-white/[0.04] p-1 rounded-lg border border-white/[0.08]">
            {(['Mensal', 'Anual', 'Global'] as const).map(v => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  chartView === v
                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {chartView === 'Mensal' && (
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
          )}
          {chartView === 'Anual' && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-white/[0.04] border border-white/[0.08] text-white text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer"
            >
              {availableYears.length > 0 ? (
                availableYears.map(y => (
                  <option key={y} value={y} className="bg-[#0f1729] text-white">{y}</option>
                ))
              ) : (
                <option value={now.getFullYear()} className="bg-[#0f1729] text-white">{now.getFullYear()}</option>
              )}
            </select>
          )}
        </div>
      </div>

      {/* ===== LINHA SUPERIOR: KPI CARDS ===== */}
      <div className="relative z-10 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Render Only Small KPIs */}
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`group relative rounded-2xl border border-white/[0.08] bg-gradient-to-br ${kpi.gradient} p-5 transition-all duration-300 ${kpi.borderHover} shadow-lg shadow-black/20 ${kpi.glow} cursor-default overflow-hidden h-[140px] flex flex-col justify-center`}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.iconColor}`} />
                </div>
              </div>
              <div className="flex-1 min-h-0 text-xl font-bold text-white tracking-tight">{kpi.value}</div>
              <p className="text-[11px] text-gray-500 mt-1">{kpi.sub}</p>
            </div>
          </div>
        ))}

        {/* ===== CARD YOY COMPARATIVO ===== */}
        <YoySalesCard
          currentValue={faturamentoData.total}
          previousValue={faturamentoAnoAnterior}
        />

        {/* ===== CARD YTD ACUMULADO DO ANO ===== */}
        <YtdSalesCard
          currentYtdValue={ytdData.currentYtd}
          previousYtdValue={ytdData.previousYtd}
        />
      </div>

      {/* ===== MODAL DETALHAMENTO BONIFICAÇÕES ===== */}
      {showBonifDetails && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowBonifDetails(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-500/15">
                  <Gift className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Bonificações</h3>
                  <p className="text-[10px] text-gray-500 capitalize">{monthName} / {filterYear}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBonifDetails(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {bonificacaoDetalhes.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">Nenhuma bonificação neste período</p>
              ) : (
                <div className="space-y-1">
                  {bonificacaoDetalhes.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <span className="text-xs font-medium text-white/80 truncate mr-4">{item.nome}</span>
                      <span className="text-xs font-bold text-rose-400 tabular-nums flex-shrink-0">
                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer total */}
            {bonificacaoDetalhes.length > 0 && (
              <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</span>
                <span className="text-sm font-bold text-white">
                  R$ {bonificacaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ===== LINHA MEIO: CONTEÚDO PRINCIPAL + SIDEBAR CALENDÁRIO ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* COLUNA ESQUERDA (Gráfico) */}
        <div className="lg:col-span-2">
          {/* Chart */}
          <div className="relative h-full">
            {chartLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f1729]/80 backdrop-blur-sm rounded-2xl border border-white/[0.08]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <InteractiveChart
              data={chartData}
              maxSale={maxSale}
              totalSales={chartTotalSales}
              monthName={chartTitle}
              view={chartView}
            />
          </div>
        </div>

        {/* COLUNA DIREITA (Calendário de Visitas) */}
        <div className="lg:col-span-1">
          <div className="h-full w-full min-h-[400px]">
            <VisitasCalendar year={filterYear || new Date().getFullYear()} month={filterMonth !== null ? filterMonth : new Date().getMonth()} clientes={clients} />
          </div>
        </div>
      </div>

      {/* ===== LINHA INFERIOR: TOP PRODUTOS ===== */}
      <div className="grid grid-cols-1">
          {/* Top Produtos */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-5 shadow-xl shadow-black/30 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-violet-500/15">
                <Award className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white/90">Top Produtos</h3>
              <span className="text-[10px] text-gray-600 ml-auto capitalize">{monthName}</span>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6 flex-1 flex items-center justify-center">Sem dados de vendas neste período</p>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 flex-1 overflow-y-auto pr-1">
                {topProducts.map((prod, i) => {
                  const maxTotal = topProducts[0]?.total || 1;
                  const barWidth = Math.max((prod.total / maxTotal) * 100, 8);
                  const medals = ['🥇', '🥈', '🥉'];

                  return (
                    <div key={i} className="group/item">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">{medals[i] || `#${i + 1}`}</span>
                          <p className="text-xs font-medium text-white/80 truncate">{prod.name}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[10px] text-gray-500 tabular-nums">{prod.qtd} un</span>
                          <span className="text-[10px] font-semibold text-gray-400 tabular-nums w-16 text-right">
                            R$ {(prod.total || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-violet-400/40 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      {/* ===== AI Insights ===== */}
      <Suspense fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }>
        <AIInsightsPanel />
      </Suspense>

      {/* ===== HIDDEN REPORT FOR PDF EXPORT ===== */}
      <div style={{ display: 'none' }}>
        <RelatorioExecutivoPDF
          periodName={chartTitle}
          usuarioNome={usuario?.nome || 'Usuário'}
          stats={stats}
          faturamentoData={faturamentoData}
          ytdData={ytdData}
          faturamentoAnoAnterior={faturamentoAnoAnterior}
          topProducts={topProducts}
        />
      </div>
    </div>
  );
}
