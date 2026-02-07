'use client';

import { Settings, Save, RefreshCw, LogOut, Trash2 } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ConfiguracoesPage() {
    const { logout, showToast } = useData();
    const router = useRouter();
    const [companyName, setCompanyName] = useState("Minha Empresa"); // Mock state

    const handleReset = () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os dados (clientes, produtos, pedidos) e deslogará você. Tem certeza?")) {
            localStorage.clear();
            logout();
            router.push('/');
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/');
    }

    const handleSave = () => {
        showToast("Configurações salvas!", "success");
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-blue-600/20 text-blue-500">
                    <Settings className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Configurações</h1>
                    <p className="text-gray-400">Gerencie sua conta e as preferências do sistema.</p>
                </div>
            </div>

            {/* Conta e Perfil */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-white mb-6">Informações da Conta</h2>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Nome da Empresa</label>
                        <input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full rounded-lg bg-black/20 border border-white/10 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email de Acesso</label>
                        <input
                            disabled
                            value="admin@frplus.com"
                            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-gray-500 cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Perfil
                    </button>
                </div>
            </div>

            {/* Zona de Perigo */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-red-500 mb-6">Área de Risco</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5">
                        <div>
                            <h3 className="font-medium text-white">Sair do Sistema</h3>
                            <p className="text-sm text-gray-400">Desconectar sua conta deste dispositivo.</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-red-500/20">
                        <div>
                            <h3 className="font-medium text-red-400">Resetar Sistema</h3>
                            <p className="text-sm text-gray-400">Apaga todos os dados locais e reinicia o app como novo.</p>
                        </div>
                        <button
                            onClick={handleReset}
                            className="flex items-center rounded-lg bg-red-600/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-600/20 transition-colors border border-red-500/20"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Resetar Tudo
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
