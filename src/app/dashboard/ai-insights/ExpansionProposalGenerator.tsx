'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Target, Download, CheckCircle2, Search, Factory, Box, Percent, Calculator } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ExpansionProposalGenerator() {
    const { clients, fabricas, products } = useData();

    const activeClients = useMemo(() => clients.filter((c: any) => c.status === 'Ativo' || c.status?.toLowerCase() === 'ativo'), [clients]);

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Form states
    const [acName, setAcName] = useState('');
    const [message, setMessage] = useState('Agradecemos a recepção e a oportunidade de apresentar nosso portfólio.\n\nCom mais de três décadas de atuação, a Fantini Representações possui um sistema de negócios robusto. Identificamos uma oportunidade de alto giro e propomos a linha de produtos abaixo como âncora de rentabilidade para sua operação no atacado.');
    
    // Discounts
    const [discount1Name, setDiscount1Name] = useState('Verba / Bônus Financeiro');
    const [discount1Value, setDiscount1Value] = useState<number>(5);
    const [discount2Name, setDiscount2Name] = useState('Ação Fidelidade Base');
    const [discount2Value, setDiscount2Value] = useState<number>(0);

    // Selected products mapping: productId -> quantity/multiple
    const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});

    const totalDiscountPercent = (discount1Value || 0) + (discount2Value || 0);

    // Filtering logic for the product multiselect
    const availableProducts = useMemo(() => {
        if (!selectedFabricaId) return [];
        return products.filter((p: any) => 
            p.fabricaId === selectedFabricaId && 
            p.ativo !== false && 
            (
                (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [products, selectedFabricaId, searchTerm]);

    // Regex to guess multiple
    const guessMultiple = (name: string): number => {
        if (!name) return 1;
        const match = name.match(/[cC]\/\s*(\d+)/) || name.match(/com\s*(\d+)/i) || name.match(/cx\s*(\d+)/i) || name.match(/x\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    };

    const handleToggleProduct = (product: any) => {
        setSelectedProducts(prev => {
            const current = { ...prev };
            if (current[product.id]) {
                delete current[product.id];
            } else {
                current[product.id] = guessMultiple(product.nome);
            }
            return current;
        });
    };

    const handleUpdateMultiple = (productId: string, val: number) => {
        setSelectedProducts(prev => ({ ...prev, [productId]: Math.max(1, val) }));
    };

    const getClientPrice = (client: any, product: any) => {
        let priceStr = product.preco50a199;
        const tabela = client.tabelaPreco || '50a199';
        
        switch (tabela) {
            case '200a699': priceStr = product.preco200a699; break;
            case 'atacado': priceStr = product.precoAtacado; break;
            case 'avista': priceStr = product.precoAtacadoAVista; break;
            case 'redes': priceStr = product.precoRedes; break;
            case '50a199': default: priceStr = product.preco50a199; break;
        }

        const priceNum = Number(priceStr);
        return isNaN(priceNum) ? 0 : priceNum;
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            const client = activeClients.find((c: any) => c.id === selectedClientId);
            const fabrica = fabricas.find((f: any) => f.id === selectedFabricaId);
            const selectedIds = Object.keys(selectedProducts);
            
            if (!client || !fabrica || selectedIds.length === 0) {
                alert('Preencha os campos obrigatórios e selecione ao menos um produto.');
                setIsGenerating(false);
                return;
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yCursor = 0;
            
            const addPageHeader = async (isFirstPage: boolean) => {
                doc.setFillColor(15, 23, 42); // slate-900 background
                doc.rect(0, 0, pageWidth, 40, 'F');
                
                // Add Logo
                try {
                    const imgResult = await fetch('/logo.png');
                    if (imgResult.ok) {
                        const blob = await imgResult.blob();
                        await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result as string;
                                const img = new Image();
                                img.src = base64data;
                                img.onload = () => {
                                    const targetWidth = 45;
                                    const ratio = img.height / img.width;
                                    const targetHeight = targetWidth * ratio;
                                    doc.addImage(base64data, 'PNG', 15, 8, targetWidth, targetHeight);
                                    resolve(true);
                                };
                            }
                            reader.readAsDataURL(blob);
                        });
                    }
                } catch (e) {
                    console.error("Erro ao carregar logo:", e);
                }

                // Header Texts
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(14);
                const title = "PROPOSTA COMERCIAL";
                const titleWidth = doc.getTextWidth(title);
                doc.text(title, pageWidth - titleWidth - 15, 18);
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(156, 163, 175);
                const subtitle = `Parceria Comercial: ${fabrica.nome}`;
                const subWidth = doc.getTextWidth(subtitle);
                doc.text(subtitle, pageWidth - subWidth - 15, 24);
                
                yCursor = 55;

                if (isFirstPage) {
                    // Client Info
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    const razao = client.nomeFantasia || client.razaoSocial;
                    doc.text(`A/C: ${acName || 'Responsável por Compras'}`, 15, yCursor);
                    yCursor += 6;
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(70, 70, 70);
                    doc.text(`${razao}`, 15, yCursor);
                    yCursor += 15;

                    // Message Argument
                    doc.setFontSize(11);
                    doc.setFont('times', 'normal');
                    doc.setTextColor(30, 30, 30);
                    
                    const splitMessage = doc.splitTextToSize(message, pageWidth - 30);
                    doc.text(splitMessage, 15, yCursor);
                    yCursor += (splitMessage.length * 5) + 15;

                    // Section Title
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    const sectionTitle = "SISTEMA DE NEGÓCIOS";
                    const sTitleWidth = doc.getTextWidth(sectionTitle);
                    doc.text(sectionTitle, (pageWidth / 2) - (sTitleWidth / 2), yCursor);
                    
                    // Add a tiny line under subtitle
                    doc.setDrawColor(200, 200, 200);
                    doc.line((pageWidth / 2) - 20, yCursor + 2, (pageWidth / 2) + 20, yCursor + 2);

                    yCursor += 10;
                }
            };

            await addPageHeader(true);

            const selectedItems = products.filter((p: any) => selectedIds.includes(p.id));
            
            // Pre-load images
            const base64Images: Record<string, string> = {};
            for (const prod of selectedItems) {
                const url = prod.imagem || prod.imagemUrl;
                if (url) {
                    try {
                        const res = await fetch(url.startsWith('http') ? url : `/${url.replace(/^\//, '')}`);
                        if (res.ok) {
                            const blob = await res.blob();
                            const b64 = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                            base64Images[prod.id] = b64;
                        }
                    } catch (e) {
                        console.error('Failed to load image for', prod.id, e);
                    }
                }
            }

            // Draw each product block
            for (const prod of selectedItems) {
                // Check if we need a new page (Card height approx 45mm + margin)
                if (yCursor > pageHeight - 55) {
                    doc.addPage();
                    await addPageHeader(false);
                }

                const priceCx = getClientPrice(client, prod);
                const mult = selectedProducts[prod.id] || 1;
                const priceUn = priceCx / mult;

                const netPriceCx = priceCx * (1 - totalDiscountPercent / 100);
                const netPriceUn = priceUn * (1 - totalDiscountPercent / 100);

                const cardX = 15;
                const cardW = pageWidth - 30;
                const cardH = 42;

                // Card Border
                doc.setDrawColor(220, 220, 230);
                doc.setFillColor(252, 252, 254);
                doc.roundedRect(cardX, yCursor, cardW, cardH, 2, 2, 'FD');

                // Image
                const b64 = base64Images[prod.id];
                if (b64) {
                    const type = b64.includes('image/png') ? 'PNG' : 'JPEG';
                    try {
                        doc.addImage(b64, type, cardX + 5, yCursor + 6, 28, 28);
                    } catch (err) {}
                } else {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(cardX + 5, yCursor + 6, 28, 28, 'F');
                }

                // Product details
                let currentTX = cardX + 38;
                let currentTY = yCursor + 10;
                
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 40);
                
                // Truncate name if too long
                let pName = prod.nome;
                if (pName.length > 55) pName = pName.substring(0, 52) + '...';
                doc.text(pName, currentTX, currentTY);
                
                currentTY += 5;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 110);
                doc.text(`CÓD: ${prod.codigo}  |  EMBALAGEM: Cx c/ ${mult} un`, currentTX, currentTY);
                
                currentTY += 8;
                // Base prices
                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                doc.text(`Preço Tabela (Cx): R$ ${priceCx.toFixed(2).replace('.', ',')}`, currentTX, currentTY);
                
                currentTY += 5;
                doc.text(`Preço Tabela (Un): R$ ${priceUn.toFixed(2).replace('.', ',')}`, currentTX, currentTY);

                // Financial Box (Plano de Venda)
                const finX = cardX + 105;
                const finY = yCursor + 6;
                const finW = cardW - 110;
                const finH = 30;

                doc.setDrawColor(230, 230, 230);
                doc.setFillColor(248, 250, 252); // slate-50
                doc.roundedRect(finX, finY, finW, finH, 1, 1, 'FD');

                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 60);
                doc.text("PLANO DE VENDA E DESCONTOS", finX + 4, finY + 6);
                
                let dfY = finY + 11;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                
                if (discount1Value > 0) {
                    doc.text(`- ${discount1Name}: ${discount1Value}%`, finX + 4, dfY);
                    dfY += 4;
                }
                if (discount2Value > 0) {
                    doc.text(`- ${discount2Name}: ${discount2Value}%`, finX + 4, dfY);
                    dfY += 4;
                }
                if (discount1Value === 0 && discount2Value === 0) {
                     doc.text(`(Tabela Cheia / Sem Descontos extras)`, finX + 4, dfY);
                     dfY += 4;
                }

                // Final Net Prices
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(0, 120, 50); // green
                
                // Align left inside the fin box below
                doc.text(`Líquido Cx: R$ ${netPriceCx.toFixed(2).replace('.', ',')}`, finX + 4, finY + 23);
                doc.text(`Líquido Un: R$ ${netPriceUn.toFixed(2).replace('.', ',')}`, finX + 4, finY + 28);


                yCursor += cardH + 4; // Move to next product
            }

            // Footer / Disclaimer
            if (yCursor > pageHeight - 30) {
                doc.addPage();
                await addPageHeader(false);
            }

            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(130, 130, 130);
            doc.text(`* Cotação elaborada via tabela Base: ${client.tabelaPreco || 'Padrão'}. Sujeito à análise de crédito e estoque dinâmico.`, 15, yCursor + 15);
            
            // Save PDF
            const clientNameClean = (client.nomeFantasia || client.razaoSocial).replace(/[^a-zA-Z0-9]/g, '_');
            const fabricaNameClean = fabrica.nome.replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Proposta_Atacado_${fabricaNameClean}_${clientNameClean}.pdf`);
            
        } catch (error) {
            console.error('Erro ao gerar PDF', error);
            alert('Falha ao gerar o PDF. Verifique o console.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header section */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex flex-col md:flex-row justify-between gap-4 md:items-center">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calculator className="w-6 h-6 text-blue-400" />
                        Gerador de Propostas (Business / Atacado)
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Construa a engenharia de preço bloco-a-bloco com imagem e cálculo de descontos líquidos na unidade.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Left Side - Master config */}
                <div className="space-y-5">
                    {/* Panel 1: Client & Recipient */}
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">1. Destinatário</h4>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Cliente Ativo</label>
                            <select 
                                value={selectedClientId} 
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                            >
                                <option value="" className="text-black">Selecione o Cliente...</option>
                                {activeClients.map((c: any) => (
                                    <option key={c.id} value={c.id} className="text-black">
                                        {c.nomeFantasia || c.razaoSocial}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">A/C (Aos Cuidados de)</label>
                            <input
                                type="text"
                                value={acName}
                                onChange={(e) => setAcName(e.target.value)}
                                placeholder="Nome do Comprador"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Panel 2: Brand & Pitch */}
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">2. Oferta & Copy</h4>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Representada (Marca)</label>
                            <select 
                                value={selectedFabricaId} 
                                onChange={(e) => {
                                    setSelectedFabricaId(e.target.value);
                                    setSelectedProducts({}); 
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                            >
                                <option value="" className="text-black">Selecione a Marca...</option>
                                {fabricas.map((f: any) => (
                                    <option key={f.id} value={f.id} className="text-black">
                                        {f.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Texto de Apresentação Institucional</label>
                            <textarea
                                rows={6}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-black/20 text-gray-300 text-xs p-3 rounded-lg border border-white/5 resize-y focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Panel 3: Financial Discounts */}
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="text-sm font-semibold text-white uppercase tracking-wider">3. Engenharia de Descontos</h4>
                             <Percent className="w-4 h-4 text-green-400" />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                             <div className="col-span-2">
                                <label className="block text-[10px] text-gray-500 mb-1">Nome Desconto 1</label>
                                <input type="text" value={discount1Name} onChange={e=>setDiscount1Name(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-white" />
                             </div>
                             <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Valor (%)</label>
                                <input type="number" min="0" max="100" value={discount1Value} onChange={e=>setDiscount1Value(Number(e.target.value))} className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-blue-400 font-bold" />
                             </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                             <div className="col-span-2">
                                <label className="block text-[10px] text-gray-500 mb-1">Nome Desconto 2</label>
                                <input type="text" value={discount2Name} onChange={e=>setDiscount2Name(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-white" />
                             </div>
                             <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Valor (%)</label>
                                <input type="number" min="0" max="100" value={discount2Value} onChange={e=>setDiscount2Value(Number(e.target.value))} className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-blue-400 font-bold" />
                             </div>
                        </div>

                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-300">Desconto Somado Total:</span>
                            <span className="text-lg font-bold text-green-400">{totalDiscountPercent}%</span>
                        </div>
                    </div>
                </div>

                {/* Form Right Side - Products & Multiplicators */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex flex-col h-full min-h-[600px]">
                    <div className="flex justify-between items-end mb-4">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                            4. Produtos e Múltiplos
                        </h4>
                        <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                            {Object.keys(selectedProducts).length} selecionados
                        </span>
                    </div>

                    {!selectedFabricaId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3 min-h-[250px] border border-dashed border-white/10 rounded-lg">
                            <Factory className="w-8 h-8 opacity-50" />
                            <p className="text-sm">Selecione uma Representada (Marca) na Etapa 2</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto ativo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[500px] scrollbar-thin scrollbar-thumb-white/10">
                                {availableProducts.length === 0 ? (
                                    <div className="text-center text-gray-500 py-10 text-sm">Nenhum produto encontrado.</div>
                                ) : (
                                    availableProducts.map((p: any) => {
                                        const isSelected = !!selectedProducts[p.id];
                                        const multiple = selectedProducts[p.id] || guessMultiple(p.nome);
                                        
                                        return (
                                            <div 
                                                key={p.id} 
                                                className={`flex flex-col p-3 rounded-lg border transition-all ${
                                                    isSelected ? 'bg-blue-600/10 border-blue-500/50' : 'bg-black/20 border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div 
                                                    className="flex items-start gap-3 cursor-pointer"
                                                    onClick={() => handleToggleProduct(p)}
                                                >
                                                    <div className={`mt-0.5 min-w-4 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500 bg-transparent'
                                                    }`}>
                                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                    <div className="flex-1 leading-tight">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-1 py-0.5 rounded">Cód: {p.codigo}</span>
                                                        </div>
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{p.nome}</span>
                                                    </div>
                                                </div>

                                                {/* Multiple Input when selected */}
                                                {isSelected && (
                                                    <div className="mt-3 pl-7 pt-2 border-t border-blue-500/20 flex items-center gap-3">
                                                        <label className="text-[10px] uppercase text-blue-300 font-semibold tracking-wider">Itens por Caixa (Giro):</label>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            value={multiple}
                                                            onChange={(e) => handleUpdateMultiple(p.id, parseInt(e.target.value) || 1)}
                                                            className="w-16 bg-black/50 border border-blue-500/30 rounded text-center text-xs py-1 text-white font-bold max-h-6"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pt-4 border-t border-white/10">
                <button
                    onClick={generatePDF}
                    disabled={isGenerating || !selectedClientId || !selectedFabricaId || Object.keys(selectedProducts).length === 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-5 h-5" />
                    {isGenerating ? 'Gerando Extrato PDF...' : 'Gerar Proposta Comercial (Atacado)'}
                </button>
            </div>
        </div>
    );
}
