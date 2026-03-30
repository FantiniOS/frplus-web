'use client';

import Link from "next/link";
import { ArrowLeft, Save, Building2, MapPin, DollarSign, Search, Loader2, User, CalendarPlus, X, FileText, Download, Clock, Factory } from "lucide-react";
import { useData, Client } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { agendarVisita } from "@/app/actions/visitas";
import { getHistoricoTabela, registrarEnvioTabela } from "@/app/actions/tabelaPreco";

// Price table mapping
const TABELA_PRECO_MAP: Record<string, { field: string; label: string }> = {
    '50a199': { field: 'preco50a199', label: '50 a 199 CX' },
    '200a699': { field: 'preco200a699', label: '200 a 699 CX' },
    'atacado': { field: 'precoAtacado', label: 'Atacado' },
    'atacadoAVista': { field: 'precoAtacadoAVista', label: 'Atacado à Vista' },
    'redes': { field: 'precoRedes', label: 'Redes' },
};

interface HistoricoItem {
    representadaId: string;
    representadaNome: string;
    dataGeracao: Date | string;
}

export default function EditarClientePage({ params }: { params: { id: string } }) {
    const { clients, fabricas, updateClient, showToast } = useData();
    const { isIndustria } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState<Partial<Client>>({});
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // Modal Visita State
    const [showModalVisita, setShowModalVisita] = useState(false);
    const [dataVisita, setDataVisita] = useState('');
    const [horaVisita, setHoraVisita] = useState('');
    const [obsVisita, setObsVisita] = useState('');
    const [loadingVisita, setLoadingVisita] = useState(false);

    // Historico Tabela State
    const [historico, setHistorico] = useState<HistoricoItem[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(true);

    // Modal Gerar PDF State
    const [showModalPDF, setShowModalPDF] = useState(false);
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [comunicado, setComunicado] = useState('');
    const [loadingPDF, setLoadingPDF] = useState(false);

    useEffect(() => {
        if (isIndustria) {
            router.push('/dashboard/clientes');
        }
    }, [isIndustria, router]);

    useEffect(() => {
        const client = clients.find(c => c.id === params.id);
        if (client) setFormData(client);
    }, [clients, params.id]);

    // Fetch historico
    const fetchHistorico = useCallback(async () => {
        if (!params.id) return;
        setLoadingHistorico(true);
        try {
            const res = await getHistoricoTabela(params.id);
            if (res.success && res.historicos) {
                setHistorico(res.historicos);
            }
        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
        } finally {
            setLoadingHistorico(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchHistorico();
    }, [fetchHistorico]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Buscar dados pelo CNPJ
    const buscarCnpj = async () => {
        const cnpj = formData.cnpj?.replace(/\D/g, '');
        if (!cnpj || cnpj.length !== 14) {
            showToast("CNPJ inválido (14 dígitos)", "error");
            return;
        }

        setLoadingCnpj(true);
        try {
            const response = await fetch(`/api/cnpj/${cnpj}`);
            if (!response.ok) throw new Error('CNPJ não encontrado');

            const data = await response.json();

            setFormData(prev => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
                cep: data.cep?.replace(/\D/g, '') || prev.cep,
                endereco: data.logradouro || prev.endereco,
                numero: data.numero || prev.numero,
                bairro: data.bairro || prev.bairro,
                cidade: data.municipio || prev.cidade,
                estado: data.uf || prev.estado,
            }));

            showToast("Dados do CNPJ carregados!", "success");
        } catch {
            showToast("CNPJ não encontrado", "error");
        } finally {
            setLoadingCnpj(false);
        }
    };

    // Buscar endereço pelo CEP
    const buscarCep = async () => {
        const cep = formData.cep?.replace(/\D/g, '');
        if (!cep || cep.length !== 8) {
            showToast("CEP inválido (8 dígitos)", "error");
            return;
        }

        setLoadingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) throw new Error('CEP não encontrado');

            setFormData(prev => ({
                ...prev,
                endereco: data.logradouro || prev.endereco,
                bairro: data.bairro || prev.bairro,
                cidade: data.localidade || prev.cidade,
                uf: data.uf || prev.uf,
            }));

            showToast("Endereço carregado!", "success");
        } catch {
            showToast("CEP não encontrado", "error");
        } finally {
            setLoadingCep(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.razaoSocial || !formData.cnpj) {
            showToast("Preencha Razão Social e CNPJ", "error");
            return;
        }
        if (formData.id) {
            // Ensure compatibilty
            const updateData = {
                ...formData,
                nome: formData.razaoSocial, // Keep name synced for now
                tabelaPreco: formData.tabelaPreco || '50a199' // Ensure default table
            };
            updateClient(formData.id, updateData);
            router.push('/dashboard/clientes');
        }
    };

    const handleAgendarVisita = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dataVisita || !horaVisita) {
            showToast("Preencha data e hora da visita", "error");
            return;
        }

        setLoadingVisita(true);
        try {
            const dateObj = new Date(`${dataVisita}T${horaVisita}:00`);
            
            const res = await agendarVisita({
                titulo: "Visita Agendada",
                clienteId: formData.id!,
                dataVisita: dateObj,
                observacoes: obsVisita
            });

            if (res.success) {
                showToast("Visita agendada com sucesso!", "success");
                setShowModalVisita(false);
                setDataVisita('');
                setHoraVisita('');
                setObsVisita('');
            } else {
                showToast("Erro ao agendar visita", "error");
            }
        } catch (error) {
            showToast("Erro ao agendar visita", "error");
        } finally {
            setLoadingVisita(false);
        }
    };

    // ===== PDF GENERATION (matching relatorios/verbas pattern) =====
    const handleGerarPDF = async () => {
        if (!selectedFabricaId) {
            showToast("Selecione uma Representada", "error");
            return;
        }

        const fabrica = fabricas.find(f => f.id === selectedFabricaId);
        if (!fabrica) {
            showToast("Representada não encontrada", "error");
            return;
        }

        const tabelaPreco = formData.tabelaPreco || '50a199';
        const tabelaConfig = TABELA_PRECO_MAP[tabelaPreco];
        if (!tabelaConfig) {
            showToast("Tabela de preço do cliente não configurada", "error");
            return;
        }

        setLoadingPDF(true);
        try {
            // 1. Fetch products
            const res = await fetch(`/api/products/by-fabrica?fabricaId=${selectedFabricaId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Erro ao buscar produtos');
            const produtos = await res.json();

            if (!produtos.length) {
                showToast("Nenhum produto ativo encontrado para esta Representada", "error");
                setLoadingPDF(false);
                return;
            }

            // 2. Dynamic import jsPDF (same pattern as relatorios/verbas)
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = { left: 14, right: 14 };
            const contentWidth = pageWidth - margin.left - margin.right;

            // ===== PREMIUM COLOR PALETTE (same as relatorios) =====
            const colors = {
                headerDark: [10, 10, 14] as [number, number, number],
                accentBlue: [37, 99, 235] as [number, number, number],
                accentCyan: [6, 182, 212] as [number, number, number],
                textDark: [20, 20, 30] as [number, number, number],
                textMuted: [120, 120, 140] as [number, number, number],
                textLight: [200, 200, 220] as [number, number, number],
                white: [255, 255, 255] as [number, number, number],
                rowEven: [250, 251, 254] as [number, number, number],
                greenAccent: [16, 185, 129] as [number, number, number],
                tableBorder: [226, 232, 240] as [number, number, number],
                factoryBg: [235, 238, 248] as [number, number, number],
                factoryAccent: [30, 64, 175] as [number, number, number],
            };

            // ===== LOGO LOADER (same as relatorios) =====
            const loadLogo = (): Promise<{ data: string; width: number; height: number } | null> => {
                return new Promise((resolve) => {
                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    logoImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(logoImg, 0, 0);
                        resolve({ data: canvas.toDataURL('image/png'), width: logoImg.width, height: logoImg.height });
                    };
                    logoImg.onerror = () => resolve(null);
                    logoImg.src = '/logo.png';
                });
            };

            const logoResult = await loadLogo();
            const logoData = logoResult?.data || null;

            // ===== DRAW PREMIUM HEADER (same as relatorios) =====
            const drawHeader = (pageDoc: typeof doc, pageNum: number) => {
                const headerHeight = 38;

                pageDoc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
                pageDoc.rect(0, 0, pageWidth, headerHeight, 'F');

                pageDoc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                pageDoc.rect(0, headerHeight, pageWidth, 1.5, 'F');
                pageDoc.setFillColor(colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
                pageDoc.rect(pageWidth * 0.4, headerHeight, pageWidth * 0.6, 1.5, 'F');

                // Logo with correct aspect ratio
                if (logoData) {
                    try {
                        const logoH = 19.5;
                        let logoW = 19.5;
                        if (logoResult) {
                            const aspect = logoResult.width / logoResult.height;
                            logoW = logoH * aspect;
                        }
                        pageDoc.addImage(logoData, 'PNG', margin.left, 6, logoW, logoH);
                    } catch { /* ignore logo errors */ }
                }

                // Report title - right-aligned
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(255, 255, 255);
                pageDoc.text(`Tabela de Preços — ${fabrica.nome}`, pageWidth - margin.right, 14, { align: 'right' });

                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
                const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                pageDoc.text(`Emitido em ${dateStr}`, pageWidth - margin.right, 20, { align: 'right' });

                if (pageNum > 1) {
                    pageDoc.setFontSize(7);
                    pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                    pageDoc.text('(Continuação)', pageWidth - margin.right, 25, { align: 'right' });
                }

                return headerHeight + 5;
            };

            // ===== DRAW FOOTER (same as relatorios) =====
            const drawFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
                const footerY = pageHeight - 12;
                pageDoc.setDrawColor(colors.tableBorder[0], colors.tableBorder[1], colors.tableBorder[2]);
                pageDoc.setLineWidth(0.3);
                pageDoc.line(margin.left, footerY - 3, pageWidth - margin.right, footerY - 3);
                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
                pageDoc.text('FRPlus — Gestão Comercial Inteligente', margin.left, footerY);
                pageDoc.text('Documento confidencial • Preços sujeitos a alteração sem aviso prévio', pageWidth / 2, footerY, { align: 'center' });
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text(`${pageNum} / ${totalPages}`, pageWidth - margin.right, footerY, { align: 'right' });
            };

            // ===== BUILD PDF =====
            let startY = drawHeader(doc, 1);

            // ===== COMUNICADO BOX (Conditional) =====
            if (comunicado.trim()) {
                startY += 2;
                doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
                doc.setDrawColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);

                doc.setFontSize(9);
                const commLines = doc.splitTextToSize(comunicado.trim(), contentWidth - 20);
                const commBoxHeight = Math.max(16, (commLines.length * 4.5) + 12);

                doc.roundedRect(margin.left, startY, contentWidth, commBoxHeight, 2, 2, 'FD');

                // Blue accent bar on left
                doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.rect(margin.left, startY, 3, commBoxHeight, 'F');

                // Title
                doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('COMUNICADO', margin.left + 7, startY + 5);

                // Message
                doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(commLines, margin.left + 7, startY + 10.5);

                startY += commBoxHeight + 4;
            }

            // ===== DESTINATÁRIO =====
            startY += 1;
            const clienteNome = formData.nomeFantasia || formData.razaoSocial || 'Cliente';

            doc.setFillColor(colors.factoryBg[0], colors.factoryBg[1], colors.factoryBg[2]);
            doc.roundedRect(margin.left, startY, contentWidth, 14, 1.5, 1.5, 'F');

            doc.setFontSize(7);
            doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('PREPARADO EXCLUSIVAMENTE PARA', margin.left + 5, startY + 5);

            doc.setFontSize(11);
            doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(clienteNome, margin.left + 5, startY + 11);

            // Tabela badge on the right
            doc.setFillColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
            const badgeText = `Tabela: ${tabelaConfig.label}`;
            doc.setFontSize(7);
            const badgeWidth = doc.getTextWidth(badgeText) + 8;
            doc.roundedRect(pageWidth - margin.right - badgeWidth - 2, startY + 3, badgeWidth + 1, 8, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(badgeText, pageWidth - margin.right - badgeWidth + 2, startY + 8.5);

            startY += 18;

            // ===== TABELA DE PRODUTOS =====
            const priceField = tabelaConfig.field as string;

            const tableData = produtos.map((p: any) => [
                p.codigo,
                p.nome,
                p.categoria || 'Geral',
                `R$ ${Number(p[priceField]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY,
                head: [['CÓDIGO', 'PRODUTO', 'CATEGORIA', 'PREÇO UNIT.']],
                body: tableData,
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    halign: 'center',
                    valign: 'middle',
                    lineColor: colors.tableBorder,
                    lineWidth: 0.2,
                    textColor: colors.textDark,
                },
                headStyles: {
                    fillColor: colors.headerDark,
                    textColor: 255,
                    fontStyle: 'bold',
                    cellPadding: 4,
                },
                alternateRowStyles: { fillColor: colors.rowEven },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center', fontStyle: 'bold', textColor: colors.textMuted },
                    1: { halign: 'left' },
                    2: { cellWidth: 30, halign: 'center', fontSize: 7, textColor: colors.textMuted },
                    3: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: colors.factoryAccent },
                },
                foot: [['', `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`, fabrica.nome, tabelaConfig.label]],
                footStyles: {
                    fillColor: colors.headerDark,
                    textColor: colors.white,
                    fontStyle: 'bold',
                    halign: 'right',
                    cellPadding: 4,
                },
                margin: { left: margin.left, right: margin.right },
                didDrawPage: (data: { pageNumber: number }) => {
                    if (data.pageNumber > 1) drawHeader(doc, data.pageNumber);
                }
            });

            // ===== APPLY FOOTERS TO ALL PAGES =====
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(doc, i, pageCount);
            }

            // 3. Download
            const nomeArquivo = `Tabela_${fabrica.nome.replace(/\s+/g, '_')}_${clienteNome.replace(/\s+/g, '_')}.pdf`;
            doc.save(nomeArquivo);

            showToast(`PDF "${nomeArquivo}" gerado com sucesso!`, "success");

            // 4. Register in background (fire-and-forget + optimistic update)
            const agora = new Date();
            setHistorico(prev => {
                const filtered = prev.filter(h => h.representadaId !== selectedFabricaId);
                return [...filtered, {
                    representadaId: selectedFabricaId,
                    representadaNome: fabrica.nome,
                    dataGeracao: agora
                }];
            });

            registrarEnvioTabela(params.id, selectedFabricaId).catch(err => {
                console.error('Erro ao registrar envio:', err);
            });

            // Close modal
            setShowModalPDF(false);
            setSelectedFabricaId('');
            setComunicado('');

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showToast("Erro ao gerar o PDF. Tente novamente.", "error");
        } finally {
            setLoadingPDF(false);
        }
    };

    // Format date for badges
    const formatDate = (d: Date | string) => {
        const date = new Date(d);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/clientes" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Editar Cliente</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowModalVisita(true)}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600/20 px-4 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                    >
                        <CalendarPlus className="h-4 w-4" /> Agendar Visita
                    </button>
                    <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                        <Save className="h-4 w-4" /> Salvar
                    </button>
                </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Dados da Empresa */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Dados da Empresa</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div>
                            <label className="label-compact">CNPJ *</label>
                            <div className="flex gap-1">
                                <input name="cnpj" value={formData.cnpj || ''} onChange={handleChange} className="input-compact flex-1" />
                                <button
                                    type="button"
                                    onClick={buscarCnpj}
                                    disabled={loadingCnpj}
                                    className="px-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50"
                                    title="Buscar dados pelo CNPJ"
                                >
                                    {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="label-compact">Inscrição Estadual</label>
                            <input name="inscricaoEstadual" value={formData.inscricaoEstadual || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Razão Social *</label>
                            <input name="razaoSocial" value={formData.razaoSocial || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Nome Fantasia</label>
                            <input name="nomeFantasia" value={formData.nomeFantasia || ''} onChange={handleChange} className="input-compact" />
                        </div>
                    </div>
                </div>

                {/* Contato */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <User className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-white">Contato</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="label-compact">Nome do Comprador</label>
                            <input name="comprador" value={formData.comprador || ''} onChange={handleChange} placeholder="Nome do responsável" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Email</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="contato@empresa.com" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Telefone Fixo</label>
                            <input name="telefone" value={formData.telefone || ''} onChange={handleChange} placeholder="(00) 0000-0000" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Celular / WhatsApp</label>
                            <input name="celular" value={formData.celular || ''} onChange={handleChange} placeholder="(00) 90000-0000" className="input-compact" />
                        </div>
                    </div>
                </div>

                {/* Endereço */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <MapPin className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-white">Localização</span>
                    </div>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                        <div>
                            <label className="label-compact">CEP</label>
                            <div className="flex gap-1">
                                <input name="cep" value={formData.cep || ''} onChange={handleChange} className="input-compact flex-1" />
                                <button
                                    type="button"
                                    onClick={buscarCep}
                                    disabled={loadingCep}
                                    className="px-2 rounded-lg bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 disabled:opacity-50"
                                    title="Buscar endereço pelo CEP"
                                >
                                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                            <label className="label-compact">Endereço</label>
                            <input name="endereco" value={formData.endereco || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Número</label>
                            <input name="numero" value={formData.numero || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Bairro</label>
                            <input name="bairro" value={formData.bairro || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Cidade</label>
                            <input name="cidade" value={formData.cidade || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">UF</label>
                            <select name="uf" value={formData.uf || ''} onChange={handleChange} className="input-compact">
                                <option value="">-</option>
                                <option>AC</option><option>AL</option><option>AP</option><option>AM</option>
                                <option>BA</option><option>CE</option><option>DF</option><option>ES</option>
                                <option>GO</option><option>MA</option><option>MT</option><option>MS</option>
                                <option>MG</option><option>PA</option><option>PB</option><option>PR</option>
                                <option>PE</option><option>PI</option><option>RJ</option><option>RN</option>
                                <option>RS</option><option>RO</option><option>RR</option><option>SC</option>
                                <option>SP</option><option>SE</option><option>TO</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Comercial */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Perfil Comercial</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div>
                            <label className="label-compact">Tabela de Preço</label>
                            <select name="tabelaPreco" value={formData.tabelaPreco || ''} onChange={handleChange} className="input-compact">
                                <option value="">Selecione...</option>
                                <option value="50a199">50 a 199 CX</option>
                                <option value="200a699">200 a 699 CX</option>
                                <option value="atacado">Atacado</option>
                                <option value="atacadoAVista">Atacado à Vista</option>
                                <option value="redes">Redes</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-compact">Limite de Crédito (R$)</label>
                            <input name="limiteCredito" type="number" value={formData.limiteCredito || 0} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Status</label>
                            <select name="status" value={formData.status || 'Ativo'} onChange={handleChange} className="input-compact">
                                <option>Ativo</option><option>Inativo</option><option>Bloqueado</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-compact">Observações</label>
                            <input name="observacoes" value={formData.observacoes || ''} onChange={handleChange} className="input-compact" />
                        </div>
                    </div>
                </div>
            </form>

            {/* ===== SEÇÃO: TABELA DE PREÇOS / ÚLTIMOS ENVIOS ===== */}
            <div className="form-card">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm font-medium text-white">Tabela de Preços — Últimos Envios</span>
                    </div>
                    <button
                        onClick={() => setShowModalPDF(true)}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/30"
                    >
                        <Download className="h-4 w-4" /> Gerar Tabela PDF
                    </button>
                </div>

                {/* Badges de histórico */}
                {loadingHistorico ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {fabricas.map(fab => {
                            const entry = historico.find(h => h.representadaId === fab.id);
                            const hasEntry = !!entry;

                            return (
                                <div
                                    key={fab.id}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                                        transition-all duration-200
                                        ${hasEntry
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-white/5 text-gray-500 border border-white/5'
                                        }
                                    `}
                                >
                                    <Factory className="h-3 w-3" />
                                    <span className={hasEntry ? 'text-emerald-300' : 'text-gray-400'}>
                                        {fab.nome}:
                                    </span>
                                    <span>
                                        {hasEntry
                                            ? formatDate(entry.dataGeracao)
                                            : 'Nunca enviado'
                                        }
                                    </span>
                                    {hasEntry && <Clock className="h-3 w-3 ml-0.5 opacity-50" />}
                                </div>
                            );
                        })}

                        {fabricas.length === 0 && (
                            <span className="text-gray-500 text-xs">Nenhuma representada cadastrada</span>
                        )}
                    </div>
                )}
            </div>

            {/* ===== MODAL AGENDAR VISITA ===== */}
            {showModalVisita && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModalVisita(false)} />
                    
                    <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleAgendarVisita}>
                            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/15">
                                        <CalendarPlus className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Agendar Visita</h3>
                                        <p className="text-xs text-gray-400">Marque um horário com este cliente</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowModalVisita(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-300">Data *</label>
                                        <input
                                            type="date"
                                            required
                                            value={dataVisita}
                                            onChange={(e) => setDataVisita(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-300">Horário *</label>
                                        <input
                                            type="time"
                                            required
                                            value={horaVisita}
                                            onChange={(e) => setHoraVisita(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-300">Observações / Pauta</label>
                                    <textarea
                                        rows={3}
                                        value={obsVisita}
                                        onChange={(e) => setObsVisita(e.target.value)}
                                        placeholder="O que será discutido?"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => setShowModalVisita(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingVisita}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {loadingVisita ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== MODAL GERAR TABELA DE PREÇO PDF ===== */}
            {showModalPDF && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loadingPDF && setShowModalPDF(false)} />
                    
                    <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                                    <FileText className="h-5 w-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Gerar Tabela de Preço</h3>
                                    <p className="text-xs text-gray-400">
                                        {formData.nomeFantasia || formData.razaoSocial || 'Cliente'} — {TABELA_PRECO_MAP[formData.tabelaPreco || '50a199']?.label || '50 a 199 CX'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !loadingPDF && setShowModalPDF(false)}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Select Representada */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-300">Representada *</label>
                                <select
                                    value={selectedFabricaId}
                                    onChange={(e) => setSelectedFabricaId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                >
                                    <option value="">Selecione a representada...</option>
                                    {fabricas.map(f => (
                                        <option key={f.id} value={f.id} className="bg-[#0f1729] text-white">{f.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Last send info */}
                            {selectedFabricaId && (() => {
                                const entry = historico.find(h => h.representadaId === selectedFabricaId);
                                return (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${entry ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        <Clock className="h-3.5 w-3.5" />
                                        {entry
                                            ? `Último envio: ${formatDate(entry.dataGeracao)}`
                                            : 'Nenhuma tabela enviada para esta representada'
                                        }
                                    </div>
                                );
                            })()}

                            {/* Comunicado */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-300">Comunicado / Motivo <span className="text-gray-500">(Opcional)</span></label>
                                <textarea
                                    rows={3}
                                    value={comunicado}
                                    onChange={(e) => setComunicado(e.target.value)}
                                    placeholder="Ex: Novos preços válidos a partir de abril/2026..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none placeholder:text-gray-600"
                                />
                                {comunicado.trim() && (
                                    <p className="text-[10px] text-cyan-400/60 flex items-center gap-1">
                                        ✦ O comunicado aparecerá em destaque no topo do PDF
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => !loadingPDF && setShowModalPDF(false)}
                                disabled={loadingPDF}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGerarPDF}
                                disabled={loadingPDF || !selectedFabricaId}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/30"
                            >
                                {loadingPDF ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Gerando PDF...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4" />
                                        Gerar e Baixar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
