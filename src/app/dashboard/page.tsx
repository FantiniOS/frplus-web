'use client';

import { ArrowUpRight, DollarSign, Users, ShoppingCart, Activity, TrendingUp, Package } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { getDashboardStats, orders, products } = useData();
  const stats = getDashboardStats();

  // 1. Calcular Vendas dos Últimos 7 Dias para o Gráfico
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  const salesData = last7Days.map(date => {
    const dailyTotal = orders
      .filter(o => o.data.startsWith(date))
      .reduce((acc, curr) => acc + curr.valorTotal, 0);
    return { date, value: dailyTotal };
  });

  const maxSale = Math.max(...salesData.map(d => d.value), 1);

  // 2. Calcular Top Produtos
  const productSalesStr = new Map<string, number>();
  orders.forEach(order => {
    order.itens.forEach(item => {
      const current = productSalesStr.get(item.produtoId) || 0;
      productSalesStr.set(item.produtoId, current + item.quantidade);
    });
  });

  const topProducts = Array.from(productSalesStr.entries())
    .map(([id, qtd]) => {
      const product = products.find(p => p.id === id);
      return {
        name: product?.nome || 'Produto Desconhecido',
        qtd,
        total: (product?.preco50a199 || 0) * qtd
      };
    })
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 4);

  const recentOrders = [...orders].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{getGreeting()}, {usuario?.nome?.split(' ')[0] || 'Bem-vindo'}</h1>
          <p className="text-gray-400">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <Link href="/dashboard/pedidos/novo">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            + Novo Pedido
          </button>
        </Link>
      </div>

      {/* Grid de KPIs (Indicadores) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Card 1 - Vendas */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Vendas Totais</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-white">R$ {stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-green-500 flex items-center mt-1">
            <ArrowUpRight className="h-3 w-3 mr-1" /> Crescimento contínuo
          </p>
        </div>

        {/* Card 2 - Pedidos */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-gray-400">Pedidos</span>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
          <p className="text-xs text-blue-500 flex items-center mt-1">
            <TrendingUp className="h-3 w-3 mr-1" /> Volume atual
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
            Clientes cadastrados
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
        <div className="col-span-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Vendas (Últimos 7 dias)</h3>
            <span className="text-xs text-gray-400">Atualizado em tempo real</span>
          </div>

          <div className="flex h-64 items-end justify-between space-x-2 pt-4 border-b border-white/5 pb-2">
            {salesData.map((data, i) => {
              const heightPercentage = (data.value / maxSale) * 100;
              return (
                <div key={i} className="group relative flex-1 flex flex-col justify-end items-center gap-2 h-full">
                  <div
                    className="w-full rounded-t-sm bg-blue-600 hover:bg-blue-400 transition-all duration-500 ease-out"
                    style={{ height: `${heightPercentage}%`, minHeight: '4px' }}
                  ></div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-white px-2 py-1 text-xs font-bold text-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    R$ {data.value.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500 uppercase">
            {salesData.map((d, i) => (
              <span key={i} className="flex-1 text-center truncate px-1">
                {new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
              </span>
            ))}
          </div>
        </div>

        {/* Coluna Direita (Top Produtos + Vendas Recentes) */}
        <div className="col-span-3 space-y-4">

          {/* Top Produtos */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2 mb-4 text-white">
              <Package className="h-4 w-4 text-purple-400" />
              <h3 className="text-lg font-semibold">Mais Vendidos</h3>
            </div>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Sem dados de vendas.</p>
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
            <h3 className="mb-4 text-lg font-semibold text-white">Últimos Pedidos</h3>
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
