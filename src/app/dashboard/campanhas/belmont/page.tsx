/* eslint-disable */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PrintHeader } from '@/components/ui/PrintHeader';
import { motion } from 'framer-motion';
import {
  Search,
  Target,
  Users,
  AlertTriangle,
  TrendingUp,
  Wine,
  ExternalLink,
  Filter,
  Loader2,
  Phone,
  MapPin,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

interface ClienteCampanha {
  clienteId: string;
  nomeFantasia: string;
  razaoSocial: string;
  cidade: string;
  estado: string;
  tabelaPreco: string | null;
  telefone: string;
  celular: string;
  totalCaixas60d: number;
  mediaAtual: number;
  mediaBase: number;
  metaCampanha: number;
  quantidadeFaturar: number;
  bonificacaoVinagre: number;
  isZerado: boolean;
}

interface CampanhaData {
  campanha: {
    id: string;
    status: string;
    dataInicio: string;
  };
  produtosEncontrados: string[];
  periodoInicio: string;
  periodoFim: string;
  totalClientes: number;
  totalZerados: number;
  volumeProjetado: number;
  totalBonificacoes: number;
  clientes: ClienteCampanha[];
}

type SortField = 'quantidadeFaturar' | 'mediaAtual' | 'nome' | 'bonificacaoVinagre';
type SortDir = 'asc' | 'desc';

// ═══════════════════════════════════════════════════════
// UTILIDADES: WhatsApp Message Builder
// ═══════════════════════════════════════════════════════
function buildWhatsAppMessage(cliente: ClienteCampanha): string {
  const nome = cliente.nomeFantasia || cliente.razaoSocial || 'Parceiro';
  const qtdFaturar = cliente.quantidadeFaturar % 1 === 0
    ? cliente.quantidadeFaturar
    : cliente.quantidadeFaturar.toFixed(1);
  const bonif = cliente.bonificacaoVinagre;

  return (
    `Olá, ${nome}! Tudo bem?\n` +
    `Consegui uma condição especial na fábrica para turbinar sua margem nos Compostos Belmont Tinto e Branco.\n\n` +
    `🎯 *Sua Proposta Personalizada:*\n` +
    `📦 Faturando: *${qtdFaturar} caixas*\n` +
    `🎁 Você ganha: *${bonif} caixa${bonif !== 1 ? 's' : ''} de Vinagre de Álcool ou Colorido* de bonificação!\n\n` +
    `💡 Isso representa uma *redução de ~7,4% no seu custo médio*, aumentando muito a sua margem de revenda nessa carga!\n\n` +
    `Podemos fechar esse pedido hoje para garantir a bonificação antes que encerre o lote?`
  );
}

function formatPhoneForWhatsApp(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');
  // If starts with 0, remove it. If doesn't start with 55, add country code.
  if (digits.startsWith('55')) return digits;
  if (digits.startsWith('0')) return '55' + digits.slice(1);
  return '55' + digits;
}

// ═══════════════════════════════════════════════════════
// UTILIDADE: Logo loader for jsPDF
// ═══════════════════════════════════════════════════════
async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    let finalUrl = url;
    if (url.startsWith('/')) {
      finalUrl = window.location.origin + url;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = finalUrl;
  });
}

