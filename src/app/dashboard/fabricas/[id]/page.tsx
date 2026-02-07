'use client';

import Link from "next/link";
import { ArrowLeft, Save, Factory } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditarFabricaPage({ params }: { params: { id: string } }) {
    const { fabricas, updateFabrica, showToast } = useData();
    const router = useRouter();
    const [nome, setNome] = useState("");

    useEffect(() => {
        const found = fabricas.find(f => f.id === params.id);
        if (found) setNome(found.nome);
    }, [fabricas, params.id]);

    const handleSave = () => {
        if (!nome.trim()) {
            showToast("Digite o nome da fábrica", "error");
            return;
        }
        updateFabrica(params.id, { nome: nome.trim() });
        router.push('/dashboard/fabricas');
    };

    return (
        <div className="max-w-md mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/fabricas" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Editar Fábrica</h1>
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                    <Save className="h-4 w-4" /> Salvar
                </button>
            </div>

            <div className="form-card">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                    <Factory className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">Dados da Fábrica</span>
                </div>
                <div>
                    <label className="label-compact">Nome da Fábrica *</label>
                    <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        className="input-compact"
                        autoFocus
                    />
                </div>
            </div>
        </div>
    );
}
