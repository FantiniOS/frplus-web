'use client';

import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

// ——— Types ———
export interface YtdSalesCardProps {
  /** Soma das vendas de 1º Jan até hoje no ano atual (em R$). */
  currentYtdValue: number;
  /** Soma das vendas de 1º Jan até a mesma data no ano anterior (em R$). */
  previousYtdValue: number;
}

// ——— Helpers ———
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const getMonthName = (monthIndex: number) =>
  new Date(2026, monthIndex).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

// ——— Component ———
export function YtdSalesCard({
  currentYtdValue,
  previousYtdValue,
}: YtdSalesCardProps) {
  const current = currentYtdValue;
  const previous = previousYtdValue;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthName = getMonthName(now.getMonth());

  // Fórmula YTD: ((Atual - Anterior) / Anterior) * 100
  const diff =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : ((current - previous) / previous) * 100;

  const isPositive = diff >= 0;

  // Texto do rodapé dinâmico: "Jan a Ago: 2026 vs 2025"
  const footerText = `Jan a ${currentMonthName}: ${currentYear} vs ${currentYear - 1}`;

  return (
    <div
      className={
        'group relative rounded-2xl border border-white/[0.08] ' +
        'bg-gradient-to-br from-cyan-500/20 to-cyan-500/[0.02] ' +
        'p-4 transition-all duration-300 hover:border-cyan-500/30 ' +
        'shadow-lg shadow-black/20 overflow-hidden h-[140px] flex flex-col'
      }
    >
      {/* hover shimmer */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />

      <div className="relative z-10 flex flex-col h-full">
        {/* ——— Header ——— */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Acumulado do Ano (YTD)
          </span>
          <div className="p-1.5 rounded-lg bg-cyan-500/15">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
          </div>
        </div>

        {/* ——— Main value ——— */}
        <div className="text-xl font-bold text-white tracking-tight leading-tight">
          {formatCurrency(current)}
        </div>

        {/* ——— Variação percentual ——— */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <TrendingDown className="h-3 w-3 text-rose-400 flex-shrink-0" />
          )}
          <span
            className={`text-xs font-semibold tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {diff.toFixed(1)}% vs ano anterior
          </span>
        </div>

        {/* ——— Footer ——— */}
        <div className="mt-auto flex items-end justify-between border-t border-white/[0.06] pt-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider leading-tight capitalize">
            {footerText}
          </span>
          <span className="text-[10px] text-gray-600 tabular-nums leading-tight">
            {formatCurrency(previous)} no anterior
          </span>
        </div>
      </div>
    </div>
  );
}
