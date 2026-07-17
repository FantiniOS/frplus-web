import React from 'react';

interface PrintHeaderProps {
    titulo: string;
    subtitulo?: string;
}

export function PrintHeader({ titulo, subtitulo }: PrintHeaderProps) {
    return (
        <div className="hidden print:block print:mb-6 page-break-inside-avoid">
            <div className="flex items-center justify-between border-b-2 border-blue-600 pb-3">
                <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="FRPlus" className="h-10 w-auto object-contain print:block" />
                    <div>
                        <h1 className="text-2xl font-bold text-black">{titulo}</h1>
                        {subtitulo && <p className="text-sm text-gray-600 mt-1">{subtitulo}</p>}
                    </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                    <p className="font-semibold text-black">FRPlus Gestão Comercial</p>
                    <p>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
        </div>
    );
}
