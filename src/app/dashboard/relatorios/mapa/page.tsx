'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/contexts/DataContext';
import { MapPin, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-gray-400">Carregando mapa...</div> });

export default function MapaClientesPage() {
    const { clients, refreshData } = useData();
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ processed: number, pending: number } | null>(null);

    // Separação cega e segura: 
    // 1. Clientes com Lat/Lng NUMÉRICAS VÁLIDAS e que não são 0,0
    const clientesMapeados = clients.filter(c => 
        typeof c.latitude === 'number' && 
        typeof c.longitude === 'number' && 
        !(c.latitude === 0 && c.longitude === 0)
    );

    // Pendentes reais e Falhas baseados no novo status do Prisma
    // (fallback para a lógica antiga caso o banco ainda tenha nulos antigos)
    const qtdPendentes = clients.filter(c => 
        c.geoStatus === 'PENDENTE' || 
        (!c.geoStatus && (typeof c.latitude !== 'number' || typeof c.longitude !== 'number'))
    ).length;

    const qtdFalhas = clients.filter(c => 
        c.geoStatus === 'FALHA' || 
        (!c.geoStatus && c.latitude === 0 && c.longitude === 0)
    ).length;

    const handleSync = async () => {
        setSyncing(true);
        const reprocessarFalhas = qtdPendentes === 0 && qtdFalhas > 0;
        try {
            let pending = 1;
            while (pending > 0) {
                const res = await fetch('/api/clientes/geocode', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reprocessarFalhas })
                });
                const data = await res.json();
                
                if (data.pending !== undefined) {
                    pending = data.pending;
                    setSyncProgress({ processed: data.processed, pending: data.pending });
                } else {
                    break;
                }
                
                if (pending === 0 || data.processed === 0) break;
            }
            await refreshData();
        } catch (err) {
            console.error(err);
        }
        setSyncing(false);
        setSyncProgress(null);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)]">
            {/* Header / Barra de Ferramentas com Z-Index Alto */}
            <div className="relative z-50 bg-gray-900 border-b border-gray-800 shadow-md px-6 py-4 flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-xl">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <MapPin className="text-blue-500 w-5 h-5" />
                        Mapa de Regiões
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        Distribuição geográfica da carteira de clientes.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {syncProgress && (
                        <div className="text-xs text-blue-400 font-medium bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                            Processando... Faltam {syncProgress.pending}
                        </div>
                    )}

                    {qtdPendentes === 0 && qtdFalhas === 0 ? (
                        <button disabled className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 text-sm font-bold rounded-lg cursor-not-allowed">
                            <CheckCircle className="w-4 h-4" />
                            Todos Mapeados
                        </button>
                    ) : (
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-lg transition-all shadow-lg ${
                                syncing 
                                ? 'bg-blue-600/50 cursor-not-allowed' 
                                : qtdPendentes > 0 
                                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                            }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Processando...' : qtdPendentes > 0 ? `Sincronizar (${qtdPendentes} Pendentes)` : `Reprocessar Falhas (${qtdFalhas})`}
                        </button>
                    )}
                </div>
            </div>

            {/* Avisos */}
            {qtdPendentes > 0 && !syncing && (
                <div className="relative z-40 bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center gap-2 text-xs text-amber-400 font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Existem {qtdPendentes} clientes com endereço não sincronizado no banco. Clique em Sincronizar para buscar.
                </div>
            )}

            {/* Main Content Area (Map) */}
            <div className="flex-1 flex gap-0 overflow-hidden relative z-10 bg-black">
                {/* Container do Mapa isolado */}
                <div className="flex-1 relative z-0">
                    <MapComponent clientes={clientesMapeados} />
                </div>
            </div>
        </div>
    );
}
