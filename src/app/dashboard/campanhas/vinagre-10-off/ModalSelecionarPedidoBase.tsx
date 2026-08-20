'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, Package } from 'lucide-react';
import { buscarPedidosVinagre, PedidoVinagre } from '@/app/actions/buscarPedidosVinagre';
import { salvarOverrideVolume } from '@/app/actions/salvarOverrideVolume';

interface Props {
    clienteId: string;
    clienteNome: string;
    onClose: () => void;
    onSaved: (clienteId: string, volumeAnterior: number, metaCaixas: number) => void;
}

export default function ModalSelecionarPedidoBase({ clienteId, clienteNome, onClose, onSaved }: Props) {
    const [pedidos, setPedidos] = useState<PedidoVinagre[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await buscarPedidosVinagre(clienteId);
                setPedidos(data);
            } catch (err: any) {
                setError(err?.message || 'Erro ao buscar pedidos');
            } finally {
                setLoading(false);
            }
        })();
    }, [clienteId]);

    const handleSave = async () => {
        if (!selectedId) return;
        const pedido = pedidos.find(p => p.id === selectedId);
        if (!pedido) return;

        setSaving(true);
        try {
            const result = await salvarOverrideVolume(clienteId, selectedId, pedido.qtdVinagre);
            onSaved(clienteId, result.volumeAnteriorOverride, result.metaCaixas);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div>
                        <h2 className="text-lg font-bold text-white">Selecionar Pedido-Base</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{clienteNome}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
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
                            <thead className="text-xs uppercase text-gray-500 border-b border-white/10">
                                <tr>
                                    <th className="py-3 pr-2 text-left w-8"></th>
                                    <th className="py-3 px-2 text-left">Data</th>
                                    <th className="py-3 px-2 text-left">Nº Pedido</th>
                                    <th className="py-3 px-2 text-left">Status</th>
                                    <th className="py-3 px-2 text-left">Tipo</th>
                                    <th className="py-3 px-2 text-right">Qtd Vinagre (cx)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pedidos.map(p => (
                                    <tr
                                        key={p.id}
                                        onClick={() => setSelectedId(p.id)}
                                        className={`cursor-pointer transition-colors ${
                                            selectedId === p.id
                                                ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                                                : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <td className="py-3 pr-2 text-center">
                                            <input
                                                type="radio"
                                                name="pedidoBase"
                                                checked={selectedId === p.id}
                                                onChange={() => setSelectedId(p.id)}
                                                className="accent-blue-500"
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
                                        <td className="py-3 px-2 text-gray-400 text-xs">{p.tipo}</td>
                                        <td className="py-3 px-2 text-right font-bold text-cyan-400 font-mono">
                                            {p.qtdVinagre}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                    <p className="text-xs text-gray-500">
                        {selectedId
                            ? `Selecionado: ${pedidos.find(p => p.id === selectedId)?.qtdVinagre ?? 0} cx → Meta: ${Math.ceil((pedidos.find(p => p.id === selectedId)?.qtdVinagre ?? 0) * 1.5)} cx`
                            : 'Selecione um pedido para usar como base'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!selectedId || saving}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                            ) : (
                                <><CheckCircle2 className="h-4 w-4" /> Salvar Seleção</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
