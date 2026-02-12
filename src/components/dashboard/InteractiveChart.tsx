"use client";

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
    // Static Display - No Hover State needed for header values
    const displayLabel = "Total no Período";
    const displayValue = totalSales;

    return (
        <div className="col-span-4 rounded-xl border border-white/10 bg-white/5 p-6 h-[400px] flex flex-col">
            {/* Header Estático */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white">Vendas Diárias ({monthName})</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Visão consolidada do mês
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
            <div className="flex-1 w-full bg-black/20 rounded-lg p-4 flex items-end justify-between gap-1 overflow-hidden relative border border-white/5">

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
                        // Show more labels: First, Last, and every ODD day (1, 3, 5...) for better density
                        // i is 0-indexed (Day 1), so i%2==0 means Day 1, 3, 5...
                        const showLabel = i === 0 || i === data.length - 1 || i % 2 === 0;

                        return (
                            <div
                                key={i}
                                className="relative flex-1 h-full flex flex-col justify-end items-center group"
                                title={`Dia ${item.dayLabel}: R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} // Native tooltip fallback
                            >
                                {/* Barra Estática */}
                                <div
                                    className="w-full max-w-[40px] min-w-[4px] rounded-t-sm bg-blue-600/60 hover:bg-blue-400 transition-colors"
                                    style={{ height: `${heightPercentage}%` }}
                                ></div>

                                {/* Data Label */}
                                <span className="text-[9px] mt-2 block h-3 text-gray-500 text-center w-full">
                                    {showLabel ? item.dayLabel : ''}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
