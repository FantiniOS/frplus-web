import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const reprocessarFalhas = body.reprocessarFalhas === true;

        const whereClause = reprocessarFalhas
            ? { geoStatus: 'FALHA' }
            : { geoStatus: 'PENDENTE' };

        // Fetch up to 5 clients
        const clientesPendentes = await prisma.cliente.findMany({
            where: whereClause,
            take: 5
        });

        if (clientesPendentes.length === 0) {
            return NextResponse.json({ message: 'Todos os clientes da fila estão sincronizados.', processed: 0, pending: 0 });
        }

        const { Client } = require("@googlemaps/google-maps-services-js");
        const gmaps = new Client({});
        const GOOGLE_API_KEY = process.env.Maps_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

        let processedCount = 0;

        for (const cliente of clientesPendentes) {
            let lat: number | null = null;
            let lon: number | null = null;

            // Limpeza agressiva do nome para a API do Google (remove LTDA, ME, EPP, CNPJs, etc)
            const cleanName = (name: string | null) => {
                if (!name) return '';
                return name.replace(/LTDA\.?|M\.?E\.?|E\.?P\.?P\.?|S\/?A\.?|CNPJ|[\d\.\-\/]+/gi, '').trim();
            };

            const nomeFantasiaClean = cleanName(cliente.nomeFantasia);
            const razaoSocialClean = cleanName(cliente.razaoSocial);

            // Evitar duplicação se forem iguais
            const baseName = nomeFantasiaClean === razaoSocialClean 
                ? nomeFantasiaClean 
                : `${nomeFantasiaClean} ${razaoSocialClean}`;

            if (GOOGLE_API_KEY) {
                try {
                    // TENTATIVA 1: Nome Fantasia + Razão + Bairro + Cidade - Estado
                    const query1 = `${baseName} ${cliente.bairro} ${cliente.cidade} - ${cliente.estado}`.trim();
                    let response = await gmaps.findPlaceFromText({
                        params: {
                            input: query1,
                            inputtype: 'textquery',
                            fields: ['geometry'],
                            key: GOOGLE_API_KEY
                        }
                    });

                    if (response.data.candidates && response.data.candidates.length > 0) {
                        const location = response.data.candidates[0].geometry?.location;
                        if (location) {
                            lat = location.lat;
                            lon = location.lng;
                        }
                    }

                    // TENTATIVA 2: Nome Fantasia + Rua + Cidade
                    if (lat === null || lon === null) {
                        const query2 = `${nomeFantasiaClean || razaoSocialClean} ${cliente.endereco} ${cliente.cidade}`.trim();
                        response = await gmaps.findPlaceFromText({
                            params: {
                                input: query2,
                                inputtype: 'textquery',
                                fields: ['geometry'],
                                key: GOOGLE_API_KEY
                            }
                        });

                        if (response.data.candidates && response.data.candidates.length > 0) {
                            const location = response.data.candidates[0].geometry?.location;
                            if (location) {
                                lat = location.lat;
                                lon = location.lng;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Google Maps API error:", e);
                }
            }

            // TENTATIVA 2: Fallback para Nominatim (Geocoding Clássico por Endereço)
            if (lat === null || lon === null) {
                const numeroStr = cliente.numero ? `, ${cliente.numero}` : '';
                const addressString = `${cliente.endereco}${numeroStr}, ${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}, Brasil`;
                
                let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`, {
                    headers: { 'User-Agent': 'FRPlus-Web-App (contato@frplus.com)' }
                });

                if (response.ok) {
                    let data = await response.json();
                    
                    if (!data || data.length === 0) {
                        await new Promise(resolve => setTimeout(resolve, 1200)); // sleep before retry
                        const fallbackAddress = `${cliente.endereco}, ${cliente.cidade} - ${cliente.estado}, Brasil`;
                        response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackAddress)}`, {
                            headers: { 'User-Agent': 'FRPlus-Web-App (contato@frplus.com)' }
                        });
                        if (response.ok) {
                            data = await response.json();
                        }
                    }

                    if (data && data.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lon = parseFloat(data[0].lon);
                    }
                } else {
                     console.error("Nominatim limit reached or error");
                }
                
                // Sleep for 1.2s apenas se usou Nominatim para respeitar o limite deles
                await new Promise(resolve => setTimeout(resolve, 1200));
            }

            // Atualizar Banco de Dados
            if (lat !== null && lon !== null) {
                await prisma.cliente.update({
                    where: { id: cliente.id },
                    data: {
                        latitude: lat,
                        longitude: lon,
                        geoStatus: 'MAPEADO'
                    }
                });
            } else {
                await prisma.cliente.update({
                     where: { id: cliente.id },
                     data: { latitude: 0, longitude: 0, geoStatus: 'FALHA' }
                });
            }
            
            processedCount++;
        }

        const remaining = await prisma.cliente.count({
            where: whereClause
        });

        return NextResponse.json({ 
            message: `Sincronizados ${processedCount} clientes.`, 
            processed: processedCount,
            pending: remaining
        });

    } catch (error) {
        console.error('Erro no geocode sync:', error);
        return NextResponse.json({ error: 'Erro ao sincronizar endereços.' }, { status: 500 });
    }
}
