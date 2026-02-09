'use client';

import { Search, Plus, Factory, Pencil, Trash2, Package } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

export default function FabricasPage() {
    const { fabricas, removeFabrica, products } = useData();
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

    const filteredFabricas = fabricas.filter(f =>
        f.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getProductCount = (fabricaId: string) => {
        return products.filter(p => p.fabricaId === fabricaId).length;
    };

    const handleDelete = (id: string) => {
        removeFabrica(id);
        setShowDeleteModal(null);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Fábricas</h1>
                    <p className="text-sm text-gray-400">{fabricas.length} fábricas cadastradas</p>
                </div>
                <Link href="/dashboard/fabricas/novo">
                    <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                        <Plus className="h-4 w-4" />
                        Nova Fábrica
                    </button>
                </Link>
            </div>

            {/* Busca */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar fábrica..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-compact pl-10 w-full"
                />
            </div>

            {/* Lista de Fábricas */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredFabricas.length === 0 ? (
                    <div className="col-span-full form-card text-center py-8 text-gray-500">
                        Nenhuma fábrica cadastrada.
                    </div>
                ) : (
                    filteredFabricas.map((fabrica, index) => (
                        <motion.div
                            key={fabrica.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="form-card flex items-center justify-between hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10">
                                    <Factory className="h-5 w-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{fabrica.nome}</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {getProductCount(fabrica.id)} produtos
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <Link href={`/dashboard/fabricas/${fabrica.id}`}>
                                    <button className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white">
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                </Link>
                                <button
                                    onClick={() => setShowDeleteModal(fabrica.id)}
                                    className="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modal de Confirmação */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="form-card p-6 max-w-sm w-full mx-4 space-y-4">
                        <h3 className="text-lg font-semibold text-white">Confirmar Exclusão</h3>
                        <p className="text-sm text-gray-400">Tem certeza que deseja excluir esta fábrica? Os produtos vinculados não serão excluídos.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(showDeleteModal)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
