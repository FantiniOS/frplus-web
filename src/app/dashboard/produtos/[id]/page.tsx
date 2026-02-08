'use client';

import Link from "next/link";
import { ArrowLeft, Save, Package, DollarSign, Factory, Image, Upload } from "lucide-react";
import { useData, Product } from "@/contexts/DataContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EditarProdutoPage({ params }: { params: { id: string } }) {
    const { products, updateProduct, showToast, fabricas } = useData();
    const router = useRouter();
    const [formData, setFormData] = useState<Partial<Product>>({});

    useEffect(() => {
        const found = products.find(p => p.id === params.id);
        if (found) setFormData(found);
    }, [products, params.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numFields = ['preco50a199', 'preco200a699', 'precoAtacado', 'precoAtacadoAVista', 'precoRedes'];
        setFormData(prev => ({
            ...prev,
            [name]: numFields.includes(name) ? parseFloat(value) || 0 : value
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imagemUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome || !formData.codigo) {
            showToast("Preencha Nome e Código", "error");
            return;
        }
        if (formData.id) {
            const updateData = {
                ...formData,
                imagem: formData.imagemUrl || formData.imagem // Ensure backend receives the updated image
            };
            updateProduct(formData.id, updateData);
            router.push('/dashboard/produtos');
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/produtos" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Editar Produto</h1>
                </div>
                <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                    <Save className="h-4 w-4" /> Salvar
                </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Foto do Produto */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <Image className="h-4 w-4 text-pink-400" />
                        <span className="text-sm font-medium text-white">Foto do Produto</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
                            {formData.imagemUrl ? (
                                <img src={formData.imagemUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Package className="h-8 w-8 text-gray-500" />
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
                                <Upload className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-300">Escolher imagem</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">PNG, JPG ou WEBP até 2MB</p>
                            <input
                                type="text"
                                name="imagemUrl"
                                value={formData.imagemUrl || ''}
                                onChange={handleChange}
                                placeholder="Ou cole a URL da imagem aqui..."
                                className="input-compact mt-2 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Identificação */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <Package className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-white">Identificação</span>
                    </div>
                    <div className="grid gap-3 grid-cols-2">
                        <div>
                            <label className="label-compact">Código *</label>
                            <input name="codigo" value={formData.codigo || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Nome *</label>
                            <input name="nome" value={formData.nome || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Fábrica</label>
                            <div className="relative">
                                <Factory className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                                <select name="fabricaId" value={formData.fabricaId || ''} onChange={handleChange} className="input-compact pl-7">
                                    <option value="">Selecione...</option>
                                    {fabricas.map(f => (
                                        <option key={f.id} value={f.id}>{f.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="label-compact">Categoria</label>
                            <input name="categoria" value={formData.categoria || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Unidade</label>
                            <select name="unidade" value={formData.unidade || 'CX'} onChange={handleChange} className="input-compact">
                                <option value="CX">Caixa (CX)</option>
                                <option value="UN">Unidade (UN)</option>
                                <option value="KG">Quilo (KG)</option>
                                <option value="LT">Litro (LT)</option>
                                <option value="PCT">Pacote (PCT)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tabelas de Preço */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Tabelas de Preço (R$)</span>
                    </div>
                    <div className="grid gap-3 grid-cols-5">
                        <div>
                            <label className="label-compact">50 a 199 CX</label>
                            <input name="preco50a199" type="number" step="0.01" value={formData.preco50a199 || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">200 a 699 CX</label>
                            <input name="preco200a699" type="number" step="0.01" value={formData.preco200a699 || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Atacado</label>
                            <input name="precoAtacado" type="number" step="0.01" value={formData.precoAtacado || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Atacado à Vista</label>
                            <input name="precoAtacadoAVista" type="number" step="0.01" value={formData.precoAtacadoAVista || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Redes</label>
                            <input name="precoRedes" type="number" step="0.01" value={formData.precoRedes || ''} onChange={handleChange} className="input-compact" />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
