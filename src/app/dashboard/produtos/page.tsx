'use client';

import { Search, Plus, Package, Trash2, Edit, Factory } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export default function ProdutosPage() {
    const { products, removeProduct, fabricas } = useData();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDelete = () => {
        if (deleteId) {
            removeProduct(deleteId);
            setDeleteId(null);
        }
    };

    const filteredProducts = products.filter(product =>
        product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getFabricaNome = (fabricaId?: string) => {
        if (!fabricaId) return '-';
        return fabricas.find(f => f.id === fabricaId)?.nome || '-';
    };

    // Agrupar produtos por fábrica
    const productsByFabrica = filteredProducts.reduce((acc, product) => {
        const fabricaId = product.fabricaId || 'sem-fabrica';
        if (!acc[fabricaId]) {
            acc[fabricaId] = [];
        }
        acc[fabricaId].push(product);
        return acc;
    }, {} as Record<string, typeof products>);

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Catálogo de Produtos</h1>
                    <p className="text-sm text-gray-400">{products.length} produtos cadastrados</p>
                </div>
                <Link href="/dashboard/produtos/novo">
                    <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                        <Plus className="h-4 w-4" />
                        Novo Produto
                    </button>
                </Link>
            </div>

            {/* Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome, código ou categoria..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-compact pl-10 w-full"
                />
            </div>

            {/* Lista de Produtos por Fábrica */}
            <div className="space-y-8">
                {Object.keys(productsByFabrica).length > 0 ? (
                    Object.entries(productsByFabrica).sort((a, b) => {
                        // Ordenar por nome da fábrica
                        const nomeA = a[0] === 'sem-fabrica' ? 'Outros' : getFabricaNome(a[0]);
                        const nomeB = b[0] === 'sem-fabrica' ? 'Outros' : getFabricaNome(b[0]);
                        if (a[0] === 'sem-fabrica') return 1;
                        if (b[0] === 'sem-fabrica') return -1;
                        return nomeA.localeCompare(nomeB);
                    }).map(([fabricaId, groupProducts]: [string, typeof products]) => (
                        <div key={fabricaId} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <Factory className="h-5 w-5 text-blue-400" />
                                <h2 className="text-lg font-bold text-white">
                                    {fabricaId === 'sem-fabrica' ? 'Outros' : getFabricaNome(fabricaId)}
                                </h2>
                                <span className="text-sm text-gray-500">
                                    ({groupProducts.length})
                                </span>
                                {fabricaId !== 'sem-fabrica' && (
                                    <div className="h-px flex-1 bg-white/10 ml-4"></div>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupProducts.map((product, index) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="form-card group hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex gap-3">
                                            {/* Conteúdo à esquerda */}
                                            <div className="flex-1 min-w-0">
                                                {/* Header com código e ações */}
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-[10px] font-mono text-gray-500">{product.codigo}</p>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setDeleteId(product.id)}
                                                            className="p-1 rounded text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                        <Link href={`/dashboard/produtos/${product.id}`}>
                                                            <button className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-white">
                                                                <Edit className="h-3 w-3" />
                                                            </button>
                                                        </Link>
                                                    </div>
                                                </div>

                                                <p className="font-medium text-white truncate">{product.nome}</p>

                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                                                        {product.categoria}
                                                    </span>
                                                </div>

                                                {/* Preços - 5 tabelas em linha */}
                                                <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 text-xs">
                                                    <div className="text-center">
                                                        <p className="text-gray-500 text-[9px]">50-199</p>
                                                        <p className="text-green-400 font-medium text-[11px]">R$ {product.preco50a199?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-500 text-[9px]">200-699</p>
                                                        <p className="text-green-400 font-medium text-[11px]">R$ {product.preco200a699?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-500 text-[9px]">Atacado</p>
                                                        <p className="text-green-400 font-medium text-[11px]">R$ {product.precoAtacado?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-500 text-[9px]">À Vista</p>
                                                        <p className="text-green-400 font-medium text-[11px]">R$ {product.precoAtacadoAVista?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-500 text-[9px]">Redes</p>
                                                        <p className="text-green-400 font-medium text-[11px]">R$ {product.precoRedes?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Imagem à direita */}
                                            <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {(product.imagem || product.imagemUrl) ? (
                                                    <img src={product.imagem || product.imagemUrl} alt={product.nome} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="h-8 w-8 text-gray-600" />
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full form-card text-center py-8 text-gray-500">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum produto encontrado</p>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!deleteId}
                title="Excluir Produto"
                message="Tem certeza que deseja remover este produto?"
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
