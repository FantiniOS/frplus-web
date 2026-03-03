'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

interface MonthSelectorProps {
    value: string; // Format: 'YYYY-MM' or ''
    onChange: (value: string) => void;
    placeholder?: string;
}

/**
 * Generates an array of the last N months starting from TODAY, in descending order.
 * Index 0 = current month, Index 1 = last month, etc.
 * Uses Intl.DateTimeFormat for locale-safe month names.
 */
function generateMonths(count: number = 24): { value: string; label: string }[] {
    const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
    const result: { value: string; label: string }[] = [];

    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(1);                    // Pin to 1st to avoid 31→28 overflow
        d.setMonth(d.getMonth() - i);    // Subtract i months from today

        const year = d.getFullYear();
        const month = d.getMonth() + 1;  // 1-12
        const valueStr = `${year}-${String(month).padStart(2, '0')}`;

        const monthName = formatter.format(d);
        const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} / ${year}`;

        result.push({ value: valueStr, label });
    }

    return result;
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

    // Memoize the month list (descending: current month first)
    const monthOptions = useMemo(() => generateMonths(24), []);

    // Display string for trigger button
    const displayValue = useMemo(() => {
        if (!value) return placeholder;
        const opt = monthOptions.find(o => o.value === value);
        if (opt) return opt.label;

        // Fallback for dates outside the 24-month window
        const [y, m] = value.split('-');
        if (y && m) {
            const d = new Date(parseInt(y), parseInt(m) - 1, 15);
            const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
            const name = formatter.format(d);
            return `${name.charAt(0).toUpperCase() + name.slice(1)} / ${y}`;
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
                    <span className="text-sm font-medium text-white select-none whitespace-nowrap min-w-[130px] text-left">
                        {displayValue}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Clear Button */}
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
                <div className="absolute right-0 top-full mt-2 w-64 max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/80 z-[100] flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* "All History" option */}
                    <button
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className={`w-full flex items-center justify-between p-3 select-none cursor-pointer transition-colors border-b border-white/[0.06]
                            ${!value ? 'bg-blue-500/10 text-blue-400' : 'text-gray-300 hover:bg-white/5'}`}
                    >
                        <span className="font-semibold text-sm">{placeholder}</span>
                        {!value && <Check className="h-4 w-4" />}
                    </button>

                    {/* Flat descending list: current month → 23 months ago */}
                    {monthOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between p-3 select-none cursor-pointer transition-colors
                                ${value === opt.value
                                    ? 'bg-blue-500/20 text-white font-medium border-l-2 border-l-blue-500'
                                    : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                        >
                            <span className="text-sm">{opt.label}</span>
                            {value === opt.value && <Check className="h-4 w-4 text-blue-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

