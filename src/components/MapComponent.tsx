'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const createColoredIcon = (colorHex: string) => {
    return new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${colorHex}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

// Sub-componente responsável por fazer o auto-enquadramento
function MapBounds({ clientes }: { clientes: any[] }) {
    const map = useMap();

    useEffect(() => {
        if (clientes && clientes.length > 0) {
            // Calcula os limites geográficos que englobam todos os clientes
            const bounds = L.latLngBounds(clientes.map(c => [c.latitude, c.longitude]));
            // Dá um zoom que enquadre todos os pins com uma margem de segurança de 50px
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [clientes, map]);

    return null;
}

export default function MapComponent({ clientes }: { clientes: any[] }) {
    // Ponto de partida (Belo Horizonte) se a lista estiver vazia
    const fallbackCenter: [number, number] = [-19.9167, -43.9345];
    
    // Cores premium para vendedores
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
    const vendedorColors = useRef<Record<string, string>>({});

    // Garantir que não quebre se receber undefined
    const validClientes = clientes || [];
    
    console.log("Clientes recebidos no mapa:", validClientes.length);

    return (
        <MapContainer center={fallbackCenter} zoom={12} style={{ height: '100%', minHeight: '600px', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapBounds clientes={validClientes} />
            <MarkerClusterGroup 
                chunkedLoading={true}
                maxClusterRadius={30}
                disableClusteringAtZoom={13}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
            >
                {validClientes.map((cliente) => {
                    const isInactive = cliente.status !== 'Ativo';
                    const vid = cliente.vendedorId || 'sem_vendedor';
                    
                    let iconColor = '#374151'; // Cinza escuro para inativos
                    
                    if (!isInactive) {
                        if (!vendedorColors.current[vid]) {
                            vendedorColors.current[vid] = colors[Object.keys(vendedorColors.current).length % colors.length];
                        }
                        iconColor = vendedorColors.current[vid];
                    }

                    const icon = createColoredIcon(iconColor);

                    return (
                        <Marker key={cliente.id} position={[cliente.latitude, cliente.longitude]} icon={icon}>
                            <Popup>
                                <div className="text-gray-800 p-1">
                                    <strong className="text-sm block mb-1">
                                        {cliente.nomeFantasia || cliente.razaoSocial}
                                        {cliente.numero && (
                                            <span className="text-amber-600 block text-xs mt-0.5 border-t border-gray-200 pt-0.5">
                                                Box/Pav: {cliente.numero}
                                            </span>
                                        )}
                                    </strong>
                                    <span className={`text-xs font-bold block ${isInactive ? 'text-red-500' : 'text-emerald-500'}`}>
                                        Status: {cliente.status || 'Ativo'}
                                    </span>
                                    <span className="text-xs text-gray-500 block mt-1">Cidade: {cliente.cidade} - {cliente.estado}</span>
                                    <span className="text-xs block mt-1 font-semibold" style={{ color: isInactive ? '#4b5563' : iconColor }}>
                                        Vendedor: {(cliente as any).vendedor?.nome || 'Sem Vendedor'}
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MarkerClusterGroup>
        </MapContainer>
    );
}
