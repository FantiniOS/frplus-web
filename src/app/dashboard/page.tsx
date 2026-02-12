'use client';

import { DollarSign, Users, ShoppingCart, TrendingUp, Package, Calendar, Award, Zap } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
import { InteractiveChart } from "@/components/dashboard/InteractiveChart";
import { useState } from "react";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { orders, products, clients } = useData();

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

  const productSalesMap = new Map<string, number>();
  monthlyOrders.forEach(order => {
    order.itens.forEach(item => {
      const current = productSalesMap.get(item.produtoId) || 0;
      productSalesMap.set(item.produtoId, current + item.quantidade);
    });
  });

  const topProducts = Array.from(productSalesMap.entries())
    .map(([id, qtd]) => {
      const product = products.find(p => p.id === id);
      return {
        name: product?.nome || 'Produto Desconhecido',
        qtd,
        total: (product?.preco50a199 || 0) * qtd
      };
    })
    .sort((a, b) => b.qtd - a.qtd)
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

  // Bonificações
  const bonificacoes = monthlyOrders.filter(o => o.tipo === 'Bonificacao').length;
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
      label: 'Ticket Médio',
      value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'Por pedido',
      icon: TrendingUp,
      gradient: 'from-blue-500/20 to-blue-500/[0.02]',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      borderHover: 'hover:border-blue-500/30',
      glow: 'group-hover:shadow-blue-500/10'
    },
    {
      label: 'Clientes Ativos',
      value: String(stats.newClients),
      sub: 'Base cadastrada',
      icon: Users,
      gradient: 'from-violet-500/20 to-violet-500/[0.02]',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      borderHover: 'hover:border-violet-500/30',
      glow: 'group-hover:shadow-violet-500/10'
    },
    {
      label: 'Catálogo',
      value: String(products.length),
      sub: `${bonificacoes} bonificações no mês`,
      icon: Package,
      gradient: 'from-amber-500/20 to-amber-500/[0.02]',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      borderHover: 'hover:border-amber-500/30',
      glow: 'group-hover:shadow-amber-500/10'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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

        {/* Month Selector (UNCHANGED LOGIC) */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none [color-scheme:dark] cursor-pointer"
            />
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth('')}
                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors ml-1 font-medium"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`group relative rounded-2xl border border-white/[0.08] bg-gradient-to-br ${kpi.gradient} p-5 transition-all duration-300 ${kpi.borderHover} shadow-lg shadow-black/20 ${kpi.glow} cursor-default overflow-hidden`}
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
            </div>
          </div>
        ))}
      </div>

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
                  const maxQtd = topProducts[0]?.qtd || 1;
                  const barWidth = Math.max((prod.qtd / maxQtd) * 100, 8);
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
      <AIInsightsPanel />
    </div>
  );
}
