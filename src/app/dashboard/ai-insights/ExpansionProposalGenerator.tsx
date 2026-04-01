'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Target, Download, CheckCircle2, Search, Factory, Box } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ExpansionProposalGenerator() {
    const { clients, fabricas, products } = useData();

    const activeClients = useMemo(() => clients.filter((c: any) => c.status === 'Ativo' || c.status?.toLowerCase() === 'ativo'), [clients]);

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedFabricaId, setSelectedFabricaId] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('Analisando o volume da sua distribuição e nossa parceria consolidada, identifiquei uma oportunidade de margem na linha [Marca]. Separei exclusivamente as referências de maior liquidez e giro rápido para você rentabilizar a sua operação no atacado.');
    const [isGenerating, setIsGenerating] = useState(false);

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

    const handleToggleProduct = (productId: string) => {
        setSelectedProducts(prev => 
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
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
            
            if (!client || !fabrica || selectedProducts.length === 0) {
                alert('Preencha os campos obrigatórios e selecione ao menos um produto.');
                setIsGenerating(false);
                return;
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // 1. Dark Header
            doc.setFillColor(15, 23, 42); // slate-900 background
            doc.rect(0, 0, pageWidth, 40, 'F');
            
            // 2. Add Logo (keeping aspect ratio)
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
                // Logo may not load, just proceed
            }

            // 3. Header Texts
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            const title = "PROJETO EXCLUSIVO DE EXPANSÃO DE MIX";
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, pageWidth - titleWidth - 15, 18);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(156, 163, 175); // gray-400
            const subtitle = `Parceria Comercial: ${fabrica.nome}`;
            const subWidth = doc.getTextWidth(subtitle);
            doc.text(subtitle, pageWidth - subWidth - 15, 24);

            // 4. Client Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`Desenvolvido estrategicamente para: ${client.nomeFantasia || client.razaoSocial}`, 15, 55);

            // 5. Message Argument
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(55, 65, 81); // gray-700
            
            // Split text to fit page bounds
            const splitMessage = doc.splitTextToSize(`"${message}"`, pageWidth - 30);
            doc.text(splitMessage, 15, 65);

            // Determine Y pos for table based on message lines
            const tableStartY = 65 + (splitMessage.length * 6) + 10;

            // 6. Generate Table Data
            const selectedItems = products.filter((p: any) => selectedProducts.includes(p.id));
            
            // Pre-load images for the table
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
            
            // Resolve prices based on client's table
            const tableRows = selectedItems.map((prod: any) => {
                const price = getClientPrice(client, prod);
                return [
                    prod.codigo,
                    '', // placeholder for image
                    prod.nome,
                    `R$ ${price.toFixed(2).replace('.', ',')}`
                ];
            });

            // 7. Render AutoTable
            autoTable(doc, {
                startY: tableStartY,
                head: [['CÓD.', 'IMAGEM', 'PRODUTO', 'PREÇO UNITÁRIO']],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [37, 99, 235], // blue-600
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 20 },
                    1: { halign: 'center', cellWidth: 35 },
                    2: { halign: 'left' },
                    3: { halign: 'right', cellWidth: 35 },
                },
                bodyStyles: {
                    minCellHeight: 35
                },
                alternateRowStyles: {
                    fillColor: [243, 244, 246] // gray-100 zebrado
                },
                margin: { top: 40, right: 15, bottom: 20, left: 15 },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
                    valign: 'middle'
                },
                didDrawCell: function (data) {
                    if (data.column.index === 1 && data.cell.section === 'body') {
                        const rowIndex = data.row.index;
                        const prod = selectedItems[rowIndex];
                        const b64 = base64Images[prod.id];
                        
                        if (b64) {
                            const dim = 28; // image size constrain
                            const textPos = data.cell;
                            const x = textPos.x + (textPos.width / 2) - (dim / 2);
                            const y = textPos.y + (textPos.height / 2) - (dim / 2);
                            
                            const type = b64.includes('image/png') ? 'PNG' : 'JPEG';
                            try {
                                doc.addImage(b64, type, x, y, dim, dim);
                            } catch (err) {
                                console.error('Erro ao injetar imagem no PDF', err);
                            }
                        }
                    }
                }
            });

            // 8. Footer
            //@ts-ignore - autoTable global types
            const finalY = doc.lastAutoTable?.finalY || tableStartY + 50;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`* Preços vigentes para a tabela: ${client.tabelaPreco || 'Padrão'}. Sujeito a disponibilidade de estoque.`, 15, finalY + 10);
            
            // Save PDF
            const clientNameClean = (client.nomeFantasia || client.razaoSocial).replace(/[^a-zA-Z0-9]/g, '_');
            const fabricaNameClean = fabrica.nome.replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Proposta_Expansao_${fabricaNameClean}_${clientNameClean}.pdf`);
            
        } catch (error) {
            console.error('Erro ao gerar PDF', error);
            alert('Falha ao gerar o PDF. Verifique o console.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header section inside the component logic */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex flex-col md:flex-row justify-between gap-4 md:items-center">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-blue-400" />
                        Gerador de Propostas VIP
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Crie propostas de venda cruzada em PDF selecionando clientes e produtos campeões de giro com preços corretos aplicados automaticamente.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Left Side - Selections */}
                <div className="space-y-5 bg-white/5 p-6 rounded-xl border border-white/10">
                    <div>
                        <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">Cliente Ativo</label>
                        <select 
                            value={selectedClientId} 
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="" className="text-black">Selecione o Cliente...</option>
                            {activeClients.map((c: any) => (
                                <option key={c.id} value={c.id} className="text-black">
                                    {c.nomeFantasia || c.razaoSocial} ({c.cnpj || c.cpf})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">Representada (Marca)</label>
                        <select 
                            value={selectedFabricaId} 
                            onChange={(e) => {
                                setSelectedFabricaId(e.target.value);
                                setSelectedProducts([]); // clear products when changing fabrica
                            }}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
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
                        <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">Mensagem (Argumento de Venda)</label>
                        <textarea
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-black/20 text-gray-300 text-sm p-3 rounded-lg border border-white/5 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Form Right Side - Products selection */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex flex-col h-full">
                    <label className="block text-sm font-medium leading-6 text-gray-300 mb-4">
                        Produtos Campeões de Giro ({selectedProducts.length} selecionados)
                    </label>

                    {!selectedFabricaId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3 min-h-[250px] border border-dashed border-white/10 rounded-lg">
                            <Factory className="w-8 h-8 opacity-50" />
                            <p className="text-sm">Selecione uma Representada para carregar o portfólio</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full min-h-[250px]">
                            {/* Filter Bar */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto por nome ou código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Options List */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[300px] scrollbar-thin scrollbar-thumb-white/10">
                                {availableProducts.length === 0 ? (
                                    <div className="text-center text-gray-500 py-10 text-sm">Nenhum produto encontrado.</div>
                                ) : (
                                    availableProducts.map((p: any) => {
                                        const isSelected = selectedProducts.includes(p.id);
                                        return (
                                            <div 
                                                key={p.id} 
                                                onClick={() => handleToggleProduct(p.id)}
                                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                    isSelected ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-black/20 border-white/5 text-gray-300 hover:border-white/20'
                                                }`}
                                            >
                                                <div className={`mt-0.5 min-w-4 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500 bg-transparent'
                                                }`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div className="flex-1 leading-tight">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-1 py-0.5 rounded">
                                                            Cód: {p.codigo}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-medium">{p.nome}</span>
                                                </div>
                                                <div className="shrink-0 flex items-center justify-center">
                                                    <Box className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-gray-600'}`} />
                                                </div>
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
                    disabled={isGenerating || !selectedClientId || !selectedFabricaId || selectedProducts.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-5 h-5" />
                    {isGenerating ? 'Gerando PDF...' : 'Gerar Proposta Comercial (PDF)'}
                </button>
            </div>
        </div>
    );
}
