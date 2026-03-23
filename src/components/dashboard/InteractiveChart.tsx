"use client";

interface SalesData {
    date: string;       // YYYY-MM-DD (texto puro do servidor)
    dayLabel: string;
    value: number;
    dayOfWeek?: number; // 0=Dom, 1=Seg... 6=Sáb (vindo do servidor via UTC)
}

interface InteractiveChartProps {
    data: SalesData[];
    maxSale: number;
    totalSales: number;
    monthName: string;
    view?: 'Mensal' | 'Anual' | 'Global';
}

// ══════════════════════════════════════════════════════
// FERIADOS NACIONAIS BRASILEIROS (fixos + móveis)
// Cálculo dos feriados móveis usa Date internamente,
// mas NÃO toca nos dados dos pedidos.
// ══════════════════════════════════════════════════════

function getEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getBrazilianHolidays(year: number): Map<string, string> {
    const holidays = new Map<string, string>();
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Feriados fixos nacionais
    holidays.set(`${year}-01-01`, 'Confraternização Universal');
    holidays.set(`${year}-04-21`, 'Tiradentes');
    holidays.set(`${year}-05-01`, 'Dia do Trabalho');
    holidays.set(`${year}-09-07`, 'Independência do Brasil');
    holidays.set(`${year}-10-12`, 'N. Sra. Aparecida');
    holidays.set(`${year}-11-02`, 'Finados');
    holidays.set(`${year}-11-15`, 'Proclamação da República');
    holidays.set(`${year}-12-25`, 'Natal');

    // Feriados móveis baseados na Páscoa
    const easter = getEasterDate(year);
    holidays.set(fmt(addDays(easter, -47)), 'Carnaval');
    holidays.set(fmt(addDays(easter, -48)), 'Carnaval');
    holidays.set(fmt(addDays(easter, -2)), 'Sexta-Feira Santa');
    holidays.set(fmt(easter), 'Páscoa');
    holidays.set(fmt(addDays(easter, 60)), 'Corpus Christi');

    return holidays;
}

// ══════════════════════════════════════════════════════
// getDayType agora usa a STRING "YYYY-MM-DD" e o
// dayOfWeek numérico que já veio do servidor via UTC.
// PROIBIDO: new Date(dateStr) aqui dentro.
// ══════════════════════════════════════════════════════
function getDayType(
    dateKey: string,
    dayOfWeek: number,
    holidays: Map<string, string>
): { type: 'workday' | 'weekend' | 'holiday'; label?: string } {
    // Checa feriado pela chave de texto puro
    if (holidays.has(dateKey)) {
        return { type: 'holiday', label: holidays.get(dateKey) };
    }

    if (dayOfWeek === 0) return { type: 'weekend', label: 'Domingo' };
    if (dayOfWeek === 6) return { type: 'weekend', label: 'Sábado' };

    return { type: 'workday' };
}

// ══════════════════════════════════════════════════════

