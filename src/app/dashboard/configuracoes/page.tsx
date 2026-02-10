'use client';

import { Settings, Save, RefreshCw, LogOut, Trash2, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ConfiguracoesPage() {
    const { logout, showToast } = useData();
    const router = useRouter();
    const [companyName, setCompanyName] = useState("Minha Empresa"); // Mock state

    // Import State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStats, setImportStats] = useState<any>(null);

    const handleImport = async () => {
        if (!importFile) return;

        setIsImporting(true);
        setImportStats(null);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const res = await fetch('/api/import/csv', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                setImportStats(data.stats);
                showToast("Importação concluída com sucesso!", "success");
                setImportFile(null);
            } else {
                showToast(data.error || "Erro ao importar", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de conexão ao importar.", "error");
        } finally {
            setIsImporting(false);
        }
    };

    const handleReset = async () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os dados do BANCO DE DADOS (clientes, produtos, pedidos). Apenas seus usuários serão mantidos. Tem certeza absoluta?")) {
            try {
                const res = await fetch('/api/admin/reset-data', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    showToast("Sistema limpo com sucesso!", "success");
                    // Reload to reflect empty state
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast("Erro ao limpar: " + data.details, "error");
                }
            } catch (e) {
                console.error(e);
                showToast("Erro de conexão ao resetar.", "error");
            }
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

            {/* Importação de Dados */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Importação de Dados</h2>

                        <p className="text-gray-400 text-sm">Importe dados do Protheus via CSV (Clientes, Produtos e Histórico).</p>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Upload className="h-5 w-5" />
                    </div>
                </div>

                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-600 file:text-white
                                hover:file:bg-blue-500
                                cursor-pointer"
                        />
                        <button
                            onClick={handleImport}
                            disabled={!importFile || isImporting}
                            className="shrink-0 flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? (
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {isImporting ? 'Importando...' : 'Iniciar Importação'}
                        </button>
                    </div>

                    {importStats && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 border-t border-white/10 pt-4"
                        >
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                Resultado da Importação
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 uppercase">Clientes</p>
                                    <p className="text-lg font-bold text-white">
                                        +{importStats.clientsNew} <span className="text-xs text-gray-500 font-normal">({importStats.clientsUpdated} atualizados)</span>
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 uppercase">Produtos</p>
                                    <p className="text-lg font-bold text-white">
                                        +{importStats.productsNew} <span className="text-xs text-gray-500 font-normal">({importStats.productsUpdated || 0} atl)</span>
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 uppercase">Pedidos</p>
                                    <p className="text-lg font-bold text-white">+{importStats.ordersCreated}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 uppercase">Ignorados</p>
                                    <p className="text-lg font-bold text-gray-400">{importStats.ordersSkipped}</p>
                                </div>
                            </div>
                            {importStats.errors.length > 0 && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-2">
                                        <AlertCircle className="h-3 w-3" />
                                        Erros ({importStats.errors.length})
                                    </p>
                                    <div className="max-h-24 overflow-y-auto text-xs text-red-300/80 space-y-1">
                                        {importStats.errors.slice(0, 5).map((err: string, i: number) => (
                                            <p key={i}>{err}</p>
                                        ))}
                                        {importStats.errors.length > 5 && <p>...e mais {importStats.errors.length - 5} erros</p>}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
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
                            <h3 className="font-medium text-red-400">Resetar Sistema (Manter Usuários)</h3>
                            <p className="text-sm text-gray-400">Apaga Clientes, Produtos e Pedidos. Mantém seu login.</p>
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
