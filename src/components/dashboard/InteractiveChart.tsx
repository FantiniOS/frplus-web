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
    const displayValue = totalSales || 0;
    const activeDays = data.filter(d => (d.value || 0) > 0).length;
    const avgDaily = activeDays > 0 ? displayValue / activeDays : 0;

    return (
        <div className="md:col-span-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-6 h-[420px] flex flex-col shadow-2xl shadow-black/40 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between mb-5 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-cyan-400" />
                        <h3 className="text-base font-semibold text-white/90 tracking-tight">Vendas Diárias</h3>
                    </div>
                    <p className="text-xs text-gray-500 ml-3 capitalize">
                        {monthName} · {activeDays} dias com vendas
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">Total</p>
                    <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tabular-nums">
                        R$ {displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                        Média/dia: R$ {avgDaily.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full rounded-xl p-3 pb-1 flex items-end justify-between gap-[2px] overflow-hidden relative bg-white/[0.02] border border-white/[0.04]">
                {/* Grid lines */}
                <div className="absolute inset-x-0 top-3 bottom-6 flex flex-col justify-between pointer-events-none px-3">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="w-full border-t border-dashed border-white/[0.06]" />
                    ))}
                </div>

                {data.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                        Sem dados para {monthName}
                    </div>
                ) : (
                    data.map((item, i) => {
                        const val = item.value || 0;
                        const heightPercentage = maxSale > 0 ? Math.max((val / maxSale) * 100, 2) : 2;
                        const hasValue = val > 0;
                        const showLabel = i === 0 || i === data.length - 1 || i % 3 === 0;

                        return (
                            <div
                                key={i}
                                className="relative flex-1 h-full flex flex-col justify-end items-center group"
                                title={`Dia ${item.dayLabel}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            >
                                {/* Hover tooltip */}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                                    <div className="bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-xl">
                                        R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                {/* Bar */}
                                <div
                                    className={`w-full max-w-[32px] min-w-[3px] rounded-t transition-all duration-200 ${hasValue
                                        ? 'bg-gradient-to-t from-blue-600/70 to-cyan-400/70 group-hover:from-blue-500 group-hover:to-cyan-300 shadow-sm shadow-blue-500/20 group-hover:shadow-blue-400/40'
                                        : 'bg-white/[0.04]'
                                        }`}
                                    style={{ height: hasValue ? `${heightPercentage}%` : '2%' }}
                                />

                                {/* Label */}
                                <span className="text-[8px] mt-1.5 block h-3 text-gray-600 text-center w-full tabular-nums">
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