export function InteractiveChart({ data, maxSale, totalSales, monthName, view = 'Mensal' }: InteractiveChartProps) {
    const displayValue = totalSales || 0;
    const activeDays = data.filter(d => (d.value || 0) > 0).length;
    let avgDivisor = activeDays > 0 ? activeDays : 1;
    if (view === 'Anual') avgDivisor = 12;
    if (view === 'Global') avgDivisor = data.length || 1;
    const avgDaily = displayValue / avgDivisor;

    const isMensal = view === 'Mensal';

    // Extrai o ano da string YYYY-MM-DD (sem new Date!)
    const year = data.length > 0 ? parseInt(data[0].date.split('-')[0], 10) : new Date().getFullYear();
    const holidays = isMensal ? getBrazilianHolidays(year) : new Map<string, string>();

    // Count day types usando dados puros do servidor
    const weekendCount = isMensal ? data.filter(d => getDayType(d.date, d.dayOfWeek || 0, holidays).type === 'weekend').length : 0;
    const holidayCount = isMensal ? data.filter(d => getDayType(d.date, d.dayOfWeek || 0, holidays).type === 'holiday').length : 0;

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
                        <h3 className="text-base font-semibold text-white/90 tracking-tight">
                            {view === 'Mensal' ? 'Vendas Diárias' : view === 'Anual' ? 'Vendas Mensais' : 'Vendas Anuais'}
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500 ml-3 capitalize">
                        {monthName} · {activeDays} {view === 'Mensal' ? 'dias' : view === 'Anual' ? 'meses' : 'anos'} com vendas
                    </p>
                    {/* Legend */}
                    {isMensal && (
                        <div className="flex items-center gap-3 ml-3 mt-1.5">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm bg-gradient-to-t from-blue-600/70 to-cyan-400/70" />
                                <span className="text-[9px] text-gray-600">Dia útil</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm bg-gradient-to-t from-gray-600/50 to-gray-500/40" />
                                <span className="text-[9px] text-gray-600">Fim de sem. ({weekendCount})</span>
                            </div>
                            {holidayCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-sm bg-gradient-to-t from-amber-600/70 to-amber-400/60" />
                                    <span className="text-[9px] text-gray-600">Feriado ({holidayCount})</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">Total</p>
                    <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tabular-nums">
                        R$ {displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                        Média/{view === 'Mensal' ? 'dia' : view === 'Anual' ? 'mês' : 'ano'}: R$ {avgDaily.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
                        const showLabel = isMensal ? (i === 0 || i === data.length - 1 || i % 3 === 0) : true;

                        // Usa a string YYYY-MM-DD e dayOfWeek do servidor — SEM new Date()
                        const dayInfo = isMensal
                            ? getDayType(item.date, item.dayOfWeek || 0, holidays)
                            : { type: 'workday' as const, label: '' };
                        const isWeekend = isMensal && dayInfo.type === 'weekend';
                        const isHoliday = isMensal && dayInfo.type === 'holiday';

                        // Bar color based on day type
                        let barClass = '';
                        if (!hasValue) {
                            barClass = isHoliday
                                ? 'bg-amber-500/[0.08]'
                                : isWeekend
                                    ? 'bg-gray-500/[0.06]'
                                    : 'bg-white/[0.04]';
                        } else if (isHoliday) {
                            barClass = 'bg-gradient-to-t from-amber-600/70 to-amber-400/60 group-hover:from-amber-500 group-hover:to-amber-300 shadow-sm shadow-amber-500/20 group-hover:shadow-amber-400/40';
                        } else if (isWeekend) {
                            barClass = 'bg-gradient-to-t from-gray-600/50 to-gray-500/40 group-hover:from-gray-500 group-hover:to-gray-400 shadow-sm shadow-gray-500/10';
                        } else {
                            barClass = 'bg-gradient-to-t from-blue-600/70 to-cyan-400/70 group-hover:from-blue-500 group-hover:to-cyan-300 shadow-sm shadow-blue-500/20 group-hover:shadow-blue-400/40';
                        }

                        // Tooltip text
                        const tooltipExtra = isHoliday
                            ? ` · 🔸 ${dayInfo.label}`
                            : isWeekend
                                ? ` · ${dayInfo.label}`
                                : '';

                        // Label color
                        const labelClass = isHoliday
                            ? 'text-amber-500/70'
                            : isWeekend
                                ? 'text-gray-500/50'
                                : 'text-gray-600';

                        return (
                            <div
                                key={i}
                                className="relative flex-1 h-full flex flex-col justify-end items-center group"
                                title={`${view === 'Mensal' ? 'Dia ' : ''}${item.dayLabel}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${tooltipExtra}`}
                            >
                                {/* Hover tooltip */}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                                    <div className="bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-xl">
                                        <span>R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        {(isHoliday || isWeekend) && (
                                            <span className={`ml-1 ${isHoliday ? 'text-amber-400' : 'text-gray-400'}`}>
                                                {isHoliday ? `🔸${dayInfo.label}` : dayInfo.label}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Holiday/Weekend indicator dot */}
                                {isHoliday && (
                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-0 z-10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                                    </div>
                                )}

                                {/* Bar */}
                                <div
                                    className={`w-full max-w-[32px] min-w-[3px] rounded-t transition-all duration-200 ${barClass}`}
                                    style={{ height: hasValue ? `${heightPercentage}%` : '2%' }}
                                />

                                {/* Label — texto puro do servidor, sem Date */}
                                <span className={`text-[8px] mt-1.5 block h-3 text-center w-full tabular-nums ${labelClass}`}>
                                    {showLabel ? (
                                        <>
                                            {item.dayLabel}
                                            {isHoliday && <span className="text-amber-400"> ●</span>}
                                        </>
                                    ) : isHoliday ? (
                                        <span className="text-amber-400">●</span>
                                    ) : ''}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
