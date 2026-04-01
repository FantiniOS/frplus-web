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
    const [selectedTabelaPreco, setSelectedTabelaPreco] = useState('');
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

    const getClientPrice = (product: any) => {
        let priceStr = product.preco50a199;
        const tabela = selectedTabelaPreco || '50a199';
        
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

    const convertImageToBase64 = async (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    reject(new Error('Canvas context null'));
                }
            };
            img.onerror = (e) => reject(e);
            img.src = url.startsWith('http') ? url : `/${url.replace(/^\//, '')}`;
        });
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            const client = activeClients.find((c: any) => c.id === selectedClientId);
            const fabrica = fabricas.find((f: any) => f.id === selectedFabricaId);
            const selectedIds = Object.keys(selectedProducts);
            
            if (!client || !fabrica || selectedIds.length === 0 || !selectedTabelaPreco) {
                alert('Preencha os campos obrigatórios, escolha a tabela de preços e selecione ao menos um produto.');
                setIsGenerating(false);
                return;
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yCursor = 0;
            
            const addPageHeader = async (isFirstPage: boolean) => {
                doc.setFillColor(15, 23, 42); // slate-900 background
                doc.rect(0, 0, pageWidth, 45, 'F');
                
                // Add Logo
                try {
                    const b64Logo = await convertImageToBase64('/logo.png');
                    const img = new Image();
                    img.src = b64Logo;
                    await new Promise(resolve => {
                        img.onload = () => {
                            const targetWidth = 45;
                            const ratio = img.height / img.width;
                            const targetHeight = targetWidth * ratio;
                            doc.addImage(b64Logo, 'PNG', 15, 12, targetWidth, targetHeight);
                            resolve(true);
                        }
                    });
                } catch (e) {
                    console.error("Erro ao carregar logo:", e);
                }

                // Header Texts
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(14);
                const title = "PROJETO EXCLUSIVO DE EXPANSÃO DE MIX";
                doc.text(title, pageWidth - 15, 22, { align: 'right' });
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(156, 163, 175);
                const subtitle = `Parceria Comercial: ${fabrica.nome}`;
                doc.text(subtitle, pageWidth - 15, 28, { align: 'right' });
                
                yCursor = 60;

                if (isFirstPage) {
                    // Client Info
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    const razao = client.nomeFantasia || client.razaoSocial;
                    doc.text(`A/C: ${acName || 'Responsável por Compras'}`, 15, yCursor);
                    yCursor += 7;
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(70, 70, 70);
                    
                    const splitRazao = doc.splitTextToSize(razao, pageWidth - 30);
                    doc.text(splitRazao, 15, yCursor);
                    yCursor += (splitRazao.length * 6) + 12;

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
            
            // Draw each product block
            for (const prod of selectedItems) {
                // Check if we need a new page
                if (yCursor > pageHeight - 75) {
                    doc.addPage();
                    await addPageHeader(false);
                }

                const priceCx = getClientPrice(prod);
                const mult = selectedProducts[prod.id] || 1;
                const priceUn = priceCx / mult;

                const netPriceCx = priceCx * (1 - totalDiscountPercent / 100);
                const netPriceUn = priceUn * (1 - totalDiscountPercent / 100);

                // Fetch Image
                let imgData: string | null = null;
                const url = prod.imagem || prod.imagemUrl;
                if (url) {
                    try {
                        imgData = await convertImageToBase64(url);
                    } catch (e) {
                        console.error('Failed to load image for', prod.id, e);
                    }
                }

                // Render Image or Placeholder
                if (imgData) {
                    const type = imgData.includes('image/png') ? 'PNG' : 'JPEG';
                    try {
                        doc.addImage(imgData, type, 15, yCursor, 30, 30);
                    } catch (err) {
                        doc.setFillColor(240, 240, 240);
                        doc.rect(15, yCursor, 30, 30, 'F');
                    }
                } else {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(15, yCursor, 30, 30, 'F');
                }

                // Product Title
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 40);
                
                let pName = prod.nome;
                if (pName.length > 55) pName = pName.substring(0, 52) + '...';
                doc.text(pName, 50, yCursor + 8);
                
                // Embalagem e Preço Tabela
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 80, 80);
                doc.text(`CÓD: ${prod.codigo}  |  EMBALAGEM: Cx c/ ${mult} un`, 50, yCursor + 13);
                doc.text(`Preço Original Cx: R$ ${priceCx.toFixed(2).replace('.', ',')}  |  Unidade: R$ ${priceUn.toFixed(2).replace('.', ',')}`, 50, yCursor + 18);

                // Financial Box (Plano de Venda)
                const finY = yCursor + 35;
                const finW = pageWidth - 30; // ocupa a largura restante
                const finH = 22;

                doc.setDrawColor(230, 230, 230);
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(15, finY, finW, finH, 1, 1, 'FD');

                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 60);
                doc.text("PLANO DE VENDA E DESCONTOS", 19, finY + 6);
                
                let dfY = finY + 11;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                
                if (discount1Value > 0) {
                    doc.text(`- ${discount1Name}: ${discount1Value}%`, 19, dfY);
                    dfY += 4;
                }
                if (discount2Value > 0) {
                    doc.text(`- ${discount2Name}: ${discount2Value}%`, 19, dfY);
                    dfY += 4;
                }
                if (discount1Value === 0 && discount2Value === 0) {
                     doc.text(`Sem Descontos Extras`, 19, dfY);
                     dfY += 4;
                }

                // Final Net Prices
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(0, 120, 50); // green
                doc.text(`Preço caixa líquido: R$ ${netPriceCx.toFixed(2).replace('.', ',')}  |  Preço un líquido: R$ ${netPriceUn.toFixed(2).replace('.', ',')}`, 75, finY + 14);

                yCursor += 65; // Move to next product
            }

            // Footer / Disclaimer
            if (yCursor > pageHeight - 30) {
                doc.addPage();
                await addPageHeader(false);
            }

            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(130, 130, 130);
            const tabelaDisplay = { 
                '50a199': '50 a 199', 
                '200a699': '200 a 699', 
                'atacado': 'Atacado', 
                'avista': 'À Vista', 
                'redes': 'Redes' }[selectedTabelaPreco] || selectedTabelaPreco;
            doc.text(`* Cotação elaborada via tabela Base: ${tabelaDisplay}. Sujeito à análise de crédito e estoque dinâmico.`, 15, yCursor + 15);
            
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
                        <div>
                            <label className="block text-xs font-medium text-blue-400 mb-1">Tabela de Preço Base *</label>
                            <select 
                                value={selectedTabelaPreco} 
                                onChange={(e) => setSelectedTabelaPreco(e.target.value)}
                                className="w-full bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                            >
                                <option value="" className="text-black">Selecione a Tabela...</option>
                                <option value="50a199" className="text-black">50 a 199</option>
                                <option value="200a699" className="text-black">200 a 699</option>
                                <option value="atacado" className="text-black">Atacado</option>
                                <option value="avista" className="text-black">À Vista</option>
                                <option value="redes" className="text-black">Redes</option>
                            </select>
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
                    disabled={isGenerating || !selectedClientId || !selectedFabricaId || !selectedTabelaPreco || Object.keys(selectedProducts).length === 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-5 h-5" />
                    {isGenerating ? 'Gerando Extrato PDF...' : 'Gerar Proposta Comercial (Atacado)'}
                </button>
            </div>
        </div>
    );
}
