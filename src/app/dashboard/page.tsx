'use client';

import { DollarSign, Users, ShoppingCart, TrendingUp, Package, Calendar, Award, Zap, Gift, X, Wallet } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
import { InteractiveChart } from "@/components/dashboard/InteractiveChart";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useState, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

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
      .filter(o => o.tipo !== 'Bonificacao')
      .reduce((acc, o) => acc + o.valorTotal, 0),
    totalOrders: monthlyOrders.length,
    newClients: clients.length,
    totalProducts: products.length
  };

  const chartYear = filterYear || new Date().getFullYear();
  const chartMonth = filterMonth !== null ? filterMonth : new Date().getMonth();
  const chartDaysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
  const monthDays = Array.from({ length: chartDaysInMonth }, (_, i) => i + 1);

  const salesData = monthDays.map(day => {
    const chartDayTotal = orders
      .filter(o => {
        const d = new Date(o.data);
        return d.getUTCFullYear() === chartYear &&
          d.getUTCMonth() === chartMonth &&
          d.getUTCDate() === day;
      })
      .reduce((acc, curr) => acc + curr.valorTotal, 0);

    return {
      date: new Date(chartYear, chartMonth, day).toISOString(),
      dayLabel: String(day),
      value: chartDayTotal
    };
  });

  const maxSale = Math.max(...salesData.map(d => d.value), 100);

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
    .slice(0, 5);

  const recentOrders = [...monthlyOrders].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const monthName = selectedMonth
    ? new Date(filterYear!, filterMonth!, 1).toLocaleDateString('pt-BR', { month: 'long' })
    : 'Período Completo';

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
      .filter(o => o.tipo !== 'Bonificacao')
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

  // Bonificações
  const bonificacoes = monthlyOrders.filter(o => o.tipo === 'Bonificacao').length;

  const bonificacaoTotal = useMemo(() =>
    monthlyOrders
      .filter(o => o.tipo === 'Bonificacao')
      .reduce((acc, o) => acc + o.valorTotal, 0),
    [monthlyOrders]
  );

  const bonificacaoDetalhes = useMemo(() => {
    const map = new Map<string, number>();
    monthlyOrders
      .filter(o => o.tipo === 'Bonificacao')
      .forEach(o => {
        const nome = o.nomeCliente || 'Cliente Desconhecido';
        map.set(nome, (map.get(nome) || 0) + o.valorTotal);
      });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [monthlyOrders]);

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
  // ====== END DATA LOGIC ======

  const kpis = [
    {
      label: 'Faturamento',
      value: `R$ ${stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: `${stats.totalOrders} pedidos no período`,
      icon: DollarSign,
      gradient: 'from-emerald-500/20 to-emerald-500/[0.02]',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      borderHover: 'hover:border-emerald-500/30',
      glow: 'group-hover:shadow-emerald-500/10'
    },
    {
      label: 'Total Bonificado',
      value: `R$ ${bonificacaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: `${bonificacoes} pedidos · Ano: R$ ${bonificacaoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (7%: R$ ${(bonificacaoAnual * 0.07).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      icon: Gift,
      gradient: 'from-rose-500/20 to-rose-500/[0.02]',
      iconBg: 'bg-rose-500/15',
      iconColor: 'text-rose-400',
      borderHover: 'hover:border-rose-500/30',
      glow: 'group-hover:shadow-rose-500/10',
      onClick: () => setShowBonifDetails(true)
    },
    {
      label: 'Comissão Estimada',
      value: formatCurrency(comissaoFaturada),
      sub: `Comissão ponderada por representada`,
      icon: Wallet,
      gradient: 'from-amber-500/20 to-amber-500/[0.02]',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      borderHover: 'hover:border-amber-500/30',
      glow: 'group-hover:shadow-amber-500/10'
    },
    {
      label: 'Ticket Médio',
      value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'Por pedido',
      icon: TrendingUp,
      gradient: 'from-blue-500/20 to-blue-500/[0.02]',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      borderHover: 'hover:border-blue-500/30',
      glow: 'group-hover:shadow-blue-500/10'
    }
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

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="relative z-10 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            onClick={'onClick' in kpi && kpi.onClick ? kpi.onClick : undefined}
            className={`group relative rounded-2xl border border-white/[0.08] bg-gradient-to-br ${kpi.gradient} p-5 transition-all duration-300 ${kpi.borderHover} shadow-lg shadow-black/20 ${kpi.glow} ${'onClick' in kpi && kpi.onClick ? 'cursor-pointer' : 'cursor-default'} overflow-hidden`}
          >
            {/* Background shimmer */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-xl font-bold text-white tracking-tight">{kpi.value}</p>
              <p className="text-[11px] text-gray-500 mt-1">{kpi.sub}</p>
              {'onClick' in kpi && kpi.onClick && (
                <p className="text-[10px] text-rose-400/70 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Ver detalhes →</p>
              )}
            </div>
          </div>
        ))}
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
                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  R$ {bonificacaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ===== CHART + SIDEBAR ===== */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* Chart */}
        <InteractiveChart
          data={salesData}
          maxSale={maxSale}
          totalSales={stats.totalSales}
          monthName={monthName}
        />

        {/* Right Column */}
        <div className="md:col-span-3 space-y-4">

          {/* Top Products */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-5 shadow-xl shadow-black/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-violet-500/15">
                <Award className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white/90">Top Produtos</h3>
              <span className="text-[10px] text-gray-600 ml-auto capitalize">{monthName}</span>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">Sem dados de vendas neste período</p>
            ) : (
              <div className="space-y-2.5">
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

          {/* Recent Orders */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-5 shadow-xl shadow-black/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/15">
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">Últimos Pedidos</h3>
              </div>
              <Link href="/dashboard/pedidos" className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors">
                Ver todos →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">Nenhum pedido recente</p>
            ) : (
              <div className="space-y-1">
                {recentOrders.slice(0, 4).map((venda, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0 group/order hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/80 truncate">{venda.nomeCliente}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {new Date(venda.data).toLocaleDateString('pt-BR')}
                        {venda.tipo === 'Bonificacao' && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">BONIF</span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-white/90 tabular-nums flex-shrink-0">
                      R$ {(venda.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
    </div>
  );
}
