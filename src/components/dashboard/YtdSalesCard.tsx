'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Eye, EyeOff } from 'lucide-react';

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
  const [showValues, setShowValues] = useState(false);

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
  const absDiff = Math.abs(current - previous);

  // Texto do rodapé dinâmico: "Jan a Ago: 2026 vs 2025"
  const footerText = `Jan a ${currentMonthName}: ${currentYear} vs ${currentYear - 1}`;

  return (
    <div
      onClick={() => setShowValues(!showValues)}
      className={
        'group relative rounded-2xl border border-white/[0.08] cursor-pointer ' +
        'bg-gradient-to-br from-cyan-500/20 to-cyan-500/[0.02] ' +
        'p-4 transition-all duration-300 hover:border-cyan-500/30 ' +
        'shadow-lg shadow-black/20 overflow-hidden h-[140px] flex flex-col ' +
        'hover:-translate-y-1 active:scale-[0.98]'
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
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {showValues ? (
                <EyeOff className="h-3 w-3 text-gray-500" />
              ) : (
                <Eye className="h-3 w-3 text-gray-500" />
              )}
            </div>
            <div className="p-1.5 rounded-lg bg-cyan-500/15">
              <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
            </div>
          </div>
        </div>

        {!showValues ? (
          /* === MODO PADRÃO: Valor + percentual + footer === */
          <>
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
          </>
        ) : (
          /* === MODO EXPANDIDO: Valores R$ detalhados === */
          <div className="flex flex-col justify-between flex-1 min-h-0 animate-in fade-in duration-300">
            {/* Linha do ano atual */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-[11px] text-gray-400 font-medium">
                  Jan–{currentMonthName} {currentYear}
                </span>
              </div>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(current)}
              </span>
            </div>

            {/* Linha do ano anterior */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <span className="text-[11px] text-gray-400 font-medium">
                  Jan–{currentMonthName} {currentYear - 1}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-300 tabular-nums">
                {formatCurrency(previous)}
              </span>
            </div>

            {/* Linha de diferença */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                Diferença
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold tabular-nums ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositive ? '+' : '-'}{formatCurrency(absDiff)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {isPositive ? '+' : ''}{diff.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
