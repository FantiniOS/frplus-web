import React from 'react';
import { DollarSign, ShoppingCart, Award, TrendingUp, TrendingDown, Info } from 'lucide-react';

export interface RelatorioProps {
  periodName: string;
  usuarioNome: string;
  stats: { totalSales: number; totalOrders: number; newClients: number; totalProducts: number };
  faturamentoData: { total: number; count: number };
  ytdData: { currentYtd: number; previousYtd: number };
  faturamentoAnoAnterior: number;
  topProducts: { name: string; qtd: number; total: number }[];
}

export const RelatorioExecutivoPDF: React.FC<RelatorioProps> = ({
  periodName,
  usuarioNome,
  stats,
  faturamentoData,
  ytdData,
  faturamentoAnoAnterior,
  topProducts
}) => {
  // Lógica Heurística
  const crescFaturamento = faturamentoAnoAnterior > 0 
    ? ((faturamentoData.total - faturamentoAnoAnterior) / faturamentoAnoAnterior) * 100 
    : 0;
  
  const crescYTD = ytdData.previousYtd > 0 
    ? ((ytdData.currentYtd - ytdData.previousYtd) / ytdData.previousYtd) * 100 
    : 0;

  const getInsightText = () => {
    let insights = [];
    if (crescFaturamento > 15) {
      insights.push(`Crescimento expressivo no faturamento do período (+${crescFaturamento.toFixed(1)}%), demonstrando alta tração comercial e uma superação clara das expectativas históricas.`);
    } else if (crescFaturamento < -10) {
      insights.push(`Atenção: Houve uma retração no faturamento do período (${crescFaturamento.toFixed(1)}%) em comparação ao mesmo período do ano passado, requerendo uma revisão da estratégia de vendas.`);
    } else {
      insights.push(`Desempenho estável em relação ao período anterior, com uma variação de ${crescFaturamento.toFixed(1)}%.`);
    }

    if (topProducts.length > 0) {
      const share = faturamentoData.total > 0 ? (topProducts[0].total / faturamentoData.total) * 100 : 0;
      if (share > 25) {
         insights.push(`Observa-se alta concentração de receita: O produto "${topProducts[0].name}" representa ${share.toFixed(1)}% do faturamento total do período. Considerar estratégias para impulsionar outras linhas e diluir o risco.`);
      } else {
         insights.push(`O portfólio mantém-se diversificado, impulsionado pelo produto "${topProducts[0].name}", que liderou as vendas sem concentrar o faturamento global de forma arriscada.`);
      }
    }
    
    if (crescYTD > 0) {
      insights.push(`Avanço sólido: No acumulado do ano (YTD), seguimos superando a performance consolidada do ano passado em +${crescYTD.toFixed(1)}%.`);
    } else if (crescYTD < 0) {
      insights.push(`Acumulado do ano (YTD) indica retração de ${crescYTD.toFixed(1)}% frente ao mesmo intervalo no ano anterior.`);
    }
    
    return insights.join(" ");
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div id="pdf-report-container" className="bg-[#0a0f1a] text-white p-8 w-[210mm] min-h-[297mm] mx-auto border border-white/[0.08]" style={{ fontFamily: 'sans-serif' }}>
       {/* Capa e Cabeçalho */}
       <div className="border-b border-white/[0.08] pb-6 mb-6">
          <div className="flex justify-between items-end">
             <div>
               <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Relatório Executivo de Desempenho</h1>
               <h2 className="text-lg text-blue-400 font-medium">Período Selecionado: <span className="capitalize text-white">{periodName}</span></h2>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                <p className="text-xs text-gray-400">Usuário: <span className="text-white/80">{usuarioNome}</span></p>
             </div>
          </div>
       </div>

       {/* Sumário Executivo com Heurística */}
       <div className="bg-[#0f1729] rounded-xl p-6 border border-white/[0.08] mb-8 shadow-lg shadow-black/20">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/15">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
            Inteligência Heurística (Insights)
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed font-medium">
             {getInsightText()}
          </p>
       </div>

       {/* KPIs Principais */}
       <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/[0.02] p-6 rounded-xl border border-white/[0.08]">
             <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Vendas Totais</span>
                <ShoppingCart className="w-5 h-5 text-blue-400 opacity-80" />
             </div>
             <div className="text-3xl font-bold text-white mb-2">{formatCurrency(stats.totalSales)}</div>
             <div className="text-xs text-gray-500">{stats.totalOrders} pedidos emitidos neste ciclo</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/[0.02] p-6 rounded-xl border border-white/[0.08]">
             <div className="flex justify-between items-start mb-4">
               <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Faturamento Consolidado</span>
               <DollarSign className="w-5 h-5 text-emerald-400 opacity-80" />
             </div>
             <div className="text-3xl font-bold text-white mb-2">{formatCurrency(faturamentoData.total)}</div>
             <div className="text-xs text-gray-500">{faturamentoData.count} pedidos faturados neste ciclo</div>
          </div>
       </div>

       {/* Comparativos YOY e YTD */}
       <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0f1729] p-6 rounded-xl border border-white/[0.08]">
             <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Desempenho vs. Ano Anterior</span>
             <div className="flex items-center gap-4 mb-2">
                <div className="text-2xl font-bold text-white">{formatCurrency(faturamentoData.total)}</div>
                {crescFaturamento !== 0 && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${crescFaturamento > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {crescFaturamento > 0 ? '+' : ''}{crescFaturamento.toFixed(1)}%
                  </span>
                )}
             </div>
             <div className="text-xs text-gray-500">Histórico base: {formatCurrency(faturamentoAnoAnterior)}</div>
          </div>
          <div className="bg-[#0f1729] p-6 rounded-xl border border-white/[0.08]">
             <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Evolução Anual (YTD)</span>
             <div className="flex items-center gap-4 mb-2">
                <div className="text-2xl font-bold text-white">{formatCurrency(ytdData.currentYtd)}</div>
                {crescYTD !== 0 && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${crescYTD > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {crescYTD > 0 ? '+' : ''}{crescYTD.toFixed(1)}%
                  </span>
                )}
             </div>
             <div className="text-xs text-gray-500">Histórico base: {formatCurrency(ytdData.previousYtd)}</div>
          </div>
       </div>

       {/* Top Produtos */}
       <div className="bg-[#0f1729] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Award className="w-4 h-4 text-violet-400" />
            </div>
            Produtos em Destaque Comercial
          </h3>
          <div className="space-y-4">
             {topProducts.map((prod, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                   <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-violet-400/80 w-6">#{i + 1}</span>
                      <span className="text-sm font-medium text-white/90">{prod.name}</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-white">{formatCurrency(prod.total)}</span>
                      <span className="text-xs text-gray-500 mt-1">{prod.qtd} unidades vendidas</span>
                   </div>
                </div>
             ))}
             {topProducts.length === 0 && (
               <p className="text-sm text-gray-500 text-center py-6">Nenhuma movimentação de produto registrada neste período.</p>
             )}
          </div>
       </div>
       
       {/* Rodapé */}
       <div className="mt-12 pt-6 border-t border-white/[0.08] text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Uso Restrito e Confidencial</p>
          <p className="text-[10px] text-gray-600 mt-2">Documento gerado automaticamente pela plataforma corporativa. Os dados aqui representam a base de inteligência do período selecionado.</p>
       </div>
    </div>
  );
};
