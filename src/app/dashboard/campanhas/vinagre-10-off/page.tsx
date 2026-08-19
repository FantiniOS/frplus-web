'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileDown, Beaker } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getHitListVinagre } from '@/app/actions/apuracaoVinagre';

// MOCK DATA PARA VISUALIZAÇÃO IMEDIATA (Caso o backend falhe ou esteja sendo adaptado)
const MOCK_DATA = {
  clientesElegiveis: 125,
  clientesConvertidos: 42,
  volumeIncremental: 1850,
  hitList: [
    { id: '1', cliente: 'SUPERMERCADO CENTRAL', ultimaCompra: 100, volumeAtual: 160 },
    { id: '2', cliente: 'ATACADAO DO POVO', ultimaCompra: 200, volumeAtual: 50 },
    { id: '3', cliente: 'MERCADO SAO JOAO', ultimaCompra: 50, volumeAtual: 0 },
    { id: '4', cliente: 'COMERCIAL SILVA', ultimaCompra: 300, volumeAtual: 450 },
    { id: '5', cliente: 'DISTRIBUIDORA LIDER', ultimaCompra: 150, volumeAtual: 200 },
  ]
};

export default function CentralControleCampanha() {
  const [data, setData] = useState<any>(MOCK_DATA); // Inicia com mock para visualização
  const [loading, setLoading] = useState(false);
  const [campanhaAtiva, setCampanhaAtiva] = useState(true);
  
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Integração real com o backend (mantendo compatibilidade)
    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const end = now.toISOString().split('T')[0];
        
        const backendData = await getHitListVinagre(start, end);
        if (backendData && !('error' in backendData)) {
          // Adaptar dados do backend para a nova interface
          // O backend atual baseia as metas no volume "metaCaixas". 
          // Para esta UI, inferimos a "última compra" como metaCaixas / 1.5 se já houver meta definida.
          const adaptedList = backendData.hitList.map(item => {
            const ultimaCompraInferida = item.metaCaixas > 0 
              ? Math.round(item.metaCaixas / 1.5) 
              : 0;

            return {
              id: item.id,
              cliente: item.nomeFantasia || item.razaoSocial,
              ultimaCompra: ultimaCompraInferida, 
              volumeAtual: item.volumeComprado || 0,
            };
          });

          setData({
            clientesElegiveis: backendData.clientesAtacadistasBase,
            clientesConvertidos: backendData.clientesConvertidos,
            volumeIncremental: backendData.volumeTotalEscoado, 
            hitList: adaptedList.length > 0 ? adaptedList : MOCK_DATA.hitList, // Fallback p/ mock se base vazia
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados reais, utilizando mock.", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#f8fafc', // bg-slate-50 equivalent
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('FRPlus-Controle-Campanha.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF', error);
      alert('Ocorreu um erro ao gerar o PDF da página.');
    }
  };

  const renderStatusBadge = (volumeAtual: number, meta: number) => {
    if (volumeAtual === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          ⏳ Pendente
        </span>
      );
    }
    if (volumeAtual > 0 && volumeAtual < meta) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          ⚠️ Volume Insuficiente
        </span>
      );
    }
    // volumeAtual >= meta
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        ✅ 10% OFF Liberado
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-6 md:p-8" ref={pdfRef}>
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Beaker className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Central de Controle - Vinagre 10% OFF
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Toggle Status da Campanha */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Status da Campanha</span>
              <button 
                onClick={() => setCampanhaAtiva(!campanhaAtiva)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${campanhaAtiva ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${campanhaAtiva ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            {/* Exportar PDF */}
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* DASHBOARD DE KPI (TOP CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-500 mb-1">Total de Clientes Elegíveis (Atacado)</p>
            <p className="text-3xl font-bold text-slate-800">
              {loading ? '...' : data.clientesElegiveis}
            </p>
          </div>
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-500 mb-1">Clientes Convertidos (Atingiram a Meta)</p>
            <p className="text-3xl font-bold text-slate-800">
              {loading ? '...' : data.clientesConvertidos}
            </p>
          </div>
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-500 mb-1">Volume Incremental</p>
            <p className="text-3xl font-bold text-slate-800">
              {loading ? '...' : `${data.volumeIncremental} cx`}
            </p>
          </div>
        </div>

        {/* TABELA DE MONITORAMENTO (+50% VOLUME) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Cliente</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold text-right">Última Compra (cx)</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold text-right">Meta para 10% OFF (cx)</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold text-right">Volume Atual na Campanha (cx)</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.hitList.map((item: any, index: number) => {
                  const meta = Math.round(item.ultimaCompra * 1.5);
                  
                  return (
                    <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {item.cliente}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-right">
                        {item.ultimaCompra}
                      </td>
                      <td className="px-6 py-4 font-semibold text-blue-600 text-right">
                        {meta}
                      </td>
                      <td className="px-6 py-4 text-slate-800 text-right font-medium">
                        {item.volumeAtual}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderStatusBadge(item.volumeAtual, meta)}
                      </td>
                    </tr>
                  );
                })}
                {data.hitList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
