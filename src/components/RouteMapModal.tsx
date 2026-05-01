/* eslint-disable */
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, MapPin, Navigation, Clock, AlertTriangle, Loader2, CheckCircle2, Route } from 'lucide-react';
import type { Client } from '@/contexts/DataContext';
import dynamic from 'next/dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CargaResult {
    id: number;
    orders: any[];
    totalVolume: number;
    capacity: number;
    occupancyPct: number;
    isPalletized?: boolean;
    hasRestrictedClient?: boolean;
}

interface GeocodedClient {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    found: boolean;
    stopNumber: number;
}

interface RouteInfo {
    distance: number; // meters
    duration: number; // seconds
    geometry: any;    // GeoJSON geometry
}

interface RouteMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    truck: CargaResult;
    clients: Client[];
}

// ─── Leaflet Map (Client-Only) ───────────────────────────────────────────────

const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-[#0a0f1a]">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
    ),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function buildAddress(client: Client): string {
    const parts: string[] = [];
    if (client.endereco) parts.push(client.endereco);
    if (client.numero) parts.push(client.numero);
    if (client.bairro) parts.push(client.bairro);
    if (client.cidade) parts.push(client.cidade);
    if (client.estado || client.uf) parts.push(client.estado || client.uf || '');
    if (client.cep) parts.push(client.cep);
    return parts.filter(Boolean).join(', ');
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const encoded = encodeURIComponent(address);
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&countrycodes=br`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'FRPlus-Logistics/1.0'
                }
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
        return null;
    } catch {
        return null;
    }
}

async function fetchRoute(coords: { lat: number; lng: number }[]): Promise<RouteInfo | null> {
    try {
        const coordString = coords.map(c => `${c.lng},${c.lat}`).join(';');
        const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
            };
        }
        return null;
    } catch {
        return null;
    }
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}min`;
    return `${mins} min`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RouteMapModal({ isOpen, onClose, truck, clients }: RouteMapModalProps) {
    const [geocodedClients, setGeocodedClients] = useState<GeocodedClient[]>([]);
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    // Extract unique client names from truck blocks
    const uniqueClients = useMemo(() => {
        const seen = new Set<string>();
        const result: { name: string; clientData: Client | null }[] = [];

        for (const block of truck.orders) {
            const clientName = block.nomeCliente || 'Desconhecido';
            if (seen.has(clientName)) continue;
            seen.add(clientName);

            // Find client record by matching name or clienteId from the orders inside the block
            let clientData: Client | null = null;

            // Try to find by clienteId from inner orders first
            if (block.orders && Array.isArray(block.orders)) {
                for (const order of block.orders) {
                    if (order.clienteId) {
                        const found = clients.find(c => c.id === order.clienteId);
                        if (found) { clientData = found; break; }
                    }
                }
            }

            // Fallback: match by razaoSocial or nomeFantasia
            if (!clientData) {
                clientData = clients.find(c =>
                    c.razaoSocial?.toLowerCase() === clientName.toLowerCase() ||
                    c.nomeFantasia?.toLowerCase() === clientName.toLowerCase() ||
                    c.nome?.toLowerCase() === clientName.toLowerCase()
                ) || null;
            }

            result.push({ name: clientName, clientData });
        }
        return result;
    }, [truck, clients]);

    // Geocode all clients when modal opens
    const performGeocoding = useCallback(async () => {
        abortRef.current = false;
        setLoading(true);
        setError(null);
        setRouteInfo(null);
        setProgress({ current: 0, total: uniqueClients.length });

        const results: GeocodedClient[] = [];

        for (let i = 0; i < uniqueClients.length; i++) {
            if (abortRef.current) break;

            const { name, clientData } = uniqueClients[i];
            setProgress({ current: i + 1, total: uniqueClients.length });

            if (!clientData || !buildAddress(clientData).trim()) {
                results.push({
                    name,
                    address: clientData ? buildAddress(clientData) : 'Endereço não cadastrado',
                    lat: null,
                    lng: null,
                    found: false,
                    stopNumber: i + 1,
                });
                continue;
            }

            const address = buildAddress(clientData);
            const coords = await geocodeAddress(address);

            results.push({
                name,
                address,
                lat: coords?.lat ?? null,
                lng: coords?.lng ?? null,
                found: !!coords,
                stopNumber: i + 1,
            });

            // Rate limit: wait 1.1s between Nominatim requests
            if (i < uniqueClients.length - 1) {
                await sleep(1100);
            }
        }

        setGeocodedClients(results);

        // Calculate route with valid coordinates
        const validCoords = results
            .filter(c => c.found && c.lat !== null && c.lng !== null)
            .map(c => ({ lat: c.lat!, lng: c.lng! }));

        if (validCoords.length >= 2) {
            const route = await fetchRoute(validCoords);
            if (route) {
                setRouteInfo(route);
            } else {
                setError('Não foi possível calcular a rota entre os pontos.');
            }
        } else if (validCoords.length === 1) {
            // Only one point, no route to draw
        } else {
            setError('Nenhum endereço pôde ser geocodificado.');
        }

        setLoading(false);
    }, [uniqueClients]);

    useEffect(() => {
        if (isOpen) {
            performGeocoding();
        }
        return () => {
            abortRef.current = true;
        };
    }, [isOpen, performGeocoding]);

    if (!isOpen) return null;

    const foundCount = geocodedClients.filter(c => c.found).length;
    const notFoundCount = geocodedClients.filter(c => !c.found).length;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-[95vw] max-w-[1400px] h-[90vh] max-h-[850px] rounded-2xl border border-white/[0.08] bg-[#0a0f1a] shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#0c1220] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
                            <Route className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">
                                Rota — Caminhão {truck.id}
                            </h2>
                            <p className="text-[10px] text-gray-500">
                                {truck.orders.length} cliente{truck.orders.length !== 1 ? 's' : ''} · {truck.totalVolume}/{truck.capacity} cxs · {truck.occupancyPct}% ocupação
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Loading Bar */}
                {loading && (
                    <div className="shrink-0 px-5 py-3 bg-[#0c1220]/60 border-b border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs text-gray-400">
                                        Geocodificando endereços...
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                        {progress.current}/{progress.total}
                                    </span>
                                </div>
                                <div className="w-full bg-[#0a0f1a] h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Body: Map + Sidebar */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Map Container */}
                    <div className="flex-1 relative">
                        <LeafletMapInner
                            geocodedClients={geocodedClients}
                            routeInfo={routeInfo}
                            loading={loading}
                        />
                    </div>

                    {/* Sidebar */}
                    <div className="w-[320px] shrink-0 border-l border-white/[0.06] bg-[#0c1220] flex flex-col overflow-hidden">
                        {/* Sidebar Header */}
                        <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-blue-400" />
                                Paradas da Rota
                            </h3>
                        </div>

                        {/* Route Stats */}
                        {routeInfo && !loading && (
                            <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Navigation className="h-3 w-3 text-blue-400" />
                                            <span className="text-[9px] text-gray-500 uppercase font-semibold">Distância</span>
                                        </div>
                                        <span className="text-sm font-bold text-blue-400">
                                            {formatDistance(routeInfo.distance)}
                                        </span>
                                    </div>
                                    <div className="bg-cyan-500/5 rounded-lg p-2.5 border border-cyan-500/10">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Clock className="h-3 w-3 text-cyan-400" />
                                            <span className="text-[9px] text-gray-500 uppercase font-semibold">Tempo Est.</span>
                                        </div>
                                        <span className="text-sm font-bold text-cyan-400">
                                            {formatDuration(routeInfo.duration)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Client List */}
                        <div className="flex-1 overflow-y-auto">
                            {geocodedClients.length === 0 && loading && (
                                <div className="p-4 text-center text-gray-600 text-xs">
                                    Aguardando geocodificação...
                                </div>
                            )}
                            {geocodedClients.map((client, idx) => (
                                <div
                                    key={idx}
                                    className={`px-4 py-3 border-b border-white/[0.03] transition-colors ${
                                        client.found
                                            ? 'hover:bg-white/[0.02]'
                                            : 'bg-red-500/[0.03]'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Stop Number Badge */}
                                        <div
                                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                                client.found
                                                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-white/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}
                                        >
                                            {client.found ? client.stopNumber : '!'}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-200 truncate">
                                                {client.name}
                                            </p>
                                            {client.found ? (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                                    <span className="text-[10px] text-emerald-400/80 truncate">
                                                        {client.lat?.toFixed(4)}, {client.lng?.toFixed(4)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-1 mt-1">
                                                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                                                    <span className="text-[10px] text-amber-400/80 leading-tight">
                                                        Endereço não localizado no mapa gratuito
                                                    </span>
                                                </div>
                                            )}
                                            <p className="text-[9px] text-gray-600 mt-0.5 truncate" title={client.address}>
                                                {client.address}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Sidebar Footer Stats */}
                        {!loading && geocodedClients.length > 0 && (
                            <div className="px-4 py-2.5 border-t border-white/[0.06] shrink-0 bg-[#0a0f1a]">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-gray-500">
                                        <span className="text-emerald-400 font-bold">{foundCount}</span> localizado{foundCount !== 1 ? 's' : ''}
                                    </span>
                                    {notFoundCount > 0 && (
                                        <span className="text-gray-500">
                                            <span className="text-amber-400 font-bold">{notFoundCount}</span> não encontrado{notFoundCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Banner */}
                {error && !loading && (
                    <div className="shrink-0 px-5 py-2.5 bg-red-500/5 border-t border-red-500/10 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="text-xs text-red-400">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
