/* eslint-disable */
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeocodedClient {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    found: boolean;
    stopNumber: number;
}

interface RouteInfo {
    distance: number;
    duration: number;
    geometry: any;
}

interface LeafletMapInnerProps {
    geocodedClients: GeocodedClient[];
    routeInfo: RouteInfo | null;
    loading: boolean;
}

// ─── Custom Numbered Marker Icon ─────────────────────────────────────────────

function createNumberedIcon(number: number): L.DivIcon {
    return L.divIcon({
        className: '',
        html: `
            <div style="
                width: 34px;
                height: 34px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2563eb, #06b6d4);
                color: white;
                font-weight: 700;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 12px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.25);
                border: 2px solid white;
                font-family: system-ui, -apple-system, sans-serif;
                position: relative;
            ">
                ${number}
                <div style="
                    position: absolute;
                    bottom: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 6px solid #06b6d4;
                "></div>
            </div>
        `,
        iconSize: [34, 40],
        iconAnchor: [17, 40],
        popupAnchor: [0, -40],
    });
}

// ─── Auto Fit Bounds ─────────────────────────────────────────────────────────

function FitBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap();

    useEffect(() => {
        if (positions.length === 0) return;

        if (positions.length === 1) {
            map.setView(positions[0], 14);
        } else {
            const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [positions, map]);

    return null;
}

// ─── Main Inner Map Component ────────────────────────────────────────────────

export default function LeafletMapInner({ geocodedClients, routeInfo, loading }: LeafletMapInnerProps) {
    const validClients = useMemo(
        () => geocodedClients.filter(c => c.found && c.lat !== null && c.lng !== null),
        [geocodedClients]
    );

    const positions = useMemo(
        () => validClients.map(c => [c.lat!, c.lng!] as [number, number]),
        [validClients]
    );

    // Extract polyline coordinates from OSRM GeoJSON response
    const routePositions = useMemo(() => {
        if (!routeInfo?.geometry?.coordinates) return [];
        // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
        return routeInfo.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        );
    }, [routeInfo]);

    // Default center: Brazil
    const defaultCenter: [number, number] = [-15.788, -47.879];
    const center = positions.length > 0 ? positions[0] : defaultCenter;

    return (
        <MapContainer
            center={center}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
            attributionControl={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Route Polyline */}
            {routePositions.length > 1 && (
                <>
                    {/* Shadow / glow effect */}
                    <Polyline
                        positions={routePositions}
                        pathOptions={{
                            color: '#06b6d4',
                            weight: 8,
                            opacity: 0.2,
                        }}
                    />
                    {/* Main route line */}
                    <Polyline
                        positions={routePositions}
                        pathOptions={{
                            color: '#2563eb',
                            weight: 4,
                            opacity: 0.9,
                            dashArray: undefined,
                        }}
                    />
                </>
            )}

            {/* Numbered Markers */}
            {validClients.map((client, idx) => (
                <Marker
                    key={idx}
                    position={[client.lat!, client.lng!]}
                    icon={createNumberedIcon(client.stopNumber)}
                />
            ))}

            {/* Auto-fit bounds */}
            {positions.length > 0 && <FitBounds positions={positions} />}
        </MapContainer>
    );
}
