'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

// ——— Types ———
export interface YoySalesCardProps {
  /** Faturamento do mês/período atual (em R$). */
  currentValue: number;
  /** Faturamento do mesmo mês/período no ano anterior (em R$). */
  previousValue: number;
  /** Label do período atual  (ex: "Ago 2026"). Quando omitido, gera automaticamente. */
  currentLabel?: string;
  /** Label do período anterior (ex: "Ago 2025"). Quando omitido, gera automaticamente. */
  previousLabel?: string;
}

// ——— Helpers ———
const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

// ——— Component ———
export function YoySalesCard({
  currentValue,
  previousValue,
  currentLabel,
  previousLabel,
}: YoySalesCardProps) {
  const now = new Date();
  const cLabel = currentLabel ?? `${getMonthLabel(now)} ${now.getFullYear()}`;
  const pLabel =
    previousLabel ?? `${getMonthLabel(now)} ${now.getFullYear() - 1}`;

  // Fórmula YoY: ((ValorAtual - ValorAnoAnterior) / ValorAnoAnterior) * 100
  const diff =
    previousValue === 0
      ? currentValue > 0
        ? 100
        : 0
      : ((currentValue - previousValue) / previousValue) * 100;

  const isPositive = diff >= 0;

  // Altura proporcional das mini-barras (a maior = 100%)
  const maxVal = Math.max(currentValue, previousValue, 1);
  const currentBarPct = (currentValue / maxVal) * 100;
  const previousBarPct = (previousValue / maxVal) * 100;

  return (
    <div
      className={
        'group relative rounded-2xl border border-white/[0.08] ' +
        `bg-gradient-to-br ${isPositive ? 'from-emerald-500/20 to-emerald-500/[0.02]' : 'from-rose-500/20 to-rose-500/[0.02]'} ` +
        'p-5 transition-all duration-300 ' +
        `${isPositive ? 'hover:border-emerald-500/30' : 'hover:border-rose-500/30'} ` +
        'shadow-lg shadow-black/20 overflow-hidden h-[140px] flex flex-col justify-between'
      }
    >
      {/* hover shimmer — mesmo dos outros cards */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />

      <div className="relative z-10 flex flex-col h-full">
        {/* ——— Header ——— */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Comparação Ano Anterior
          </span>
          <div
            className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
            )}
          </div>
        </div>

        {/* ——— Body: Percentage + Mini-bars ——— */}
        <div className="flex items-end justify-between flex-1 min-h-0">
          {/* Left: valor percentual */}
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-2xl font-bold tracking-tight leading-none ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {diff.toFixed(1)}%
            </span>
            <span className="text-[11px] text-gray-500 mt-1">
              Mês atual vs {now.getFullYear() - 1}
            </span>
          </div>

          {/* Right: Mini-barras comparativas */}
          <div className="flex items-end gap-2 h-[52px]">
            {/* Barra ano anterior */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 rounded-t-md bg-white/10 transition-all duration-500"
                style={{ height: `${previousBarPct}%`, minHeight: 4 }}
              />
              <span className="text-[9px] text-gray-500 tabular-nums leading-none whitespace-nowrap">
                {pLabel}
              </span>
            </div>

            {/* Barra mês atual */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 rounded-t-md transition-all duration-500 ${
                  isPositive ? 'bg-emerald-500/60' : 'bg-rose-500/60'
                }`}
                style={{ height: `${currentBarPct}%`, minHeight: 4 }}
              />
              <span className="text-[9px] text-gray-500 tabular-nums leading-none whitespace-nowrap">
                {cLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
