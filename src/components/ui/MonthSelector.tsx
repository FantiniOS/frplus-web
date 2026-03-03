'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

interface MonthSelectorProps {
    value: string; // Format: 'YYYY-MM' or ''
    onChange: (value: string) => void;
    placeholder?: string;
}

export function MonthSelector({ value, onChange, placeholder = 'Todo o Histórico' }: MonthSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Generate last 24 months
    const monthOptions = useMemo(() => {
        const options: { value: string; label: string; group: string }[] = [];
        const today = new Date();
        const startYear = today.getFullYear();
        const startMonth = today.getMonth();

        for (let i = 0; i < 24; i++) {
            let m = startMonth - i;
            let y = startYear;

            while (m < 0) {
                m += 12;
                y -= 1;
            }

            const valueStr = `${y}-${String(m + 1).padStart(2, '0')}`;
            // Constructing a date in the middle of the month avoids any timezone/daylight saving shifts
            const safeDate = new Date(y, m, 15);
            const labelStr = safeDate.toLocaleString('pt-BR', { month: 'long' });
            const labelCap = labelStr.charAt(0).toUpperCase() + labelStr.slice(1);

            options.push({
                value: valueStr,
                label: labelCap,
                group: String(y)
            });
        }
        return options;
    }, []);

    // Display string for trigger
    const displayValue = useMemo(() => {
        if (!value) return placeholder;
        const opt = monthOptions.find(o => o.value === value);
        if (opt) return `${opt.label} / ${opt.group}`;

        // Fallback for custom dates outside 24 mo range
        const [y, m] = value.split('-');
        if (y && m) {
            const d = new Date(parseInt(y), parseInt(m) - 1, 15);
            const l = d.toLocaleString('pt-BR', { month: 'long' });
            return `${l.charAt(0).toUpperCase() + l.slice(1)} / ${y}`;
        }
        return value;
    }, [value, monthOptions, placeholder]);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            {/* Trigger Button */}
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl px-1 transition-all">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 pl-2 pr-1 py-1.5 focus:outline-none"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-white select-none whitespace-nowrap min-w-[110px] text-left">
                        {displayValue}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Clear Button (only shown if a month is selected) */}
                {value && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                            setIsOpen(false);
                        }}
                        className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors mr-1"
                        title="Limpar filtro"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/80 z-[100] flex flex-col py-2 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Placeholder / "All time" Option */}
                    <button
                        onClick={() => {
                            onChange('');
                            setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 select-none transition-colors border-b border-white/[0.04]
                            ${!value ? 'bg-blue-500/10 text-blue-400' : 'text-gray-300 hover:bg-white/5'}`}
                    >
                        <span className="font-semibold text-sm">{placeholder}</span>
                        {!value && <Check className="h-4 w-4" />}
                    </button>

                    {/* Group by Year */}
                    {Object.entries(
                        monthOptions.reduce((acc, opt) => {
                            if (!acc[opt.group]) acc[opt.group] = [];
                            acc[opt.group].push(opt);
                            return acc;
                        }, {} as Record<string, typeof monthOptions>)
                    ).map(([year, months]) => (
                        <div key={year} className="mt-2 first:mt-0">
                            <div className="px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-white/[0.02]">
                                {year}
                            </div>
                            {months.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between p-3 select-none transition-colors
                                        ${value === opt.value
                                            ? 'bg-blue-500/20 text-white font-medium border-l-2 border-l-blue-500'
                                            : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span className="text-sm capitalize">{opt.label}</span>
                                    {value === opt.value && <Check className="h-4 w-4 text-blue-400" />}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
