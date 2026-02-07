'use client';

import Link from "next/link";
import { ArrowLeft, Save, Factory, Loader2 } from "lucide-react";
import { useData, Fabrica } from "@/contexts/DataContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovaFabricaPage() {
    const { addFabrica, showToast } = useData();
    const router = useRouter();
    const [nome, setNome] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!nome.trim()) {
            showToast("Digite o nome da fábrica", "error");
            return;
        }

        setLoading(true);

        const newFabrica: Fabrica = {
            id: Date.now().toString(),
            nome: nome.trim()
        };

        console.log('Salvando fábrica:', newFabrica);
        addFabrica(newFabrica);

        // Pequeno delay para garantir que o estado foi atualizado
        await new Promise(resolve => setTimeout(resolve, 100));

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
                    <h1 className="text-xl font-bold text-white">Nova Fábrica</h1>
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {loading ? 'Salvando...' : 'Salvar'}
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
                        onKeyDown={(e) => e.key === 'Enter' && !loading && handleSave()}
                        placeholder="Ex: Coca-Cola, Nestlé..."
                        className="input-compact"
                        autoFocus
                        disabled={loading}
                    />
                </div>
            </div>
        </div>
    );
}
