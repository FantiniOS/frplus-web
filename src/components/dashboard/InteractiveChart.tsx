"use client";

import { useState } from "react";

interface SalesData {
    date: string;
    dayLabel: string;
    value: number;
}

interface InteractiveChartProps {
    data: SalesData[];
    maxSale: number;
    totalSales: number;
    monthName: string;
}

export function InteractiveChart({ data, maxSale, totalSales, monthName }: InteractiveChartProps) {
    const [hoveredData, setHoveredData] = useState<SalesData | null>(null);

    // Determine display values
    const displayLabel = hoveredData ? `Dia ${hoveredData.dayLabel}` : "Total no Período";
    const displayValue = hoveredData ? hoveredData.value : totalSales;

    return (
        <div className="col-span-4 rounded-xl border border-white/10 bg-white/5 p-6 h-[400px] flex flex-col">
            {/* Header Interativo */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white">Vendas Diárias ({monthName})</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        {data.length > 0 ? 'Passe o mouse nas barras' : 'Sem dados'}
                    </p>
                </div>

                <div className="text-right h-12 flex flex-col justify-center min-w-[150px]">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">
                        {displayLabel}
                    </span>
                    <span className="text-2xl font-bold text-blue-400 tabular-nums">
                        R$ {displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Área do Gráfico */}
            <div className="flex-1 w-full bg-gradient-to-b from-black/20 to-transparent rounded-lg p-4 flex items-end justify-between gap-1 overflow-hidden relative border border-white/5">

                {/* Linhas de Grade Sutis */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 py-4">
                    <div className="w-full border-t border-dashed border-gray-500"></div>
                    <div className="w-full border-t border-dashed border-gray-500"></div>
                    <div className="w-full border-t border-dashed border-gray-500"></div>
                </div>

                {data.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                        Sem dados para exibir para {monthName}
                    </div>
                ) : (
                    data.map((item, i) => {
                        const heightPercentage = Math.max((item.value / maxSale) * 100, 4);
                        // Lógica de Labels: Primeiro, Último, e a cada 5 dias
                        const isFirst = i === 0;
                        const isLast = i === data.length - 1;
                        const isHigh = item.value === maxSale && maxSale > 0;
                        const isMod5 = parseInt(item.dayLabel) % 5 === 0;

                        const showLabel = isFirst || isLast || isMod5;

                        return (
                            <div
                                key={i}
                                className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-crosshair z-10"
                                onMouseEnter={() => setHoveredData(item)}
                                onMouseLeave={() => setHoveredData(null)}
                            >
                                {/* Barra com Glow Effect no Hover */}
                                <div
                                    className={`
                          w-full max-w-[40px] min-w-[4px] rounded-t-sm transition-all duration-200
                          ${hoveredData?.dayLabel === item.dayLabel
                                            ? 'bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.5)] scale-y-105'
                                            : 'bg-blue-600/60 hover:bg-blue-500/80'}
                        `}
                                    style={{ height: `${heightPercentage}%` }}
                                ></div>

                                {/* Data Label */}
                                <span
                                    className={`  
                           text-[9px] mt-2 block h-3 transition-colors text-center w-full
                           ${hoveredData?.dayLabel === item.dayLabel ? 'text-white font-bold' : 'text-gray-600'}
                        `}
                                >
                                    {showLabel ? item.dayLabel : ''}
                                </span>

                                {/* Linha Vertical Indicadora (só no hover) */}
                                {hoveredData?.dayLabel === item.dayLabel && (
                                    <div className="absolute bottom-0 top-0 w-[1px] bg-white/10 pointer-events-none -z-10"></div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