// ═══════════════════════════════════════════════════════
// UTILIDADE: PDF Proposal Generator
// ═══════════════════════════════════════════════════════
async function generatePropostaPDF(cliente: ClienteCampanha, periodoStr: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 12, right: 12 };
  let y = 0;

  const nome = cliente.nomeFantasia || cliente.razaoSocial || 'Cliente';
  const qtdFaturar = cliente.quantidadeFaturar % 1 === 0
    ? String(cliente.quantidadeFaturar)
    : cliente.quantidadeFaturar.toFixed(1);
  const bonif = String(cliente.bonificacaoVinagre);
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── PALETA PADRÃO FRPlus ──
  const colors = {
    headerDark: [10, 10, 14] as [number, number, number],
    accentBlue: [37, 99, 235] as [number, number, number],
    accentCyan: [6, 182, 212] as [number, number, number],
    textDark: [20, 20, 30] as [number, number, number],
    textMuted: [120, 120, 140] as [number, number, number],
    textLight: [200, 200, 220] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    tableBorder: [226, 232, 240] as [number, number, number],
    greenAccent: [16, 185, 129] as [number, number, number],
    purpleAccent: [126, 34, 206] as [number, number, number],
  };

  // ── LOGO ──
  const logoResult = await getBase64Image('/logo.png');

  // ── HEADER PADRÃO FRPlus ──
  const drawHeader = () => {
    const headerHeight = 34;

    // Fundo escuro
    doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Barra de acento blue→cyan
    doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
    doc.rect(0, headerHeight, pageWidth, 1.5, 'F');
    doc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
    doc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

    // Logo no canto esquerdo
    if (logoResult) {
      try {
        const logoH = 17;
        const logoRatio = logoH / logoResult.height;
        const logoW = logoResult.width * logoRatio;
        doc.addImage(logoResult.data, 'PNG', margin.left, 5, logoW, logoH);
      } catch { /* silently fail */ }
    }

    // Título alinhado à direita
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPOSTA COMERCIAL — CAMPANHA COMPOSTOS BELMONT', pageWidth - margin.right, 13, { align: 'right' });

    // Subtítulo
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
    doc.text(`Composto Tinto 750ml  ·  Composto Branco 750ml`, pageWidth - margin.right, 19, { align: 'right' });

    // Data
    doc.setFontSize(7);
    doc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 24, { align: 'right' });

    // Dados do cliente no header
    doc.setFontSize(7);
    doc.text(`Cliente: ${nome}`, pageWidth - margin.right, 30, { align: 'right' });

    return headerHeight + 4;
  };

  // ── FOOTER PADRÃO FRPlus ──
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 7;

    doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    doc.text('FRPlus - Gestao Comercial Inteligente', margin.left, footerY);
    doc.text('Campanha valida por tempo limitado ou enquanto durarem os estoques promocionais.', pageWidth / 2, footerY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
  };

  // ═══════════════════════════════════════════
  // PÁGINA 1
  // ═══════════════════════════════════════════

  y = drawHeader();
  y += 6;

  // ── DADOS DO CLIENTE ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text('DESTINATÁRIO', margin.left, y);
  y += 7;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  const splitNome = doc.splitTextToSize(nome, pageWidth - margin.left - margin.right);
  doc.text(splitNome, margin.left, y);
  y += splitNome.length * 8 + 2;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  if (cliente.cidade) {
    doc.text(`${cliente.cidade}/${cliente.estado}`, margin.left, y);
    y += 5;
  }
  if (cliente.telefone || cliente.celular) {
    doc.text(`Tel: ${cliente.celular || cliente.telefone}`, margin.left, y);
    y += 5;
  }

  y += 10;

  // ── BOX PRINCIPAL — PROPOSTA EXCLUSIVA (estilo emerald-900 como a verba) ──
  const boxW = pageWidth - margin.left - margin.right;
  const boxH = 58;

  // Fundo escuro emerald
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.roundedRect(margin.left, y, boxW, boxH, 2, 2, 'F');

  // Barra accent esquerda
  doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.rect(margin.left, y, 3, boxH, 'F');

  const centerX = margin.left + boxW / 2;

  // Título do box
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.text('SUA PROPOSTA EXCLUSIVA — CAMPANHA COMPOSTOS BELMONT', centerX, y + 10, { align: 'center' });

  // Número grande: COMPRE X CAIXAS
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`COMPRE ${qtdFaturar} CAIXAS`, centerX, y + 25, { align: 'center' });

  // E GANHE Y VINAGRE
  doc.setFontSize(15);
  doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.text(`E GANHE ${bonif} CAIXA${parseInt(bonif) !== 1 ? 'S' : ''} DE VINAGRE`, centerX, y + 35, { align: 'center' });

  // Sub-text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.text('Vinagre de Álcool ou Colorido — Bonificação sobre volume faturado', centerX, y + 44, { align: 'center' });

  // Economia badge
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const badgeText = 'ECONOMIA DE ~7,4% NO CUSTO MÉDIO DA CARGA';
  const badgeW = doc.getTextWidth(badgeText) + 10;
  doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.roundedRect(centerX - badgeW / 2, y + 47, badgeW, 7, 2, 2, 'F');
  doc.text(badgeText, centerX, y + 52, { align: 'center' });

  y += boxH + 10;

  // ── RESUMO FINANCEIRO (estilo bloco escuro como o resumo de fechamento) ──
  const summaryH = 42;

  doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
  doc.roundedRect(margin.left, y, boxW, summaryH, 2, 2, 'F');

  // Barra de título azul
  doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
  doc.rect(margin.left, y, boxW, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DETALHAMENTO DA CAMPANHA', margin.left + boxW / 2, y + 7, { align: 'center' });

  // 4 métricas em colunas
  const metricY = y + 16;
  const colW = boxW / 4;

  const drawMetric = (x: number, label: string, value: string, valueColor: [number, number, number], subtitle?: string) => {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
    doc.text(label, x, metricY);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
    doc.text(value, x, metricY + 9);

    if (subtitle) {
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      doc.text(subtitle, x, metricY + 14);
    }
  };

  const col1 = margin.left + 8;
  const col2 = margin.left + colW + 8;
  const col3 = margin.left + colW * 2 + 8;
  const col4 = margin.left + colW * 3 + 8;

  const mediaAtualStr = cliente.mediaAtual % 1 === 0 ? String(cliente.mediaAtual) : cliente.mediaAtual.toFixed(1);
  const mediaBaseStr = cliente.mediaBase % 1 === 0 ? String(cliente.mediaBase) : cliente.mediaBase.toFixed(1);

  drawMetric(col1, 'MÉDIA REAL MENSAL', `${mediaAtualStr} cx`, colors.white, 'Consumo últimos 60 dias ÷ 2');
  drawMetric(col2, 'BASE CAMPANHA', `${mediaBaseStr} cx`, cliente.isZerado ? [249, 115, 22] : colors.accentCyan, cliente.isZerado ? 'Piso mínimo aplicado (50cx)' : 'Igual à média real');
  drawMetric(col3, 'ALVO A FATURAR', `${qtdFaturar} cx`, colors.greenAccent, 'Base + meta adicional 25%');
  drawMetric(col4, 'BONIFICAÇÃO VINAGRE', `${bonif} cx`, [168, 85, 247], '1 cx a cada 12,5 faturadas');

  y += summaryH + 10;

  // ── COMO FUNCIONA ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text('COMO FUNCIONA A BONIFICAÇÃO', margin.left, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);

  const explanations = [
    `• A cada 12,5 caixas de Composto Tinto ou Branco faturadas, o cliente ganha 1 caixa de Vinagre.`,
    `• Nesta proposta de ${qtdFaturar} caixas, a bonificação é de ${bonif} caixa${parseInt(bonif) !== 1 ? 's' : ''} de Vinagre de Álcool ou Colorido.`,
    `• O Vinagre bonificado reduz o custo médio da carga em aproximadamente 7,4%.`,
    `• Maior margem de revenda = mais lucro na operação atacadista.`,
  ];

  explanations.forEach(line => {
    const split = doc.splitTextToSize(line, pageWidth - margin.left - margin.right);
    doc.text(split, margin.left, y);
    y += split.length * 5 + 2;
  });

  y += 6;

  // ── DIVIDER ──
  doc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
  doc.setLineWidth(0.3);
  doc.line(margin.left, y, pageWidth - margin.right, y);
  y += 6;

  // ── DISCLAIMER ──
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  const disclaimer = `Campanha válida por tempo limitado ou enquanto durarem os estoques promocionais. Condições sujeitas a alteração sem aviso prévio. Média de compras calculada de forma fixa e congelada no período de ${periodoStr}. Bonificação aplicada exclusivamente sobre o volume faturado dos produtos Composto Tinto e Composto Branco 750ml da linha Belmont.`;
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - margin.left - margin.right);
  doc.text(splitDisclaimer, margin.left, y);

  // ── FOOTERS ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  // Save
  const cleanName = nome.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
  doc.save(`Proposta_Belmont_${cleanName}.pdf`);
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function CampanhaBelmontPage() {
  const [data, setData] = useState<CampanhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showZeradosOnly, setShowZeradosOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('quantidadeFaturar');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const handleToggleStatus = async () => {
    if (!data) return;
    try {
      setIsTogglingStatus(true);
      const newStatus = data.campanha.status === 'ATIVA' ? 'ENCERRADA' : 'ATIVA';
      const res = await fetch('/api/campanhas/belmont', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Falha ao atualizar status');
      
      setData({
        ...data,
        campanha: { ...data.campanha, status: newStatus }
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/campanhas/belmont');
        if (!res.ok) throw new Error('Erro ao carregar dados da campanha');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-600 ml-1 inline" />;
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-blue-400 ml-1 inline" />
      : <ChevronUp className="h-3 w-3 text-blue-400 ml-1 inline" />;
  };

  // ── WhatsApp handler ──
  const handleWhatsApp = useCallback((cliente: ClienteCampanha) => {
    const message = buildWhatsAppMessage(cliente);
    const phone = cliente.celular || cliente.telefone;
    if (phone) {
      const formattedPhone = formatPhoneForWhatsApp(phone);
      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      // No phone — copy to clipboard
      navigator.clipboard.writeText(message).then(() => {
        setCopiedId(cliente.clienteId);
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  }, []);

  // ── Copy message handler ──
  const handleCopyMessage = useCallback((cliente: ClienteCampanha) => {
    const message = buildWhatsAppMessage(cliente);
    navigator.clipboard.writeText(message).then(() => {
      setCopiedId(cliente.clienteId);
      setTimeout(() => setCopiedId(null), 2500);
    });
  }, []);

  // ── PDF handler ──
  const handleGeneratePDF = useCallback(async (cliente: ClienteCampanha) => {
    if (!data) return;
    try {
      setGeneratingPdfId(cliente.clienteId);
      const pInicio = new Date(data.periodoInicio).toLocaleDateString('pt-BR');
      const pFim = new Date(data.periodoFim).toLocaleDateString('pt-BR');
      await generatePropostaPDF(cliente, `${pInicio} a ${pFim}`);
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setGeneratingPdfId(null);
    }
  }, [data]);

  const filteredClients = useMemo(() => {
    if (!data) return [];
    let list = data.clientes;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        c =>
          (c.nomeFantasia || '').toLowerCase().includes(term) ||
          (c.razaoSocial || '').toLowerCase().includes(term) ||
          (c.cidade || '').toLowerCase().includes(term)
      );
    }

    if (showZeradosOnly) {
      list = list.filter(c => c.isZerado);
    }

    list = [...list].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;
      switch (sortField) {
        case 'quantidadeFaturar':
          valA = a.quantidadeFaturar;
          valB = b.quantidadeFaturar;
          break;
        case 'mediaAtual':
          valA = a.mediaAtual;
          valB = b.mediaAtual;
          break;
        case 'bonificacaoVinagre':
          valA = a.bonificacaoVinagre;
          valB = b.bonificacaoVinagre;
          break;
        case 'nome':
          valA = (a.nomeFantasia || a.razaoSocial || '').toLowerCase();
          valB = (b.nomeFantasia || b.razaoSocial || '').toLowerCase();
          if (sortDir === 'desc') return valB > valA ? 1 : valB < valA ? -1 : 0;
          return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      if (sortDir === 'desc') return (valB as number) - (valA as number);
      return (valA as number) - (valB as number);
    });

    return list;
  }, [data, searchTerm, showZeradosOnly, sortField, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-400 text-sm">Calculando campanha Belmont...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-red-400 font-medium">Erro ao carregar campanha</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const periodoInicio = new Date(data.periodoInicio).toLocaleDateString('pt-BR');
  const periodoFim = new Date(data.periodoFim).toLocaleDateString('pt-BR');

  return (
    <div className="space-y-6 print:h-auto print:overflow-visible">
      {/* ═══ PRINT HEADER ═══ */}
      <div className="hidden print:block mb-6">
        <PrintHeader titulo="Mapa de Ação: Campanha Composto Belmont (Atacados)" />
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Campanha Composto Belmont
              </h1>
              <p className="text-sm text-gray-400">
                Lista de Ataque — Prospecção Ativa
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data.campanha.status === 'ATIVA' ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              ● Campanha Ativa
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Campanha Encerrada
            </span>
          )}
          <button
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className="px-3 py-1 text-xs font-medium bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {isTogglingStatus ? 'Atualizando...' : data.campanha.status === 'ATIVA' ? 'Encerrar Campanha' : 'Reativar Campanha'}
          </button>
        </div>
      </div>

      {/* ═══ PRODUTOS DETECTADOS ═══ */}
      {data.produtosEncontrados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.produtosEncontrados.map((nome, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium bg-white/5 text-gray-300 border border-white/10"
            >
              <Wine className="h-3 w-3 text-purple-400" />
              {nome}
            </span>
          ))}
        </div>
      )}

      {/* ═══ CARDS DE RESUMO ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Clientes</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.totalClientes}</p>
          <p className="text-xs text-gray-500 mt-1">na base ativa</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">Zerados</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{data.totalZerados}</p>
          <p className="text-xs text-gray-500 mt-1">abaixo do piso 50cx</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400/70 uppercase tracking-wider font-medium">Vol. Projetado</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {data.volumeProjetado.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-500 mt-1">caixas a faturar</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wine className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-purple-400/70 uppercase tracking-wider font-medium">Bonificações</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {data.totalBonificacoes.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-500 mt-1">cx vinagre total</p>
        </motion.div>
      </div>

      {/* ═══ FILTROS ═══ */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nome ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <button
          onClick={() => setShowZeradosOnly(!showZeradosOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            showZeradosOnly
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
          }`}
        >
          <Filter className="h-4 w-4" />
          Apenas Zerados
        </button>

        <span className="text-xs text-gray-500 whitespace-nowrap">
          {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* AVISO DE PERÍODO CONGELADO */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3 print:hidden">
        <Target className="h-5 w-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-400">Metas Congeladas ({periodoInicio} a {periodoFim})</p>
          <p className="text-xs text-gray-400 mt-1">
            Média de compras calculada de forma fixa e congelada a partir da primeira abertura da campanha. As metas não sofrerão flutuações diárias.
          </p>
        </div>
      </div>

      {/* ═══ TABELA DE ATAQUE ═══ */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden overflow-x-auto backdrop-blur-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10">
            <tr>
              <th className="px-3 py-4 font-medium w-8 text-center">#</th>
              <th
                className="px-3 py-4 font-medium cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('nome')}
              >
                Cliente <SortIcon field="nome" />
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none hidden md:table-cell"
                onClick={() => handleSort('mediaAtual')}
              >
                Média Atual <SortIcon field="mediaAtual" />
              </th>
              <th className="px-3 py-4 font-medium text-right hidden md:table-cell">
                Média Base
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('quantidadeFaturar')}
              >
                <span className="text-emerald-400">Alvo a Faturar</span>{' '}
                <SortIcon field="quantidadeFaturar" />
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('bonificacaoVinagre')}
              >
                <span className="text-purple-400">Bonif. Vinagre</span>{' '}
                <SortIcon field="bonificacaoVinagre" />
              </th>
              <th className="px-3 py-4 font-medium text-center print:hidden">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredClients.map((cliente, idx) => (
              <motion.tr
                key={cliente.clienteId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                className={`group transition-colors print:break-inside-avoid ${
                  cliente.isZerado
                    ? 'hover:bg-amber-500/5 bg-amber-500/[0.02]'
                    : 'hover:bg-white/5'
                }`}
              >
                {/* # */}
                <td className="px-3 py-3 text-center text-xs text-gray-600 font-mono">
                  {idx + 1}
                </td>

                {/* Cliente */}
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/clientes/${cliente.clienteId}/raio-x`}
                        className="font-medium text-white hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 group/link"
                      >
                        <span className="truncate">{cliente.nomeFantasia || cliente.razaoSocial}</span>
                        <ExternalLink className="h-3 w-3 text-gray-600 group-hover/link:text-blue-400 flex-shrink-0 transition-colors" />
                      </Link>
                      <div className="flex items-center gap-3 mt-0.5">
                        {cliente.cidade && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {cliente.cidade}/{cliente.estado}
                          </span>
                        )}
                        {(cliente.telefone || cliente.celular) && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            {cliente.celular || cliente.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                    {cliente.isZerado && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap flex-shrink-0">
                        PISO
                      </span>
                    )}
                  </div>
                </td>

                {/* Média Atual (Real) */}
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  <span className={`font-mono text-sm ${cliente.mediaAtual === 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                    {cliente.mediaAtual % 1 === 0 ? cliente.mediaAtual : cliente.mediaAtual.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">cx</span>
                </td>

                {/* Média Base Aplicada */}
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  <span className={`font-mono text-sm ${
                    cliente.isZerado ? 'text-amber-400/80' : 'text-gray-300'
                  }`}>
                    {cliente.mediaBase % 1 === 0 ? cliente.mediaBase : cliente.mediaBase.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">cx</span>
                </td>

                {/* ALVO A FATURAR — Destaque */}
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 shadow-[0_0_10px_rgba(16,185,129,0.08)]">
                    <span className="font-bold text-emerald-400 text-base font-mono">
                      {cliente.quantidadeFaturar % 1 === 0 ? cliente.quantidadeFaturar : cliente.quantidadeFaturar.toFixed(1)}
                    </span>
                    <span className="text-xs text-emerald-400/60">cx</span>
                  </div>
                </td>

                {/* BONIFICAÇÃO VINAGRE — Destaque */}
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-1.5 shadow-[0_0_10px_rgba(168,85,247,0.08)]">
                    <Wine className="h-3.5 w-3.5 text-purple-400" />
                    <span className="font-bold text-purple-400 text-base font-mono">
                      {cliente.bonificacaoVinagre}
                    </span>
                    <span className="text-xs text-purple-400/60">cx</span>
                  </div>
                </td>

                {/* ═══ AÇÕES: WhatsApp + PDF + Copiar ═══ */}
                <td className="px-3 py-3 print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    {/* WhatsApp */}
                    <button
                      onClick={() => handleWhatsApp(cliente)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-green-500/70 hover:text-green-400 hover:bg-green-500/10 transition-all hover:shadow-[0_0_8px_rgba(34,197,94,0.15)]"
                      title={`Enviar proposta via WhatsApp para ${cliente.nomeFantasia || cliente.razaoSocial}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>

                    {/* Copy message */}
                    <button
                      onClick={() => handleCopyMessage(cliente)}
                      className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-all ${
                        copiedId === cliente.clienteId
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-gray-500 hover:text-white hover:bg-white/10'
                      }`}
                      title="Copiar mensagem para área de transferência"
                    >
                      {copiedId === cliente.clienteId ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>

                    {/* PDF */}
                    <button
                      onClick={() => handleGeneratePDF(cliente)}
                      disabled={generatingPdfId === cliente.clienteId}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all hover:shadow-[0_0_8px_rgba(239,68,68,0.12)] disabled:opacity-50"
                      title="Gerar Proposta Comercial em PDF"
                    >
                      {generatingPdfId === cliente.clienteId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}

            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-gray-500 space-y-2">
                    <Search className="h-8 w-8 mx-auto text-gray-600" />
                    <p className="text-sm">Nenhum cliente encontrado.</p>
                    {showZeradosOnly && (
                      <button
                        onClick={() => setShowZeradosOnly(false)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Limpar filtro de zerados
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ LEGENDA ═══ */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400/60"></span>
          <span>PISO = Média real &lt; 50cx → nivelado em 50</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/60"></span>
          <span>Alvo = Média Base + 25% (arredondado para cima)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-400/60"></span>
          <span>Bonificação = 1 cx vinagre a cada 12.5 cx faturadas</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4 print:hidden">
          <MessageCircle className="h-3 w-3 text-green-500" />
          <span>WhatsApp</span>
          <Copy className="h-3 w-3 text-gray-400 ml-2" />
          <span>Copiar</span>
          <FileText className="h-3 w-3 text-red-400 ml-2" />
          <span>PDF</span>
        </div>
      </div>

      {/* ═══ TOAST DE CÓPIA ═══ */}
      {copiedId && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl shadow-emerald-500/30 text-sm font-medium"
        >
          <Check className="h-4 w-4" />
          Mensagem copiada!
        </motion.div>
      )}
    </div>
  );
}
