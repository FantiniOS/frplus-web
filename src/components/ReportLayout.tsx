import React from 'react';

interface ReportLayoutProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

export function ReportLayout({ title, subtitle, children }: ReportLayoutProps) {
    const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="hidden print:block w-full print:exact-colors print:bg-white bg-white text-black min-h-screen">
            {/* 
                Usamos uma tabela para forçar o navegador a repetir o THEAD e o TFOOT 
                em todas as páginas impressas, simulando perfeitamente o jsPDF.
            */}
            <table className="w-full">
                {/* ====== HEADER REPETIDO EM TODAS AS PÁGINAS ====== */}
                <thead className="w-full">
                    <tr>
                        <td>
                            <div className="flex flex-col mb-6">
                                {/* Fundo escuro principal */}
                                <div className="h-[38px] bg-[#0a0a0e] w-full flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <img src="/logo.png" alt="FRPlus Logo" className="h-[20px] w-auto object-contain" />
                                    </div>
                                    <div className="text-right">
                                        <h1 className="text-white text-[13px] font-bold uppercase tracking-wide m-0 leading-tight">
                                            {title}
                                        </h1>
                                        {subtitle && (
                                            <p className="text-[#c8c8dc] text-[8px] mt-0.5 m-0 leading-tight">
                                                {subtitle}
                                            </p>
                                        )}
                                        <p className="text-[#c8c8dc] text-[7px] mt-0.5 m-0 leading-tight">
                                            Emitido em {dataEmissao}
                                        </p>
                                    </div>
                                </div>
                                {/* Faixas decorativas de sotaque */}
                                <div className="flex h-[1.5px] w-full">
                                    <div className="bg-[#2563eb] w-[40%] h-full"></div>
                                    <div className="bg-[#06b6d4] w-[60%] h-full"></div>
                                </div>
                            </div>
                        </td>
                    </tr>
                </thead>

                {/* ====== CONTEÚDO ====== */}
                <tbody className="w-full">
                    <tr>
                        <td>
                            <div className="w-full px-4">
                                {children}
                            </div>
                        </td>
                    </tr>
                </tbody>

                {/* ====== RODAPÉ REPETIDO EM TODAS AS PÁGINAS ====== */}
                <tfoot className="w-full">
                    <tr>
                        <td>
                            <div className="mt-8 pt-2 border-t-[0.3px] border-[#e2e8f0] px-4 flex items-center justify-between">
                                <span className="text-[7px] text-[#78788c] font-normal">
                                    FRPlus — Gestão Comercial Inteligente
                                </span>
                                <span className="text-[7px] text-[#78788c] font-normal">
                                    Documento gerado eletronicamente
                                </span>
                                <span className="text-[7px] text-[#78788c] font-bold">
                                    Página Impressa
                                </span>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
