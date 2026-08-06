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
  FileText,
  Check,
  CheckCircle2,
  X,
  Gift,
  Settings,
  Presentation
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
  comprador: string | null;
  totalCaixas60d: number;
  mediaAtual: number;
  mediaBase: number;
  metaCampanha: number;
  quantidadeFaturar: number;
  bonificacaoVinagre: number;
  isZerado: boolean;
  realizado: number;
  faltam: number;
  progresso: number;
  bonificacaoConquistada: number;
  bonificacaoEmitida: number;
  saldoPendente: number;
}

interface CampanhaData {
  campanha: {
    id: string;
    status: string;
    dataInicio: string;
    dataEncerramento?: string;
  };
  produtosEncontrados: string[];
  produtosDetalhes: { id: string; nome: string; imagemUrl: string }[];
  periodoInicio: string;
  periodoFim: string;
  totalClientes: number;
  totalZerados: number;
  volumeProjetado: number;
  totalBonificacoes: number;
  clientes: ClienteCampanha[];
}

type SortField = 'quantidadeFaturar' | 'mediaAtual' | 'nome' | 'bonificacaoVinagre' | 'realizado' | 'progresso' | 'saldoPendente';
type SortDir = 'asc' | 'desc';

// ═══════════════════════════════════════════════════════
// UTILIDADES: Title Case & Date Formatting
// ═══════════════════════════════════════════════════════
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    if (word.length === 0) return '';
    if (['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no'].includes(word)) return word;
    if (['s/a', 's.a', 'ltda', 'me', 'epp'].includes(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
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

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // text-slate-500
  const splitNome = doc.splitTextToSize(nome, pageWidth - margin.left - margin.right);
  doc.text(splitNome, margin.left, y);
  y += splitNome.length * 5 + 2;

  if (cliente.comprador) {
    doc.setFontSize(14); // text-xl
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // text-slate-800
    doc.text(`A/C: ${toTitleCase(cliente.comprador)}`, margin.left, y);
    y += 7;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // text-slate-500
  if (cliente.cidade) {
    doc.text(`${cliente.cidade}/${cliente.estado}`, margin.left, y);
    y += 5;
  }
  y += 10;

  // ── BOX PRINCIPAL — PROPOSTA EXCLUSIVA (estilo emerald-900 como a verba) ──
  const boxW = pageWidth - margin.left - margin.right;
  const boxH = 45;

  // Fundo escuro emerald
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.roundedRect(margin.left, y, boxW, boxH, 2, 2, 'F');

  // Barra accent esquerda
  doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.rect(margin.left, y, 3, boxH, 'F');

  // Divider central (linha sutil)
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.3);
  doc.line(margin.left + boxW / 2, y + 8, margin.left + boxW / 2, y + boxH - 8);

  const col1X = margin.left + (boxW / 4);
  const col2X = margin.left + (boxW * 0.75);

  // COLUNA 1: VOCÊ COMPRA
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.text('VOCÊ COMPRA', col1X, y + 12, { align: 'center' });

  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text(`${qtdFaturar} CX`, col1X, y + 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.text('Composto Belmont 750ml', col1X, y + 34, { align: 'center' });

  // COLUNA 2: VOCÊ GANHA
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.text('VOCÊ GANHA', col2X, y + 12, { align: 'center' });

  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text(`${bonif} CX`, col2X, y + 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.text('Vinagre de Álcool ou Colorido', col2X, y + 34, { align: 'center' });

  // Economia badge centralizado
  const badgeText = 'ECONOMIA DE ~7,4% NO CUSTO MÉDIO DA CARGA';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const badgeW = doc.getTextWidth(badgeText) + 12;
  const badgeH = 7;
  const badgeY = y + boxH - (badgeH / 2); // Metade para fora do box
  const centerX = margin.left + boxW / 2;
  
  doc.setFillColor(colors.greenAccent[0], colors.greenAccent[1], colors.greenAccent[2]);
  doc.roundedRect(centerX - badgeW / 2, badgeY, badgeW, badgeH, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, centerX, badgeY + 5, { align: 'center' });

  y += boxH + 12;

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
// UTILIDADE: PDF Campaign Report Generator (Premium)
// ═══════════════════════════════════════════════════════
async function generateRelatorioCampanhaPDF(data: CampanhaData, periodoStr: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 14, right: 14 };
  const contentW = pageWidth - margin.left - margin.right;
  let y = 0;

  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── PALETA PREMIUM ──
  const C = {
    dark: [10, 10, 14] as [number, number, number],
    darkCard: [24, 24, 32] as [number, number, number],
    blue: [37, 99, 235] as [number, number, number],
    cyan: [6, 182, 212] as [number, number, number],
    green: [16, 185, 129] as [number, number, number],
    emeraldDark: [6, 78, 59] as [number, number, number],
    purple: [139, 92, 246] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    textDark: [15, 23, 42] as [number, number, number],
    textBody: [51, 65, 85] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    textLight: [200, 205, 220] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    bgLight: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    rowAlt: [241, 245, 249] as [number, number, number],
  };

  const logoResult = await getBase64Image('/logo.png');

  // ── TOTAIS ──
  const totalAlvo = data.clientes.reduce((a, c) => a + c.quantidadeFaturar, 0);
  const totalRealizado = data.clientes.reduce((a, c) => a + c.realizado, 0);
  const totalBonif = data.clientes.reduce((a, c) => a + c.bonificacaoConquistada, 0);
  const progressoGeral = totalAlvo > 0 ? Math.round((totalRealizado / totalAlvo) * 100) : 0;
  const clientesAtingidos = data.clientes.filter(c => c.progresso >= 100).length;

  // ════════════════════════════════════════
  // HEADER (reusável em cada página)
  // ════════════════════════════════════════
  const drawHeader = () => {
    const hH = 36;
    doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.rect(0, 0, pageWidth, hH, 'F');

    // Accent bar blue→cyan
    doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
    doc.rect(0, hH, pageWidth * 0.45, 1.8, 'F');
    doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
    doc.rect(pageWidth * 0.45, hH, pageWidth * 0.55, 1.8, 'F');

    if (logoResult) {
      try {
        const logoH = 18;
        const logoRatio = logoH / logoResult.height;
        const logoW = logoResult.width * logoRatio;
        doc.addImage(logoResult.data, 'PNG', margin.left, 6, logoW, logoH);
      } catch { /* silently fail */ }
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RELATORIO GERENCIAL DE ANDAMENTO', pageWidth - margin.right, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
    doc.text('Campanha Compostos Belmont', pageWidth - margin.right, 20, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(`Periodo: ${periodoStr}  |  Emitido em ${dateStr}`, pageWidth - margin.right, 27, { align: 'right' });

    // Status badge
    const statusText = data.campanha.status === 'ATIVA' ? 'STATUS: EM ANDAMENTO' : 'STATUS: ENCERRADA';
    const badgeColor = data.campanha.status === 'ATIVA' ? C.green : C.amber;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.text(statusText, pageWidth - margin.right, 33, { align: 'right' });

    return hH + 6;
  };

  // ════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════
  const drawFooter = (pageNum: number, totalPages: number) => {
    const fY = pageHeight - 8;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin.left, fY - 3, pageWidth - margin.right, fY - 3);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text('FRPlus - Gestao Comercial Inteligente', margin.left, fY);
    doc.text('Documento gerado automaticamente. Dados sujeitos a atualizacao.', pageWidth / 2, fY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textBody[0], C.textBody[1], C.textBody[2]);
    doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, fY, { align: 'right' });
  };

  // ════════════════════════════════════════
  // PÁGINA 1
  // ════════════════════════════════════════
  y = drawHeader();

  // ── SECTION: KPI CARDS ──
  const cardH = 28;
  const cardGap = 5;
  const cardCount = 4;
  const cardW = (contentW - cardGap * (cardCount - 1)) / cardCount;

  const kpis = [
    { label: 'CLIENTES ATIVOS', value: String(data.totalClientes), sub: `${data.totalZerados} sem historico`, color: C.blue },
    { label: 'VOLUME PROJETADO', value: `${totalAlvo.toLocaleString('pt-BR')} cx`, sub: 'Meta total da campanha', color: C.cyan },
    { label: 'REALIZADO', value: `${totalRealizado.toLocaleString('pt-BR')} cx`, sub: `${progressoGeral}% do alvo`, color: C.green },
    { label: 'BONIFICACOES', value: `${totalBonif.toLocaleString('pt-BR')} cx`, sub: 'Vinagre a conceder', color: C.purple },
  ];

  kpis.forEach((kpi, i) => {
    const cx = margin.left + i * (cardW + cardGap);

    // Card background
    doc.setFillColor(C.bgLight[0], C.bgLight[1], C.bgLight[2]);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');

    // Left accent bar
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cx, y, 2.5, cardH, 'F');

    // Label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.label, cx + 7, y + 7);

    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.text(kpi.value, cx + 7, y + 17);

    // Subtitle
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.text(kpi.sub, cx + 7, y + 23);
  });

  y += cardH + 6;

  // ── BARRA DE PROGRESSO GERAL ──
  const barOuterH = 14;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(margin.left, y, contentW, barOuterH, 2, 2, 'F');

  // Label esquerda
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
  doc.text('PROGRESSO GERAL DA CAMPANHA', margin.left + 6, y + 5.5);

  // Barra de fundo
  const barX = margin.left + 6;
  const barY = y + 8;
  const barW = contentW - 50;
  const barH = 3.5;
  doc.setFillColor(40, 40, 55);
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');

  // Barra preenchida
  const fillW = Math.min(barW, barW * (progressoGeral / 100));
  if (fillW > 0) {
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(barX, barY, fillW, barH, 1.5, 1.5, 'F');
  }

  // Percentual
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(`${progressoGeral}%`, pageWidth - margin.right - 6, y + 9, { align: 'right' });

  y += barOuterH + 6;

  // ── MINI STAT: Clientes que atingiram a meta ──
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.text(`${clientesAtingidos} de ${data.totalClientes} clientes atingiram ou superaram a meta (${data.totalClientes > 0 ? Math.round(clientesAtingidos / data.totalClientes * 100) : 0}%)`, margin.left, y);
  y += 7;

  // ── SECTION HEADER: DETALHAMENTO POR CLIENTE ──
  doc.setFillColor(C.blue[0], C.blue[1], C.blue[2]);
  doc.rect(margin.left, y, 3, 5, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.text('DETALHAMENTO POR CLIENTE', margin.left + 6, y + 4);
  y += 9;

  // ── TABELA PREMIUM ──
  const tableData = data.clientes.map((c, i) => [
    String(i + 1),
    toTitleCase(c.nomeFantasia || c.razaoSocial || ''),
    c.cidade ? `${c.cidade}/${c.estado}` : '-',
    `${c.quantidadeFaturar}`,
    `${c.realizado}`,
    `${c.progresso}%`,
    `${c.bonificacaoConquistada}`,
    `${c.bonificacaoEmitida}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'CLIENTE', 'LOCALIDADE', 'ALVO (CX)', 'REALIZ. (CX)', 'PROGRESSO', 'BONIF. (CX)', 'EMITIDA (CX)']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 2.5, bottom: 6, left: 2.5, right: 2.5 },
      textColor: C.textBody,
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 6,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: C.textMuted },
      1: { cellWidth: 46, fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 22, fontStyle: 'bold', textColor: C.green },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 20, textColor: C.purple },
      7: { halign: 'right', cellWidth: 18, fontStyle: 'bold', textColor: C.green },
    },
    didDrawCell: (cellData: any) => {
      // Desenhar mini progress bar na coluna "Progresso" (index 5) apenas no body
      if (cellData.section === 'body' && cellData.column.index === 5) {
        const cell = cellData.cell;
        const progValue = parseInt(cellData.cell.raw || '0');
        const pBarW = cell.width - 6;
        const pBarH = 2.5;
        const pBarX = cell.x + 3;
        const pBarY = cell.y + cell.height - 4.5;

        // Background bar
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(pBarX, pBarY, pBarW, pBarH, 1, 1, 'F');

        // Fill bar
        const pFillW = Math.min(pBarW, pBarW * (progValue / 100));
        if (pFillW > 0) {
          const barColor = progValue >= 100 ? C.green : progValue >= 50 ? C.cyan : C.amber;
          doc.setFillColor(barColor[0], barColor[1], barColor[2]);
          doc.roundedRect(pBarX, pBarY, pFillW, pBarH, 1, 1, 'F');
        }
      }
    },
    didDrawPage: (pageData: any) => {
      if (pageData.pageNumber > 1) {
        drawHeader();
      }
    },
    margin: { top: 44, left: margin.left, right: margin.right, bottom: 16 },
  });

  // ── FOOTERS EM TODAS AS PÁGINAS ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save(`Relatorio_Campanha_Belmont.pdf`);
}

// ═══════════════════════════════════════════════════════
// PDF - APRESENTAÇÃO GENÉRICA PARA VENDEDORES
// ═══════════════════════════════════════════════════════
async function generateApresentacaoPDF(data: CampanhaData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 20, right: 20, top: 20, bottom: 20 };
  let y = margin.top;

  const pInicio = new Date(data.periodoInicio).toLocaleDateString('pt-BR');
  const pFim = new Date(data.periodoFim).toLocaleDateString('pt-BR');

  // Background escuro
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Formas decorativas no background
  doc.setFillColor(30, 41, 59); // slate-800
  doc.circle(pageWidth, 0, 100, 'F');
  doc.setFillColor(56, 189, 248); // sky-400 accent
  doc.circle(0, pageHeight, 80, 'F');

  // Logo
  const logoResult = await getBase64Image('/logo.png');
  if (logoResult) {
    const maxLogoH = 20;
    const aspect = logoResult.width / logoResult.height;
    const w = maxLogoH * aspect;
    doc.addImage(logoResult.data, 'PNG', margin.left, y, w, maxLogoH);
    y += maxLogoH + 15;
  } else {
    y += 25;
  }

  // Título
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CAMPANHA DE VENDAS', margin.left, y);
  
  doc.setFontSize(22);
  doc.setTextColor(147, 197, 253); // blue-300
  y += 10;
  doc.text('COMPOSTO BELMONT', margin.left, y);

  // Período
  y += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Periodo de validade: ${pInicio} a ${pFim}`, margin.left, y);

  // Divider
  y += 10;
  doc.setDrawColor(51, 65, 85); // slate-700
  doc.setLineWidth(1);
  doc.line(margin.left, y, pageWidth - margin.right, y);

  // ══════ PRODUTOS PARTICIPANTES (GRID COM IMAGENS) ══════
  y += 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(167, 139, 250); // purple-400
  doc.text('PRODUTOS PARTICIPANTES', margin.left, y);

  y += 5;
  const colWidth = (pageWidth - margin.left - margin.right - 20) / 2; // Duas colunas com gap de 20
  
  if (data.produtosDetalhes && data.produtosDetalhes.length > 0) {
    let currentX = margin.left;
    let maxY = y;

    for (let i = 0; i < data.produtosDetalhes.length; i++) {
      const p = data.produtosDetalhes[i];
      
      // Card Background
      doc.setFillColor(30, 41, 59, 0.5); // slate-800 com "opacidade" aproximada (só uma cor mais escura)
      doc.setFillColor(25, 35, 50); // fake slate-800/50
      doc.roundedRect(currentX, y, colWidth, 40, 3, 3, 'F');
      
      // Tentar carregar imagem
      if (p.imagemUrl) {
        try {
          const imgData = await getBase64Image(p.imagemUrl);
          if (imgData) {
            const maxImgH = 25;
            const aspect = imgData.width / imgData.height;
            const imgW = maxImgH * aspect;
            const imgX = currentX + (colWidth - imgW) / 2; // Centro do card
            doc.addImage(imgData.data, 'PNG', imgX, y + 2, imgW, maxImgH);
          }
        } catch (e) {
          console.error("Erro ao carregar imagem do produto:", p.nome);
        }
      }
      
      // Nome do produto
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240); // slate-200
      
      const nomeSplit = doc.splitTextToSize(p.nome, colWidth - 4);
      doc.text(nomeSplit, currentX + (colWidth / 2), y + 33, { align: 'center' });
      
      currentX += colWidth + 20;
      maxY = y + 40;
    }
    
    y = maxY;
  } else {
    // Fallback se não tiver os detalhes
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(248, 250, 252); // slate-50
    doc.text('- Vinagre Composto Branco 750ml', margin.left + 5, y + 8);
    doc.text('- Vinagre Composto Tinto 750ml', margin.left + 5, y + 15);
    y += 20;
  }

  // ══════ REGRA DE OURO E MECÂNICA ══════
  // Ajuste do espaçamento para evitar encavalamento
  y += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('A MECANICA (REGRA DE OURO)', margin.left, y);

  y += 12;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text('A cada', margin.left, y);
  
  const text1Width = doc.getTextWidth('A cada ');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // sky-400
  // Alinhamento vertical manual (items-baseline)
  doc.text('63', margin.left + text1Width, y + 2);

  const text2Width = doc.getTextWidth('63');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(' caixas faturadas, o cliente ganha', margin.left + text1Width + text2Width + 2, y);

  y += 18;
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text('5', margin.left, y + 2);
  
  const text3Width = doc.getTextWidth('5');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(167, 139, 250); // purple-400
  doc.text(' CAIXAS DE BONIFICACAO', margin.left + text3Width + 2, y - 4);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('(Alcool / Vinagre)', margin.left + text3Width + 3, y + 2);

  // ══════ TERMOS E CONDIÇÕES ══════
  // Forçando o y relativo (mt-auto) com espaçamento de segurança
  y += 20;
  // Se o y bater muito perto do final da página, empurramos pra próxima ou mantemos no máximo o rodapé
  if (y < pageHeight - margin.bottom - 10) {
     y = pageHeight - margin.bottom - 10;
  }
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('* Bonificacao sujeita a aprovacao e faturamento minimo.', margin.left, y);
  doc.text('** Material de uso interno e exclusivo para equipe de vendas.', margin.left, y + 4);

  doc.save(`Apresentacao_Campanha_Belmont.pdf`);
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
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Config State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDataInicio, setConfigDataInicio] = useState('');
  const [configDataEncerramento, setConfigDataEncerramento] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Conciliacao State
  const [conciliacaoClient, setConciliacaoClient] = useState<ClienteCampanha | null>(null);
  const [activeTab, setActiveTab] = useState<'vendas' | 'bonificacoes'>('vendas');
  const [vendasOrders, setVendasOrders] = useState<any[]>([]);
  const [bonusOrders, setBonusOrders] = useState<any[]>([]);
  const [selectedVendas, setSelectedVendas] = useState<Set<string>>(new Set());
  const [selectedBonus, setSelectedBonus] = useState<Set<string>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingLançamento, setSavingLançamento] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (conciliacaoClient) {
      const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
          const res = await fetch(`/api/campanhas/belmont/conciliacao?clienteId=${conciliacaoClient.clienteId}`);
          if (res.ok) {
            const json = await res.json();
            setVendasOrders(json.vendas);
            setBonusOrders(json.bonificacoes);
            
            // Inicia o set com os pedidos já vinculados
            const linkedVendas = json.vendas.filter((p: any) => p.isLinked).map((p: any) => p.id);
            const linkedBonus = json.bonificacoes.filter((p: any) => p.isLinked).map((p: any) => p.id);
            
            setSelectedVendas(new Set(linkedVendas));
            setSelectedBonus(new Set(linkedBonus));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchOrders();
    } else {
      setVendasOrders([]);
      setBonusOrders([]);
      setSelectedVendas(new Set());
      setSelectedBonus(new Set());
    }
  }, [conciliacaoClient]);

  const handleToggleVenda = (pedidoId: string) => {
    const next = new Set(selectedVendas);
    if (next.has(pedidoId)) next.delete(pedidoId);
    else next.add(pedidoId);
    setSelectedVendas(next);
  };

  const handleToggleBonus = (pedidoId: string) => {
    const next = new Set(selectedBonus);
    if (next.has(pedidoId)) next.delete(pedidoId);
    else next.add(pedidoId);
    setSelectedBonus(next);
  };

  const handleSaveLançamentos = async () => {
    setSavingLançamento(true);
    try {
      const origVendas = vendasOrders.filter(p => p.isLinked).map(p => p.id);
      const origBonus = bonusOrders.filter(p => p.isLinked).map(p => p.id);
      
      const vincularV = Array.from(selectedVendas).filter(id => !origVendas.includes(id));
      const desvincularV = origVendas.filter(id => !selectedVendas.has(id));
      
      const vincularB = Array.from(selectedBonus).filter(id => !origBonus.includes(id));
      const desvincularB = origBonus.filter(id => !selectedBonus.has(id));

      const vincular = [...vincularV, ...vincularB];
      const desvincular = [...desvincularV, ...desvincularB];

      if (vincular.length > 0 || desvincular.length > 0) {
        const res = await fetch('/api/campanhas/belmont/conciliacao', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vincular, desvincular })
        });
        if (res.ok) {
          fetchData();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingLançamento(false);
      setConciliacaoClient(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!configDataInicio) return;
    setSavingConfig(true);
    try {
      const payload: any = { dataInicio: configDataInicio };
      if (configDataEncerramento) {
        payload.dataEncerramento = configDataEncerramento;
      }
      
      const res = await fetch('/api/campanhas/belmont/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setToastMessage({ type: 'success', text: 'Campanha atualizada com sucesso!' });
        setTimeout(() => setToastMessage(null), 3000);
        fetchData(); // Recarrega os dados da tela
        setIsConfigModalOpen(false);
      } else {
        const err = await res.json();
        setToastMessage({ type: 'error', text: err.error || 'Erro ao atualizar campanha' });
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e: any) {
      console.error(e);
      setToastMessage({ type: 'error', text: 'Erro interno ao salvar.' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSavingConfig(false);
    }
  };

  const openConfigModal = () => {
    if (data?.campanha?.dataInicio) {
      setConfigDataInicio(data.campanha.dataInicio.split('T')[0]);
    }
    if (data?.campanha?.dataEncerramento) {
      setConfigDataEncerramento(data.campanha.dataEncerramento.split('T')[0]);
    } else {
      setConfigDataEncerramento('');
    }
    setIsConfigModalOpen(true);
  };

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

  // useEffect for fetchData was moved above

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

  // ── PDF handler para Proposta ──
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

  // ── PDF handler para Relatório Geral ──
  const [isGeneratingRelatorio, setIsGeneratingRelatorio] = useState(false);
  const handleGenerateRelatorioPDF = useCallback(async () => {
    if (!data) return;
    try {
      setIsGeneratingRelatorio(true);
      const pInicio = new Date(data.periodoInicio).toLocaleDateString('pt-BR');
      const pFim = new Date(data.periodoFim).toLocaleDateString('pt-BR');
      await generateRelatorioCampanhaPDF(data, `${pInicio} a ${pFim}`);
    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      setToastMessage({ type: 'error', text: 'Erro ao gerar PDF do relatório.' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsGeneratingRelatorio(false);
    }
  }, [data]);

  // ── PDF handler para Apresentação Genérica ──
  const [isGeneratingApresentacao, setIsGeneratingApresentacao] = useState(false);
  const handleGenerateApresentacaoPDF = useCallback(async () => {
    if (!data) return;
    try {
      setIsGeneratingApresentacao(true);
      await generateApresentacaoPDF(data);
    } catch (err: any) {
      console.error('Erro ao gerar apresentação:', err);
      setToastMessage({ type: 'error', text: 'Erro ao gerar PDF da apresentação.' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsGeneratingApresentacao(false);
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
          valA = a.bonificacaoConquistada;
          valB = b.bonificacaoConquistada;
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

  const totalMetaBatida = data.clientes.filter(c => c.progresso >= 100).length;
  const volumeTotalFaturado = data.clientes.reduce((acc, c) => acc + c.realizado, 0);
  const provisaoVinagres = data.clientes.reduce((acc, c) => acc + c.bonificacaoConquistada, 0);
  const vinagreEntregue = data.clientes.reduce((acc, c) => acc + c.bonificacaoEmitida, 0);
  const vinagrePendente = provisaoVinagres - vinagreEntregue;
  const totalAlvo = data.clientes.reduce((acc, c) => acc + c.quantidadeFaturar, 0);
  const progressoGeral = totalAlvo > 0 ? Math.round((volumeTotalFaturado / totalAlvo) * 100) : 0;

  return (
    <div className="space-y-6 print:h-auto print:overflow-visible print:bg-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* ═══ PRINT HEADER ═══ */}
      <div className="hidden print:block mb-8">
        <PrintHeader titulo="Relatório de Andamento: Campanha Composto Belmont" />
        <p className="text-center text-sm text-gray-500 mt-2 font-medium">Período: {periodoInicio} a {periodoFim}</p>
        
        {/* RESUMO EXECUTIVO PARA IMPRESSÃO */}
        <div className="mt-8 grid grid-cols-3 gap-6 border-y border-gray-200 py-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Vol. Total Faturado</p>
            <p className="text-2xl font-bold text-gray-900">{volumeTotalFaturado.toLocaleString('pt-BR')} cx</p>
          </div>
          <div className="text-center border-l border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Total Bonificações Concedidas</p>
            <p className="text-2xl font-bold text-gray-900">{provisaoVinagres.toLocaleString('pt-BR')} cx</p>
          </div>
          <div className="text-center border-l border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status Geral</p>
            <p className="text-2xl font-bold text-gray-900">{data.campanha.status === 'ATIVA' ? 'Em Andamento' : 'Encerrada'}</p>
          </div>
        </div>
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
            onClick={handleGenerateApresentacaoPDF}
            disabled={isGeneratingApresentacao}
            className="hidden inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {isGeneratingApresentacao ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Presentation className="h-3 w-3" />
            )}
            {isGeneratingApresentacao ? 'Gerando...' : 'Apresentação Vendas'}
          </button>
          <button
            onClick={handleGenerateRelatorioPDF}
            disabled={isGeneratingRelatorio}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {isGeneratingRelatorio ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {isGeneratingRelatorio ? 'Gerando...' : 'Exportar Relatório'}
          </button>
          <button
            onClick={openConfigModal}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
          >
            <Settings className="h-3 w-3" />
            Configurações
          </button>
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

      {/* ═══ CARDS DE RESUMO (Minimalista / Color Typography) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Clientes Ativos */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-blue-500">
            <Users className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Clientes Ativos</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-500">{data.totalClientes}</p>
            <p className="text-xs text-slate-500 mt-1">{data.totalZerados} sem histórico</p>
          </div>
        </div>

        {/* Card 2: Volume Projetado */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-cyan-500">
            <Target className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Volume Projetado</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-cyan-500">{totalAlvo.toLocaleString('pt-BR')} <span className="text-xl font-bold text-cyan-600">cx</span></p>
            <p className="text-xs text-slate-500 mt-1">Meta total da campanha</p>
          </div>
        </div>

        {/* Card 3: Realizado */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Realizado</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-emerald-500">{volumeTotalFaturado.toLocaleString('pt-BR')} <span className="text-xl font-bold text-emerald-600">cx</span></p>
            <p className="text-xs text-slate-500 mt-1">{progressoGeral}% do alvo</p>
          </div>
        </div>

        {/* Card 4: Bonificações */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-purple-500">
            <Gift className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Bonificações</h3>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-purple-500">{vinagrePendente.toLocaleString('pt-BR')} <span className="text-xl font-bold text-purple-600">cx</span></p>
            <p className="text-xs text-slate-500 mt-1">Vinagre a conceder{vinagreEntregue > 0 ? ` (Já entregues: ${vinagreEntregue})` : ''}</p>
          </div>
        </div>
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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden overflow-x-auto backdrop-blur-sm print:border-none print:bg-white print:text-black">
        <table className="w-full text-left text-sm print:text-xs">
          <thead className="bg-white/5 text-xs uppercase text-gray-400 border-b border-white/10 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
            <tr>
              <th className="px-3 py-4 font-medium w-8 text-center">#</th>
              <th
                className="px-3 py-4 font-medium cursor-pointer hover:text-white transition-colors select-none w-1/3 min-w-[240px]"
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
                <span className="text-emerald-400">Alvo</span>{' '}
                <SortIcon field="quantidadeFaturar" />
              </th>
              <th
                className="px-3 py-4 font-medium text-right cursor-pointer hover:text-white transition-colors select-none"
                onClick={() => handleSort('realizado')}
              >
                <span className="text-cyan-400">Realizado</span>{' '}
                <SortIcon field="realizado" />
              </th>
              <th className="px-3 py-4 font-medium text-right">Faltam</th>
              <th
                className="px-3 py-4 font-medium text-center cursor-pointer hover:text-white transition-colors select-none w-40"
                onClick={() => handleSort('progresso')}
              >
                Progresso <SortIcon field="progresso" />
              </th>

              <th className="px-3 py-4 font-medium text-center print:hidden">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 print:divide-gray-200">
            {filteredClients.map((cliente, idx) => (
              <motion.tr
                key={cliente.clienteId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                className={`group transition-colors print:break-inside-avoid print:text-black ${
                  cliente.isZerado
                    ? 'hover:bg-amber-500/5 bg-amber-500/[0.02] print:bg-amber-50'
                    : 'hover:bg-white/5 print:bg-white'
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConciliacaoClient(cliente)}
                          className="font-medium text-white hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 group/link text-left print:text-black"
                        >
                          <span className="truncate">{cliente.nomeFantasia || cliente.razaoSocial}</span>
                          <Gift className="h-3 w-3 text-gray-600 group-hover/link:text-amber-400 flex-shrink-0 transition-colors" />
                        </button>
                        <Link href={`/dashboard/clientes/${cliente.clienteId}/raio-x`} title="Raio-X do Cliente" className="print:hidden">
                           <ExternalLink className="h-3 w-3 text-gray-500 hover:text-blue-400 transition-colors" />
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {cliente.comprador ? (
                          <span className="text-xs text-cyan-400/80 flex items-center gap-1 font-medium print:text-gray-700">
                            A/C: {cliente.comprador}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600 italic print:text-gray-500">Comprador não cadastrado</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {cliente.cidade && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {cliente.cidade}/{cliente.estado}
                          </span>
                        )}
                        {(cliente.telefone || cliente.celular) && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 print:text-gray-600">
                            <Phone className="h-2.5 w-2.5 print:text-gray-500" />
                            {cliente.celular || cliente.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                    {cliente.isZerado && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap flex-shrink-0 print:border-amber-400 print:text-amber-700 print:bg-transparent">
                        PISO
                      </span>
                    )}
                  </div>
                </td>

                {/* Média Atual (Real) */}
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  <span className={`font-mono text-sm ${cliente.mediaAtual === 0 ? 'text-gray-600 print:text-gray-400' : 'text-gray-300 print:text-gray-800'}`}>
                    {cliente.mediaAtual % 1 === 0 ? cliente.mediaAtual : cliente.mediaAtual.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">cx</span>
                </td>

                {/* Média Base Aplicada */}
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  <span className={`font-mono text-sm ${
                    cliente.isZerado ? 'text-amber-400/80 print:text-amber-700' : 'text-gray-300 print:text-gray-800'
                  }`}>
                    {cliente.mediaBase % 1 === 0 ? cliente.mediaBase : cliente.mediaBase.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">cx</span>
                </td>

                {/* ALVO A FATURAR — Destaque */}
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 shadow-[0_0_10px_rgba(16,185,129,0.08)] print:border-emerald-500 print:bg-emerald-50 print:shadow-none">
                    <span className="font-bold text-emerald-400 text-sm font-mono print:text-emerald-700">
                      {cliente.quantidadeFaturar}
                    </span>
                  </div>
                </td>

                {/* REALIZADO */}
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1 print:border-cyan-500 print:bg-cyan-50">
                    <span className="font-bold text-cyan-400 text-sm font-mono print:text-cyan-700">
                      {cliente.realizado}
                    </span>
                  </div>
                </td>

                {/* FALTAM */}
                <td className="px-3 py-3 text-right">
                  <span className="font-mono text-sm text-gray-400">
                    {cliente.faltam} cx
                  </span>
                </td>

                {/* PROGRESSO */}
                <td className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1 w-24 mx-auto">
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden print:bg-gray-200 print:border print:border-gray-300">
                      <div 
                        className={`h-full rounded-full ${
                          cliente.progresso >= 100 ? 'bg-emerald-500 print:bg-emerald-600' :
                          cliente.progresso >= 50 ? 'bg-amber-400 print:bg-amber-500' : 'bg-red-400 print:bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, cliente.progresso))}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold ${
                      cliente.progresso >= 100 ? 'text-emerald-400 print:text-emerald-700' :
                      cliente.progresso >= 50 ? 'text-amber-400 print:text-amber-600' : 'text-red-400 print:text-red-600'
                    }`}>
                      {cliente.progresso}%
                    </span>
                  </div>
                </td>



                {/* ═══ AÇÕES: PDF ═══ */}
                <td className="px-3 py-3 print:hidden text-center">
                  <div className="flex items-center justify-center">

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
          <FileText className="h-3 w-3 text-red-400" />
          <span>PDF</span>
        </div>
      </div>

      {/* ═══ MODAL DE CONFIGURAÇÃO ═══ */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Configurar Campanha
              </h3>
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={configDataInicio}
                  onChange={(e) => setConfigDataInicio(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Data de Fim (Opcional)</label>
                <input
                  type="date"
                  value={configDataEncerramento}
                  onChange={(e) => setConfigDataEncerramento(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                disabled={savingConfig}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig || !configDataInicio}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ MODAL DE CONCILIAÇÃO (ABAS) ═══ */}
      {conciliacaoClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Gift className="h-5 w-5 text-amber-400" />
                  Auditoria de Campanha
                </h3>
                <p className="text-sm text-gray-400 mt-1">{conciliacaoClient.nomeFantasia}</p>
              </div>
              <button 
                onClick={() => setConciliacaoClient(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TABS */}
            <div className="flex border-b border-white/10 bg-black/20 shrink-0">
              <button
                onClick={() => setActiveTab('vendas')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'vendas' 
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' 
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Vendas na Meta (Composto)
              </button>
              <button
                onClick={() => setActiveTab('bonificacoes')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'bonificacoes' 
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Vinagre Entregue (Bonificações)
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-black/10">
              {loadingOrders ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : activeTab === 'vendas' ? (
                /* TAB 1: VENDAS */
                <div className="space-y-4">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-cyan-400">Composto Faturado</h4>
                      <p className="text-xs text-cyan-400/70 mt-0.5">Pedidos de Venda com Composto emitidos desde o início da campanha.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-mono font-bold text-cyan-400">
                        {vendasOrders.filter(p => selectedVendas.has(p.id)).reduce((acc, p) => acc + p.totalCaixas, 0)}
                      </span>
                      <span className="text-xs text-cyan-400/70 block">cx aprovadas</span>
                    </div>
                  </div>
                  
                  {vendasOrders.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-white/10 rounded-xl bg-white/5">
                      <p className="text-gray-400 text-sm">Nenhuma venda de Composto encontrada na janela.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {vendasOrders.map(pedido => {
                        const isChecked = selectedVendas.has(pedido.id);
                        return (
                          <div 
                            key={pedido.id} 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                              isChecked ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-gray-300">Pedido #{pedido.id.slice(-6).toUpperCase()}</span>
                                <span className="text-xs text-gray-500">{new Date(pedido.data).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">{pedido.produtos.join(', ')}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="block font-mono text-sm text-cyan-400 font-bold">{pedido.totalCaixas} cx</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={isChecked}
                                  onChange={() => handleToggleVenda(pedido.id)}
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 2: BONIFICACOES */
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-emerald-400">Vinagre Entregue</h4>
                      <p className="text-xs text-emerald-400/70 mt-0.5">Pedidos de Bonificação contendo Vinagre desde o início da campanha.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-mono font-bold text-emerald-400">
                        {bonusOrders.filter(p => selectedBonus.has(p.id)).reduce((acc, p) => acc + p.totalCaixas, 0)}
                      </span>
                      <span className="text-xs text-emerald-400/70 block">cx aprovadas</span>
                    </div>
                  </div>
                  
                  {bonusOrders.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-white/10 rounded-xl bg-white/5">
                      <p className="text-gray-400 text-sm">Nenhuma bonificação de Vinagre encontrada na janela.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bonusOrders.map(pedido => {
                        const isChecked = selectedBonus.has(pedido.id);
                        return (
                          <div 
                            key={pedido.id} 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                              isChecked ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-gray-300">Pedido #{pedido.id.slice(-6).toUpperCase()}</span>
                                <span className="text-xs text-gray-500">{new Date(pedido.data).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">{pedido.produtos.join(', ')}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="block font-mono text-sm text-emerald-400 font-bold">{pedido.totalCaixas} cx</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={isChecked}
                                  onChange={() => handleToggleBonus(pedido.id)}
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setConciliacaoClient(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                disabled={savingLançamento}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLançamentos}
                disabled={savingLançamento || data?.campanha.status !== 'ATIVA'}
                className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLançamento ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Auditoria'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ TOAST FEEDBACK ═══ */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${
            toastMessage.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-red-600 shadow-red-500/30'
          }`}
        >
          {toastMessage.type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toastMessage.text}
        </motion.div>
      )}
    </div>
  );
}
