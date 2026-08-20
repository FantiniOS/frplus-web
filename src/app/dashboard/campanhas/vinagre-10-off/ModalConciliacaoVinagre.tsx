'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, CheckCircle2, Package } from 'lucide-react';
import { buscarPedidosConciliacaoVinagre, PedidoConciliacaoVinagre } from '@/app/actions/buscarPedidosConciliacaoVinagre';
import { salvarConciliacaoVinagre } from '@/app/actions/salvarConciliacaoVinagre';

interface Props {
    clienteId: string;
    clienteNome: string;
    onClose: () => void;
    onSaved: () => void;
}

export default function ModalConciliacaoVinagre({ clienteId, clienteNome, onClose, onSaved }: Props) {
    const [pedidos, setPedidos] = useState<PedidoConciliacaoVinagre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await buscarPedidosConciliacaoVinagre(clienteId);
                setPedidos(data);
                
                const initialSelected = new Set<string>();
                data.forEach(p => {
                    if (p.isLinked) initialSelected.add(p.id);
                });
                setSelectedIds(initialSelected);
            } catch (err: any) {
                setError(err?.message || 'Erro ao buscar pedidos');
            } finally {
                setLoading(false);
            }
        })();
    }, [clienteId]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const orig = pedidos.filter(p => p.isLinked).map(p => p.id);
            const selected = Array.from(selectedIds);
            
            const vincular = selected.filter(id => !orig.includes(id));
            const desvincular = orig.filter(id => !selected.includes(id));

            if (vincular.length > 0 || desvincular.length > 0) {
                await salvarConciliacaoVinagre(vincular, desvincular);
            }
            
            onSaved();
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar vinculação');
            setSaving(false);
        }
    };

    const totalCaixasSelecionadas = useMemo(() => {
        return pedidos
            .filter(p => selectedIds.has(p.id))
            .reduce((sum, p) => sum + p.qtdVinagre, 0);
    }, [pedidos, selectedIds]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">Alocar Pedidos para Campanha</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{clienteNome}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 overflow-y-auto grow">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                            <span className="ml-3 text-gray-400 text-sm">Buscando histórico de pedidos...</span>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-8">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {!loading && !error && pedidos.length === 0 && (
                        <div className="text-center py-12">
                            <Package className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">Nenhum pedido com Vinagre de Álcool encontrado.</p>
                        </div>
                    )}

                    {!loading && !error && pedidos.length > 0 && (
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase text-gray-500 border-b border-white/10 sticky top-0 bg-slate-900 z-10 shadow-sm">
                                <tr>
                                    <th className="py-3 pr-2 text-left w-8"></th>
                                    <th className="py-3 px-2 text-left">Data</th>
                                    <th className="py-3 px-2 text-left">Nº Pedido</th>
                                    <th className="py-3 px-2 text-left">Status</th>
                                    <th className="py-3 px-2 text-right">Volume (cx)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pedidos.map(p => {
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => handleToggle(p.id)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                                                    : 'hover:bg-white/5'
                                            }`}
                                        >
                                            <td className="py-3 pr-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggle(p.id)}
                                                    className="accent-blue-500 w-4 h-4 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="py-3 px-2 text-gray-300">
                                                {new Date(p.data).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="py-3 px-2 text-gray-400 font-mono text-xs">
                                                {p.numeroPedido}
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    p.status === 'Faturado' || p.status === 'Concluido'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : p.status === 'Pendente'
                                                        ? 'bg-amber-500/10 text-amber-400'
                                                        : 'bg-gray-500/10 text-gray-400'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right font-bold text-cyan-400 font-mono">
                                                {p.qtdVinagre}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-900 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Volume Alocado</p>
                        <p className="text-2xl font-black text-cyan-400">{totalCaixasSelecionadas} <span className="text-sm font-bold text-cyan-600">cx</span></p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                            ) : (
                                <><CheckCircle2 className="h-4 w-4" /> Salvar Vinculação</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
