'use client';

import { ArrowUpRight, DollarSign, Users, ShoppingCart, Activity, TrendingUp, Package } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
import { useState } from "react";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { orders, products, clients } = useData();

  // State for Month Filter (Format: YYYY-MM)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // Derived Date Objects from Selection
  const [yearStr, monthStr] = selectedMonth.split('-');
  const filterYear = selectedMonth ? parseInt(yearStr) : null;
  const filterMonth = selectedMonth ? parseInt(monthStr) - 1 : null; // 0-indexed

  // Filter Orders for Selected Month
  const monthlyOrders = orders.filter(o => {
    if (!selectedMonth) return true; // Show all if no month selected

    const orderDate = new Date(o.data);
    // Use UTC to avoid timezone shifts (e.g. 2026-02-01T00:00:00Z -> Jan 31 Local)
    // Since import stores as UTC Midnight, we should view as UTC to keep the date.
    return orderDate.getUTCMonth() === filterMonth && orderDate.getUTCFullYear() === filterYear;
  });

  const stats = {
    totalSales: monthlyOrders.reduce((acc, o) => acc + o.valorTotal, 0),
    totalOrders: monthlyOrders.length,
    newClients: clients.length, // Total base (doesn't usually filter by month unless specifically "New Clients this month")
    totalProducts: products.length
  };

  // 1. Chart: Sales for the Selected Month
  const daysInMonth = selectedMonth
    ? new Date(filterYear!, filterMonth! + 1, 0).getDate()
    : 30; // Default to 30 for view all purely for visualization scale or handle differently

  // If View All, maybe show per-month? For now let's keep it simple: 
  // If Selected Month -> Show Days. If View All -> Show last 30 days or similar? 
  // Let's stick to "If no month, show empty chart or aggregate". 
  // Actually, for "View All", a daily chart is messy. Let's force it to current month if 'View All' for the chart, or better, just hide chart?
  // Let's just make it robust:
  const chartYear = filterYear || new Date().getFullYear();
  const chartMonth = filterMonth !== null ? filterMonth : new Date().getMonth();
  const chartDaysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();

  const monthDays = Array.from({ length: chartDaysInMonth }, (_, i) => i + 1);

  const salesData = monthDays.map(day => {
    // Note: If "View All" is selected, this chart currently shows data for the CURRENT real month (as fallback)
    // or we could show nothing. Let's make it show "Current Month" Context if All is selected, 
    // or better yet, aggregate specific days. 
    // Given complexity, let's keep it filtering specific month for chart, 
    // but the LISTS below show everything.

    // Actually, let's filter the data for the chart specifically based on the chartYear/Month
    const chartDayTotal = orders // use global orders, not filtered monthlyOrders (which might be All)
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

  // 2. Turnvoer & Top Products (Filtered by Month)
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
        total: (product?.preco50a199 || 0) * qtd // Approximate value
      };
    })
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 4);

  const recentOrders = [...monthlyOrders].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Month Name for Display
  const monthName = selectedMonth
    ? new Date(filterYear!, filterMonth!, 1).toLocaleDateString('pt-BR', { month: 'long' })
    : 'Período Completo';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{getGreeting()}, {usuario?.nome?.split(' ')[0] || 'Bem-vindo'}</h1>
          <p className="text-emerald-400 font-medium capitalize flex items-center gap-2">
            📅 Visão: {selectedMonth ? `${monthName} / ${filterYear}` : 'Todo o Histórico'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Mês */}
          <div className="relative group flex gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 [color-scheme:dark]"
            />
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth('')}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Limpar
              </button>
            )}
          </div>

          <Link href="/dashboard/pedidos/novo">
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 whitespace-nowrap">
              + Novo Pedido
            </button>
          </Link>
        </div>
      </div>

      {/* Grid de KPIs (Indicadores) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Card 1 - Vendas */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Vendas ({monthName})</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-white">R$ {stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-green-500 flex items-center mt-1">
            <ArrowUpRight className="h-3 w-3 mr-1" /> Seleção atual
          </p>
        </div>

        {/* Card 2 - Pedidos */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Pedidos ({monthName})</span>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
          <p className="text-xs text-blue-500 flex items-center mt-1">
            <TrendingUp className="h-3 w-3 mr-1" /> Seleção atual
          </p>
        </div>

        {/* Card 3 - Clientes */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Base de Clientes</span>
            <Users className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.newClients}</div>
          <p className="text-xs text-gray-400 mt-1">
            Total cadastrado
          </p>
        </div>

        {/* Card 4 - Produtos */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Produtos</span>
            <Package className="h-4 w-4 text-pink-500" />
          </div>
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <p className="text-xs text-pink-500 flex items-center mt-1">
            Itens cadastrados
          </p>
        </div>
      </div>

      {/* Área Principal */}
      <div className="grid gap-4 md:grid-cols-7">

        {/* Gráfico Real (Esquerda) */}
        <div className="col-span-4 rounded-xl border border-white/10 bg-white/5 p-6 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Vendas Diárias ({monthName})</h3>
            <span className="text-xs text-gray-400">Dados do período selecionado</span>
          </div>

          <div className="flex-1 w-full bg-black/20 rounded-lg p-4 flex items-end justify-between gap-1 overflow-hidden relative">
            {/* Eixo Y simplificado */}
            <div className="absolute left-0 top-0 bottom-0 w-full border-b border-white/5 pointer-events-none"></div>

            {salesData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                Sem dados para exibir
              </div>
            ) : (
              salesData.map((data, i) => {
                const heightPercentage = Math.max((data.value / maxSale) * 100, 4);
                // Mostrar apenas rótulos que cabem (ex: a cada 5 dias ou extremos)
                const showLabel = i === 0 || i === salesData.length - 1 || (data.value === maxSale);

                return (
                  <div key={i} className="group relative flex-1 h-full flex flex-col justify-end items-center">
                    {/* Tooltip Nativo CSS - Mais Simples e Seguro */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                      <div className="bg-gray-900 border border-gray-700 text-white text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                        <span className="font-bold block text-blue-400">Dia {data.dayLabel}</span>
                        R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Barra */}
                    <div
                      className="w-full max-w-[30px] min-w-[4px] bg-blue-600/60 hover:bg-blue-500 rounded-t transition-all"
                      style={{ height: `${heightPercentage}%` }}
                    ></div>

                    {/* Data (simplificado) */}
                    <span className="text-[10px] text-gray-600 mt-1 h-4 block overflow-visible">
                      {showLabel ? data.dayLabel : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita (Top Produtos + Vendas Recentes) */}
        <div className="col-span-3 space-y-4">

          {/* Top Produtos */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2 mb-4 text-white">
              <Package className="h-4 w-4 text-purple-400" />
              <h3 className="text-lg font-semibold">Mais Vendidos ({monthName})</h3>
            </div>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Sem dados de vendas neste período.</p>
              ) : (
                topProducts.map((prod, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-400">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{prod.name}</p>
                        <p className="text-xs text-gray-500">{prod.qtd} unidades</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-white">R$ {prod.total.toFixed(0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vendas Recentes (Compacto) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Pedidos Recentes ({monthName})</h3>
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma venda recente.</p>
              ) : (
                recentOrders.slice(0, 3).map((venda, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-white">{venda.nomeCliente}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(venda.data).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">R$ {venda.valorTotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
              {recentOrders.length > 0 && (
                <Link href="/dashboard/pedidos" className="block text-center text-xs text-blue-400 hover:text-blue-300 mt-2">
                  Ver todos
                </Link>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* AI Insights Section */}
      <AIInsightsPanel />

    </div>
  );
}
