'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Store, Target } from 'lucide-react';

interface CalculadoraPDVProps {
    cnpj: string;
    faturamentoPeriodo: number;
    volumePeriodo: number;
}

export function CalculadoraPDV({ cnpj, faturamentoPeriodo, volumePeriodo }: CalculadoraPDVProps) {
    const [quantidadeLojas, setQuantidadeLojas] = useState<number>(1);
    const [isHydrated, setIsHydrated] = useState<boolean>(false);

    // Chave no localStorage padronizada: pdv_lojas_${cnpj}
    const getStorageKey = useCallback(() => {
        const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : '';
        return cleanCnpj ? `pdv_lojas_${cleanCnpj}` : (cnpj ? `pdv_lojas_${cnpj}` : '');
    }, [cnpj]);

    // 1. Ler do localStorage na montagem
    useEffect(() => {
        const key = getStorageKey();
        if (!key) return;

        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 1) {
                    setQuantidadeLojas(parsed);
                }
            }
        } catch (err) {
            console.error('Erro ao ler pdv_lojas do localStorage:', err);
        } finally {
            setIsHydrated(true);
        }
    }, [getStorageKey]);

    // 2. Salvar no localStorage quando o usuário altera a quantidade
    useEffect(() => {
        if (!isHydrated) return;
        const key = getStorageKey();
        if (!key) return;

        try {
            localStorage.setItem(key, String(quantidadeLojas));
        } catch (err) {
            console.error('Erro ao gravar pdv_lojas no localStorage:', err);
        }
    }, [quantidadeLojas, isHydrated, getStorageKey]);

    const handleLojasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        setQuantidadeLojas(isNaN(val) || val < 1 ? 1 : Math.min(val, 99999));
    };

    // Cálculos em tempo real baseados nas métricas macro do período
    const faturamentoPorLoja = quantidadeLojas > 0 ? faturamentoPeriodo / quantidadeLojas : 0;
    const volumePorLoja = quantidadeLojas > 0 ? volumePeriodo / quantidadeLojas : 0;

    const faturamentoFmt = faturamentoPorLoja.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const volumeFmt = volumePorLoja % 1 === 0
        ? volumePorLoja.toLocaleString('pt-BR')
        : volumePorLoja.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return (
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors print:border-gray-200 print:bg-gray-50">
            {/* Input discreto e amigável */}
            <div className="flex items-center gap-2 text-xs">
                <Store className="h-4 w-4 text-indigo-400 print:text-indigo-600 flex-shrink-0" />
                <label htmlFor="pdv-lojas-input" className="text-gray-400 font-medium whitespace-nowrap print:text-gray-700">
                    Lojas da Rede (PDV):
                </label>
                <div className="relative inline-flex items-center">
                    <input
                        id="pdv-lojas-input"
                        type="number"
                        min={1}
                        max={9999}
                        value={quantidadeLojas}
                        onChange={handleLojasChange}
                        className="w-14 bg-white/10 border border-white/15 focus:border-indigo-400 rounded-lg px-2 py-1 text-center font-bold text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none print:text-black print:border-gray-300"
                        title="Informe a quantidade de lojas/PDVs da rede para calcular a penetração média no período"
                    />
                </div>
                {quantidadeLojas > 1 && (
                    <button
                        type="button"
                        onClick={() => setQuantidadeLojas(1)}
                        className="text-[11px] text-gray-500 hover:text-white transition-colors ml-0.5 print:hidden"
                        title="Redefinir para 1 loja"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Cálculo em tempo real quando quantidadeLojas > 1 */}
            {quantidadeLojas > 1 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs font-semibold text-indigo-200 print:border-indigo-300 print:bg-indigo-50 print:text-indigo-900 animate-in">
                    <Target className="h-3.5 w-3.5 text-indigo-400 print:text-indigo-600 flex-shrink-0" />
                    <span>
                        🎯 Penetração: <span className="text-white print:text-black font-bold">R$ {faturamentoFmt}/loja</span>
                        <span className="text-indigo-400/60 mx-1.5">|</span>
                        <span className="text-emerald-400 print:text-emerald-700 font-bold">{volumeFmt} und/loja</span> no período
                    </span>
                </div>
            ) : (
                <span className="text-[11px] text-gray-500 italic print:hidden">
                    Altere o número de lojas para ver a penetração média por PDV
                </span>
            )}
        </div>
    );
}

export default CalculadoraPDV;
