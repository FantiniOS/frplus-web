/* eslint-disable */
'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useData } from '@/contexts/DataContext';
import {
    FileText, Calendar, Download, TrendingUp, Users, Package,
    DollarSign, BarChart3, PieChart, Filter, Printer, ChevronDown, Check, ChevronUp, FileDown, MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function RelatoriosPage() {
    const { orders, clients, products, fabricas, refreshData } = useData();

    // Force refresh on mount to ensure up-to-date data
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'produtos' | 'clientes' | 'tabela'>('vendas');

    // Helpers for local date strings
    const getLocalDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    const getLastMonthDate = () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    const [periodoInicio, setPeriodoInicio] = useState(getLastMonthDate());
    const [periodoFim, setPeriodoFim] = useState(getLocalDate());
    const [exportando, setExportando] = useState(false);
    const [tabelaPrecoSelecionada, setTabelaPrecoSelecionada] = useState<'todas' | '50a199' | '200a699' | 'atacado' | 'avista' | 'redes'>('todas');
    const [fabricaSelecionada, setFabricaSelecionada] = useState<string>('todas');
    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const relatorioRef = useRef<HTMLDivElement>(null);

    // ... (rest of code)

    // Estatísticas de Clientes
    const estatisticasClientes = useMemo(() => {
        const clientesVendas = new Map<string, { id: string; nome: string; pedidos: number; valor: number }>();

        pedidosFiltrados.forEach(order => {
            const atual = clientesVendas.get(order.clienteId) || { id: order.clienteId, nome: order.nomeCliente, pedidos: 0, valor: 0 };
            clientesVendas.set(order.clienteId, {
                id: order.clienteId,
                nome: order.nomeCliente,
                pedidos: atual.pedidos + 1,
                valor: atual.valor + order.valorTotal
            });
        });

        return Array.from(clientesVendas.values())
            .sort((a, b) => b.valor - a.valor);
    }, [pedidosFiltrados]);

    // Função para imprimir
    const handlePrint = () => {
        window.print();
    };

    // Função para exportar PDF Profissional
    const handleExportPDF = async () => {
        setExportando(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            // Tabela de preços em retrato, outros em paisagem
            const isTabela = tipoRelatorio === 'tabela';
            const doc = new jsPDF({
                orientation: isTabela ? 'portrait' : 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            const pageWidth = doc.internal.pageSize.getWidth();

            // Cores - Header escuro igual ao site
            const corHeader: [number, number, number] = [13, 13, 13]; // #0d0d0d
            const corPrimaria: [number, number, number] = [37, 99, 235]; // Azul para tabelas
            const corTexto: [number, number, number] = [30, 30, 30];

            // Header com fundo escuro
            doc.setFillColor(corHeader[0], corHeader[1], corHeader[2]);
            doc.rect(0, 0, pageWidth, 40, 'F');

            // Variáveis de posição inicial
            let logoEndPos = 10;

            // Tentar carregar logo mantendo proporção
            try {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                await new Promise<void>((resolve) => {
                    logoImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(logoImg, 0, 0);
                        const logoData = canvas.toDataURL('image/png');

                        // Manter proporção da logo (Máximo 30mm de largura)
                        const maxHeight = 25;
                        const maxWidth = 50;
                        let logoHeight = maxHeight;
                        let logoWidth = (logoImg.width / logoImg.height) * logoHeight;

                        if (logoWidth > maxWidth) {
                            logoWidth = maxWidth;
                            logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                        }

                        doc.addImage(logoData, 'PNG', 10, 7.5, logoWidth, logoHeight);
                        logoEndPos = 10 + logoWidth + 5;
                        resolve();
                    };
                    logoImg.onerror = () => resolve();
                    logoImg.src = '/logo.png';
                });
            } catch {
                // Continua sem logo se houver erro
            }

            // Centralizar Títulos
            doc.setTextColor(255, 255, 255);

            // Nome da empresa
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('FRPlus', pageWidth / 2, 15, { align: 'center' });

            // Subtítulo do sistema
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 180, 180);
            doc.text('Sistema de Gestão Comercial', pageWidth / 2, 20, { align: 'center' });

            // Título do relatório
            const titulosRelatorio: Record<string, string> = {
                vendas: 'Relatório de Vendas',
                produtos: 'Ranking de Produtos',
                clientes: 'Ranking de Clientes',
                tabela: 'Tabela de Preços'
            };
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(titulosRelatorio[tipoRelatorio], pageWidth / 2, 30, { align: 'center' });

            // Data e período (Canto Direito)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 180, 180);
            doc.text(`${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 10, 12, { align: 'right' });
            doc.text(`${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 10, 16, { align: 'right' });

            if (tipoRelatorio !== 'tabela') {
                doc.text(`Período:`, pageWidth - 10, 24, { align: 'right' });
                doc.text(`${new Date(periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(periodoFim).toLocaleDateString('pt-BR')}`, pageWidth - 10, 28, { align: 'right' });
            }

            let startY = 45;
            doc.setTextColor(corTexto[0], corTexto[1], corTexto[2]);

            // Tabela baseada no tipo de relatório
            if (tipoRelatorio === 'vendas') {
                // KPIs
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`Total Vendas: R$ ${estatisticasVendas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, startY);
                doc.text(`Pedidos: ${estatisticasVendas.totalPedidos}`, 100, startY);
                doc.text(`Ticket Médio: R$ ${estatisticasVendas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, startY);
                startY += 10;

                autoTable(doc, {
                    startY,
                    head: [['Pedido', 'Cliente', 'Data', 'Itens', 'Valor']],
                    body: pedidosFiltrados.map(o => [
                        `#${o.id.slice(-6)}`,
                        o.nomeCliente,
                        new Date(o.data).toLocaleDateString('pt-BR'),
                        o.itens.length.toString(),
                        `R$ ${o.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    ]),
                    styles: { fontSize: 9, cellPadding: 3, halign: 'center', valign: 'middle' },
                    headStyles: { fillColor: corPrimaria, textColor: 255, halign: 'center' },
                    columnStyles: {
                        0: { halign: 'left' },
                        1: { halign: 'left' },
                        4: { halign: 'right' }
                    },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    margin: { top: 10, left: 10, right: 10 }
                });
            } else if (tipoRelatorio === 'produtos') {
                autoTable(doc, {
                    startY,
                    head: [['#', 'Produto', 'Quantidade Vendida', 'Valor Total']],
                    body: estatisticasProdutos.map((p, i) => [
                        (i + 1).toString(),
                        p.nome,
                        p.qtd.toString(),
                        `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    ]),
                    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                    headStyles: { fillColor: corPrimaria, textColor: 255 },
                    columnStyles: {
                        1: { halign: 'left' },
                        3: { halign: 'right' }
                    },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    foot: [['', 'TOTAL', estatisticasProdutos.reduce((a, p) => a + p.qtd, 0).toString(), `R$ ${estatisticasProdutos.reduce((a, p) => a + p.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                    footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'right' },
                    margin: { top: 10, left: 10, right: 10 }
                });
            } else if (tipoRelatorio === 'clientes') {
                autoTable(doc, {
                    startY,
                    head: [['#', 'Cliente', 'Pedidos', 'Valor Total']],
                    body: estatisticasClientes.map((c, i) => [
                        (i + 1).toString(),
                        c.nome,
                        c.pedidos.toString(),
                        `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    ]),
                    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                    headStyles: { fillColor: corPrimaria, textColor: 255 },
                    columnStyles: {
                        1: { halign: 'left' },
                        3: { halign: 'right' }
                    },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    foot: [['', 'TOTAL', estatisticasClientes.reduce((a, c) => a + c.pedidos, 0).toString(), `R$ ${estatisticasClientes.reduce((a, c) => a + c.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                    footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'right' },
                    margin: { top: 10, left: 10, right: 10 }
                });
            } else if (tipoRelatorio === 'tabela') {
                // Configurar colunas baseado na tabela selecionada
                const nomesTabelas: Record<string, string> = {
                    'todas': 'Todas as Tabelas',
                    '50a199': '50 a 199 unidades',
                    '200a699': '200 a 699 unidades',
                    'atacado': 'Atacado',
                    'avista': 'Atacado À Vista',
                    'redes': 'Redes'
                };

                // Adicionar subtítulo com tabela selecionada
                if (tabelaPrecoSelecionada !== 'todas') {
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Tabela: ${nomesTabelas[tabelaPrecoSelecionada]}`, 15, startY);
                    startY += 8;
                }

                // Filtrar produtos pela fábrica selecionada
                const produtosFiltrados = products.filter(p => {
                    if (fabricaSelecionada === 'todas') return true;
                    if (fabricaSelecionada === 'sem-fabrica') return !p.fabricaId;
                    return p.fabricaId === fabricaSelecionada;
                });

                // Agrupar produtos por fábrica
                const productsByFabrica = produtosFiltrados.reduce((acc, product) => {
                    const fabricaId = product.fabricaId || 'sem-fabrica';
                    if (!acc[fabricaId]) {
                        acc[fabricaId] = [];
                    }
                    acc[fabricaId].push(product);
                    return acc;
                }, {} as Record<string, typeof products>);

                // Ordenar fábricas
                const sortedFabricas = Object.keys(productsByFabrica).sort((a, b) => {
                    const nomeA = a === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === a)?.nome || 'Outros');
                    const nomeB = b === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === b)?.nome || 'Outros');
                    if (a === 'sem-fabrica') return 1;
                    if (b === 'sem-fabrica') return -1;
                    return nomeA.localeCompare(nomeB);
                });

                // Gerar tabela para cada fábrica
                for (const fabricaId of sortedFabricas) {
                    const groupProducts = productsByFabrica[fabricaId];
                    const fabricaNome = fabricaId === 'sem-fabrica' ? 'OUTROS' : (fabricas.find(f => f.id === fabricaId)?.nome || 'OUTROS').toUpperCase();

                    // Título da Fábrica
                    // Verificar se precisa de nova página
                    if (startY > doc.internal.pageSize.getHeight() - 40) {
                        doc.addPage();
                        startY = 20;
                    }

                    doc.setFillColor(240, 240, 240);
                    doc.rect(14, startY, pageWidth - 28, 8, 'F');
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(50, 50, 50);
                    doc.text(fabricaNome, 16, startY + 5.5);
                    startY += 8;

                    // Definir colunas baseado na seleção
                    let headers: string[][] = [];
                    let bodyData: string[][] = [];

                    if (tabelaPrecoSelecionada === 'todas') {
                        headers = [['Código', 'Produto', '50-199', '200-699', 'Atacado', 'À Vista', 'Redes']];
                        bodyData = groupProducts.map(p => [
                            p.codigo,
                            p.nome,
                            `R$ ${p.preco50a199?.toFixed(2) || '0.00'}`,
                            `R$ ${p.preco200a699?.toFixed(2) || '0.00'}`,
                            `R$ ${p.precoAtacado?.toFixed(2) || '0.00'}`,
                            `R$ ${p.precoAtacadoAVista?.toFixed(2) || '0.00'}`,
                            `R$ ${p.precoRedes?.toFixed(2) || '0.00'}`
                        ]);
                    } else {
                        headers = [['Código', 'Produto', 'Preço']];
                        bodyData = groupProducts.map(p => {
                            let preco = '0.00';
                            if (tabelaPrecoSelecionada === '50a199') preco = p.preco50a199?.toFixed(2) || '0.00';
                            else if (tabelaPrecoSelecionada === '200a699') preco = p.preco200a699?.toFixed(2) || '0.00';
                            else if (tabelaPrecoSelecionada === 'atacado') preco = p.precoAtacado?.toFixed(2) || '0.00';
                            else if (tabelaPrecoSelecionada === 'avista') preco = p.precoAtacadoAVista?.toFixed(2) || '0.00';
                            else if (tabelaPrecoSelecionada === 'redes') preco = p.precoRedes?.toFixed(2) || '0.00';
                            return [
                                p.codigo,
                                p.nome,
                                `R$ ${preco}`
                            ];
                        });
                    }

                    autoTable(doc, {
                        startY,
                        head: headers,
                        body: bodyData,
                        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                        headStyles: { fillColor: corPrimaria, textColor: 255, halign: 'center' },
                        alternateRowStyles: { fillColor: [255, 255, 255] },
                        margin: { top: 10, left: 14, right: 14 },
                        columnStyles: tabelaPrecoSelecionada === 'todas' ? {
                            0: { cellWidth: 20, halign: 'left' },
                            1: { cellWidth: 'auto', halign: 'left' }
                        } : {
                            0: { cellWidth: 20, halign: 'left' },
                            1: { cellWidth: 'auto', halign: 'left' },
                            2: { cellWidth: 30, halign: 'right' }
                        }
                    });

                    // Atualizar startY para a próxima tabela
                    // @ts-ignore
                    startY = doc.lastAutoTable.finalY + 10;
                }
            }

            // Rodapé
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                doc.text('FRPlus - Sistema de Gestão Comercial', 15, doc.internal.pageSize.getHeight() - 10);
            }

            // Salvar
            const nomeArquivo = `${titulosRelatorio[tipoRelatorio].replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(nomeArquivo);

        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setExportando(false);
    };

    return (
        <div className="space-y-5 print:bg-white print:text-black">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-white">Relatórios</h1>
                    <p className="text-sm text-gray-400">
                        {orders.length} pedidos no sistema • {pedidosFiltrados.length} no período selecionado
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportPDF}
                        disabled={exportando}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                    >
                        <FileDown className="h-4 w-4" />
                        {exportando ? 'Gerando...' : 'Exportar PDF'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="form-card print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Tipo de Relatório */}
                    <div>
                        <label className="label-compact">Tipo de Relatório</label>
                        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                            {[
                                { id: 'vendas', label: 'Vendas', icon: TrendingUp },
                                { id: 'produtos', label: 'Produtos', icon: Package },
                                { id: 'clientes', label: 'Clientes', icon: Users },
                                { id: 'tabela', label: 'Tabela de Preços', icon: DollarSign }
                            ].map(tipo => (
                                <button
                                    key={tipo.id}
                                    onClick={() => setTipoRelatorio(tipo.id as typeof tipoRelatorio)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${tipoRelatorio === tipo.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <tipo.icon className="h-3 w-3" />
                                    {tipo.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Período (Não exibir para Tabela de Preços) */}
                    {tipoRelatorio !== 'tabela' && (
                        <>
                            <div>
                                <label className="label-compact">Período Início</label>
                                <input
                                    type="date"
                                    value={periodoInicio}
                                    onChange={(e) => setPeriodoInicio(e.target.value)}
                                    className="input-compact"
                                />
                            </div>
                            <div>
                                <label className="label-compact">Período Fim</label>
                                <input
                                    type="date"
                                    value={periodoFim}
                                    onChange={(e) => setPeriodoFim(e.target.value)}
                                    className="input-compact"
                                />
                            </div>
                        </>
                    )}

                    {/* Seletor de Tabela de Preços (apenas para relatório de tabela) */}
                    {tipoRelatorio === 'tabela' && (
                        <>
                            <div>
                                <label className="label-compact">Tabela para Exportar</label>
                                <select
                                    value={tabelaPrecoSelecionada}
                                    onChange={(e) => setTabelaPrecoSelecionada(e.target.value as typeof tabelaPrecoSelecionada)}
                                    className="input-compact"
                                >
                                    <option value="todas">Todas as Tabelas</option>
                                    <option value="50a199">50 a 199 unidades</option>
                                    <option value="200a699">200 a 699 unidades</option>
                                    <option value="atacado">Atacado</option>
                                    <option value="avista">Atacado À Vista</option>
                                    <option value="redes">Redes</option>
                                </select>
                            </div>
                            <div>
                                <label className="label-compact">Filtrar por Fábrica</label>
                                <select
                                    value={fabricaSelecionada}
                                    onChange={(e) => setFabricaSelecionada(e.target.value)}
                                    className="input-compact"
                                >
                                    <option value="todas">Todas as Fábricas</option>
                                    {fabricas
                                        .sort((a, b) => a.nome.localeCompare(b.nome))
                                        .map(fabrica => (
                                            <option key={fabrica.id} value={fabrica.id}>
                                                {fabrica.nome}
                                            </option>
                                        ))
                                    }
                                    <option value="sem-fabrica">Sem Fábrica Definida</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div >

            {/* Conteúdo para PDF */}
            < div ref={relatorioRef} className="bg-[#0d0d0d] print:bg-white" >

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <DollarSign className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Total Vendas</p>
                                <p className="text-xl font-bold text-white print:text-black">
                                    R$ {estatisticasVendas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <FileText className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Pedidos</p>
                                <p className="text-xl font-bold text-white print:text-black">{estatisticasVendas.totalPedidos}</p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <BarChart3 className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Ticket Médio</p>
                                <p className="text-xl font-bold text-white print:text-black">
                                    R$ {estatisticasVendas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="form-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <Users className="h-5 w-5 text-orange-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Clientes Ativos</p>
                                <p className="text-xl font-bold text-white print:text-black">{estatisticasClientes.length}</p>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Conteúdo do Relatório */}
                {
                    tipoRelatorio === 'vendas' && (
                        <div className="space-y-4">
                            {/* Gráfico de Vendas por Dia */}
                            <div className="form-card">
                                <h3 className="text-lg font-semibold text-white print:text-black mb-4">Vendas por Dia</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-white/10 print:border-gray-300">
                                            <tr>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Data</th>
                                                <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(estatisticasVendas.vendasPorDia)
                                                .sort((a, b) => new Date(b[0].split('/').reverse().join('-')).getTime() - new Date(a[0].split('/').reverse().join('-')).getTime())
                                                .map(([dia, valor]) => (
                                                    <tr key={dia} className="border-b border-white/5 print:border-gray-200">
                                                        <td className="py-2 text-white print:text-black">{dia}</td>
                                                        <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                            R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Lista de Pedidos */}
                            <div className="form-card">
                                <h3 className="text-lg font-semibold text-white print:text-black mb-4">Detalhamento de Pedidos</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-white/10 print:border-gray-300">
                                            <tr>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Pedido</th>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Cliente</th>
                                                <th className="text-left py-2 text-gray-400 print:text-gray-600">Data</th>
                                                <th className="text-center py-2 text-gray-400 print:text-gray-600">Itens</th>
                                                <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pedidosFiltrados
                                                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                                .map(order => (
                                                    <>
                                                        <tr
                                                            key={order.id}
                                                            className="border-b border-white/5 print:border-gray-200 cursor-pointer hover:bg-white/5 transition-colors"
                                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                        >
                                                            <td className="py-2 font-mono text-white print:text-black">
                                                                <div className="flex items-center gap-2">
                                                                    {expandedOrderId === order.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                                    #{order.id.slice(-6)}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 text-white print:text-black">{order.nomeCliente}</td>
                                                            <td className="py-2 text-gray-400 print:text-gray-600">{new Date(order.data).toLocaleDateString('pt-BR')}</td>
                                                            <td className="py-2 text-center text-gray-400 print:text-gray-600">{order.itens.length}</td>
                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span>R$ {order.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const phone = clients.find(c => c.id === order.clienteId)?.celular || '';
                                                                            if (!phone) {
                                                                                alert('Cliente sem celular cadastrado');
                                                                                return;
                                                                            }
                                                                            const message = `Olá *${order.nomeCliente}*, segue o resumo do seu pedido *#${order.id.slice(-6)}*:\n\n` +
                                                                                order.itens.map(i => `- ${i.quantidade}x ${i.nomeProduto} (R$ ${i.total.toFixed(2)})`).join('\n') +
                                                                                `\n\n*Total: R$ ${order.valorTotal.toFixed(2)}*`;

                                                                            // Clean phone number
                                                                            const cleanPhone = phone.replace(/\D/g, '');
                                                                            // Use API to send (or fallback to wa.me if API fails/not implemented fully yet)
                                                                            // For now, let's use the API we just built!
                                                                            fetch('/api/whatsapp/send-text', {
                                                                                method: 'POST',
                                                                                body: JSON.stringify({ phone: '55' + cleanPhone, message })
                                                                            }).then(async res => {
                                                                                if (res.ok) alert('Mensagem enviada via Evolution API!');
                                                                                else {
                                                                                    // Fallback to wa.me
                                                                                    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
                                                                                    alert('Erro na API, abrindo WhatsApp Web...');
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="p-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white transition-colors"
                                                                        title="Enviar no WhatsApp"
                                                                    >
                                                                        <MessageCircle size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedOrderId === order.id && (
                                                            <tr className="bg-white/5 print:bg-gray-50">
                                                                <td colSpan={5} className="p-0">
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="p-4"
                                                                    >
                                                                        <div className="bg-black/20 print:bg-white rounded-lg p-3 border border-white/10 print:border-gray-200">
                                                                            <p className="text-sm font-semibold text-white print:text-black mb-2 flex items-center gap-2">
                                                                                <Package size={14} className="text-blue-400" />
                                                                                Itens do Pedido
                                                                            </p>
                                                                            <table className="w-full text-xs">
                                                                                <thead>
                                                                                    <tr className="text-gray-400 print:text-gray-600 border-b border-white/10 print:border-gray-200">
                                                                                        <th className="text-left py-2 font-medium">Produto</th>
                                                                                        <th className="text-center py-2 font-medium">Qtd</th>
                                                                                        <th className="text-right py-2 font-medium">Unitário</th>
                                                                                        <th className="text-right py-2 font-medium">Total</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {order.itens.map(item => (
                                                                                        <tr key={item.id || item.produtoId} className="border-b border-white/5 print:border-gray-100 last:border-0">
                                                                                            <td className="py-2 text-white print:text-black">{item.nomeProduto}</td>
                                                                                            <td className="py-2 text-center text-gray-300 print:text-gray-700">{item.quantidade}</td>
                                                                                            <td className="py-2 text-right text-gray-300 print:text-gray-700">R$ {item.precoUnitario.toFixed(2)}</td>
                                                                                            <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">R$ {item.total.toFixed(2)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </motion.div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'produtos' && (
                        <div className="form-card">
                            <h3 className="text-lg font-semibold text-white print:text-black mb-4">Ranking de Produtos</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10 print:border-gray-300">
                                        <tr>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">#</th>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Produto</th>
                                            <th className="text-center py-2 text-gray-400 print:text-gray-600">Qtd Vendida</th>
                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estatisticasProdutos.map((p, index) => (
                                            <tr key={p.nome} className="border-b border-white/5 print:border-gray-200">
                                                <td className="py-2 text-gray-500">{index + 1}</td>
                                                <td className="py-2 text-white print:text-black font-medium">{p.nome}</td>
                                                <td className="py-2 text-center text-gray-400 print:text-gray-600">{p.qtd}</td>
                                                <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                    R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-white/20 print:border-gray-400">
                                        <tr>
                                            <td colSpan={2} className="py-2 font-bold text-white print:text-black">Total</td>
                                            <td className="py-2 text-center font-bold text-white print:text-black">
                                                {estatisticasProdutos.reduce((acc, p) => acc + p.qtd, 0)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-green-400 print:text-green-600">
                                                R$ {estatisticasProdutos.reduce((acc, p) => acc + p.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'clientes' && (
                        <div className="form-card">
                            <h3 className="text-lg font-semibold text-white print:text-black mb-4">Ranking de Clientes</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10 print:border-gray-300">
                                        <tr>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">#</th>
                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Cliente</th>
                                            <th className="text-center py-2 text-gray-400 print:text-gray-600">Pedidos</th>
                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estatisticasClientes.map((c, index) => (
                                            <Fragment key={c.id}>
                                                <tr
                                                    className="border-b border-white/5 print:border-gray-200 cursor-pointer hover:bg-white/5 transition-colors"
                                                    onClick={() => setExpandedClientId(expandedClientId === c.id ? null : c.id)}
                                                >
                                                    <td className="py-2 text-gray-500">
                                                        <div className="flex items-center gap-2">
                                                            {expandedClientId === c.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                            {index + 1}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-white print:text-black font-medium">{c.nome}</td>
                                                    <td className="py-2 text-center text-gray-400 print:text-gray-600">{c.pedidos}</td>
                                                    <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">
                                                        R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                                {expandedClientId === c.id && (
                                                    <tr className="bg-white/5 print:bg-gray-50">
                                                        <td colSpan={4} className="p-0">
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="p-4"
                                                            >
                                                                <div className="bg-black/20 print:bg-white rounded-lg p-3 border border-white/10 print:border-gray-200">
                                                                    <p className="text-sm font-semibold text-white print:text-black mb-2 flex items-center gap-2">
                                                                        <FileText size={14} className="text-blue-400" />
                                                                        Histórico de Pedidos (Neste Período)
                                                                    </p>
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-gray-400 print:text-gray-600 border-b border-white/10 print:border-gray-200">
                                                                                <th className="text-left py-2 font-medium">Data</th>
                                                                                <th className="text-center py-2 font-medium">Pedido</th>
                                                                                <th className="text-center py-2 font-medium">Itens</th>
                                                                                <th className="text-right py-2 font-medium">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {pedidosFiltrados
                                                                                .filter(p => p.clienteId === c.id)
                                                                                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                                                                .map(order => (
                                                                                    <tr key={order.id} className="border-b border-white/5 print:border-gray-100 last:border-0 hover:bg-white/5">
                                                                                        <td className="py-2 text-gray-300 print:text-gray-700">{new Date(order.data).toLocaleDateString('pt-BR')}</td>
                                                                                        <td className="py-2 text-center text-gray-300 print:text-gray-700 font-mono">#{order.id.slice(-6)}</td>
                                                                                        <td className="py-2 text-center text-gray-300 print:text-gray-700">{order.itens.length}</td>
                                                                                        <td className="py-2 text-right text-green-400 print:text-green-600 font-medium">R$ {order.valorTotal.toFixed(2)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </motion.div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-white/20 print:border-gray-400">
                                        <tr>
                                            <td colSpan={2} className="py-2 font-bold text-white print:text-black">Total</td>
                                            <td className="py-2 text-center font-bold text-white print:text-black">
                                                {estatisticasClientes.reduce((acc, c) => acc + c.pedidos, 0)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-green-400 print:text-green-600">
                                                R$ {estatisticasClientes.reduce((acc, c) => acc + c.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )
                }

                {
                    tipoRelatorio === 'tabela' && (
                        <div className="space-y-8">
                            {(() => {
                                // Filtrar produtos pela fábrica selecionada
                                const produtosFiltrados = products.filter(p => {
                                    if (fabricaSelecionada === 'todas') return true;
                                    if (fabricaSelecionada === 'sem-fabrica') return !p.fabricaId;
                                    return p.fabricaId === fabricaSelecionada;
                                });

                                // Agrupar produtos por fábrica
                                const productsByFabrica = produtosFiltrados.reduce((acc, product) => {
                                    const fabricaId = product.fabricaId || 'sem-fabrica';
                                    if (!acc[fabricaId]) {
                                        acc[fabricaId] = [];
                                    }
                                    acc[fabricaId].push(product);
                                    return acc;
                                }, {} as Record<string, typeof products>);

                                const sortedFabricas = Object.keys(productsByFabrica).sort((a, b) => {
                                    const nomeA = a === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === a)?.nome || 'Outros');
                                    const nomeB = b === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === b)?.nome || 'Outros');
                                    if (a === 'sem-fabrica') return 1;
                                    if (b === 'sem-fabrica') return -1;
                                    return nomeA.localeCompare(nomeB);
                                });

                                return sortedFabricas.map(fabricaId => {
                                    const groupProducts = productsByFabrica[fabricaId];
                                    const fabricaNome = fabricaId === 'sem-fabrica' ? 'Outros' : (fabricas.find(f => f.id === fabricaId)?.nome || 'Outros');

                                    return (
                                        <div key={fabricaId} className="form-card break-inside-avoid">
                                            <div className="flex items-center justify-between mb-4 print:mb-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-white print:text-black uppercase tracking-wider">{fabricaNome}</h3>
                                                    <span className="text-sm text-gray-400 print:text-gray-600">({groupProducts.length} itens)</span>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="border-b border-white/10 print:border-gray-300">
                                                        <tr>
                                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Código</th>
                                                            <th className="text-left py-2 text-gray-400 print:text-gray-600">Produto</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">50-199</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">200-699</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Atacado</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">À Vista</th>
                                                            <th className="text-right py-2 text-gray-400 print:text-gray-600">Redes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groupProducts.map((p) => (
                                                            <tr key={p.id} className="border-b border-white/5 print:border-gray-200 hover:bg-white/5 print:hover:bg-transparent transition-colors">
                                                                <td className="py-2 font-mono text-gray-400 print:text-gray-600 text-xs">{p.codigo}</td>
                                                                <td className="py-2 text-white print:text-black font-medium">{p.nome}</td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.preco50a199?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.preco200a699?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoAtacado?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoAtacadoAVista?.toFixed(2) || '0.00'}
                                                                </td>
                                                                <td className="py-2 text-right text-green-400 print:text-green-600">
                                                                    R$ {p.precoRedes?.toFixed(2) || '0.00'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
