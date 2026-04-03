'use client';

import { Settings, Save, RefreshCw, LogOut, Trash2, Upload, CheckCircle, AlertCircle, Factory, Shield, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Papa from "papaparse";
import { getPerfilEmpresa, savePerfilEmpresa } from "@/app/actions/perfilEmpresa";

export default function ConfiguracoesPage() {
    const { logout, showToast, fabricas, refreshData } = useData();
    const { isIndustria, usuario, isAdmin, refreshSession } = useAuth() as any;
    const router = useRouter();
    const [companyName, setCompanyName] = useState("Minha Empresa");
    const [isSaving, setIsSaving] = useState(false);

    // Per-representada commission rates
    const [comissoes, setComissoes] = useState<Record<string, string>>({});
    const [isSavingComissoes, setIsSavingComissoes] = useState(false);

    useEffect(() => {
        if (isIndustria) {
            router.push('/dashboard');
        }
    }, [isIndustria, router]);

    // Sync company name when user data loads
    useEffect(() => {
        if (usuario?.empresa) {
            setCompanyName(usuario.empresa);
        }
    }, [usuario]);

    // Perfil Global FRPlus
    const [perfilGlobLoading, setPerfilGlobLoading] = useState(true);
    const [perfilGlobSaving, setPerfilGlobSaving] = useState(false);
    const [perfilGlob, setPerfilGlob] = useState({nomeEmpresa: '', email: '', telefone: ''});

    useEffect(() => {
        getPerfilEmpresa().then(data => {
            setPerfilGlob({
                nomeEmpresa: data.nomeEmpresa || '',
                email: data.email || '',
                telefone: data.telefone || ''
            });
            setPerfilGlobLoading(false);
        });
    }, []);

    const handleSavePerfilGlob = async () => {
        setPerfilGlobSaving(true);
        try {
            const res = await savePerfilEmpresa(perfilGlob);
            if (res.sucesso) {
                 showToast("Assinatura FRPlus salva com sucesso!", "success");
                 router.refresh();
            } else {
                 showToast(res.mensagem || "Erro ao salvar perfil global.", "error");
            }
        } catch(e) {
            showToast("Erro interno ao salvar perfil global.", "error");
        } finally {
            setPerfilGlobSaving(false);
        }
    };

    // Sync commission rates when fabricas load
    useEffect(() => {
        const rates: Record<string, string> = {};
        fabricas.forEach(f => {
            rates[f.id] = String(f.taxaComissao ?? 0);
        });
        setComissoes(rates);
    }, [fabricas]);

    // Import State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [selectedFabricaId, setSelectedFabricaId] = useState<string>("");
    const [isImporting, setIsImporting] = useState(false);
    const [importStats, setImportStats] = useState<any>(null);
    const [importProgress, setImportProgress] = useState<string>("");

    const handleImport = async () => {
        if (!importFile || !selectedFabricaId) return;

        setIsImporting(true);
        setImportStats(null);
        setImportProgress("Lendo arquivo...");

        Papa.parse(importFile, {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    // results.data is array of arrays
                    // Skip 'Consulta' and Header (2 lines)
                    const rawRows = results.data.slice(2) as string[][];
                    
                    if (rawRows.length === 0) {
                        showToast("Arquivo vazio ou sem dados após cabecalho.", "error");
                        setIsImporting(false);
                        return;
                    }

                    const headersMap = [
                        'Filial', 'Numero', 'DT_Emissao', 'Cliente', 'Loja', 'Nome_Cliente',
                        'Tipo_Pedido', 'Nota_Fiscal', 'Serie', 'Vendedor_1', 'Nome_Vendedor',
                        'Cond_Pagto', 'Descricao_Pagto', 'Desconto_1', 'DT_Emissao_Fat', 'Status',
                        'Produto', 'Descricao_Produto', 'Unidade', 'Quantidade', 'Prc_Unitario', 'Vlr_Total'
                    ];

                    const mappedRows = rawRows.map(row => {
                        const obj: any = {};
                        headersMap.forEach((header, index) => {
                            obj[header] = row[index];
                        });
                        return obj;
                    });

                    // Chunk process
                    const CHUNK_SIZE = 250;
                    const chunks = [];
                    for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
                        chunks.push(mappedRows.slice(i, i + CHUNK_SIZE));
                    }

                    let cumulativeStats = {
                        clientsNew: 0,
                        clientsUpdated: 0,
                        productsNew: 0,
                        productsUpdated: 0,
                        ordersCreated: 0,
                        ordersUpdated: 0,
                        ordersSkipped: 0,
                        errors: [] as string[]
                    };

                    for (let i = 0; i < chunks.length; i++) {
                        setImportProgress(`Processando lote ${i + 1} de ${chunks.length}...`);
                        
                        const res = await fetch('/api/import/batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                rows: chunks[i],
                                fabricaId: selectedFabricaId
                            })
                        });

                        const data = await res.json();
                        if (data.success) {
                            cumulativeStats.clientsNew += data.stats.clientsNew || 0;
                            cumulativeStats.clientsUpdated += data.stats.clientsUpdated || 0;
                            cumulativeStats.productsNew += data.stats.productsNew || 0;
                            cumulativeStats.productsUpdated += data.stats.productsUpdated || 0;
                            cumulativeStats.ordersCreated += data.stats.ordersCreated || 0;
                            cumulativeStats.ordersUpdated += data.stats.ordersUpdated || 0;
                            cumulativeStats.ordersSkipped += data.stats.ordersSkipped || 0;
                            if (data.stats.errors) cumulativeStats.errors.push(...data.stats.errors);
                        } else {
                            throw new Error(data.error || "Erro no servidor ao processar lote");
                        }
                    }

                    setImportStats(cumulativeStats);
                    showToast("Importação concluída com sucesso!", "success");
                    setImportFile(null);
                    setImportProgress("");
                } catch (error: any) {
                    console.error(error);
                    showToast("Erro durante a importação: " + error.message, "error");
                    setImportProgress("");
                } finally {
                    setIsImporting(false);
                }
            },
            error: (error) => {
                showToast("Erro ao processar CSV localmente: " + error.message, "error");
                setIsImporting(false);
                setImportProgress("");
            }
        });
    };

    const handleReset = async () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os dados do BANCO DE DADOS (clientes, produtos, pedidos). Apenas seus usuários serão mantidos. Tem certeza absoluta?")) {
            try {
                const res = await fetch('/api/admin/reset-data', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    showToast("Sistema limpo com sucesso!", "success");
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

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!companyName.trim()) {
            showToast("O nome da empresa não pode estar vazio.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nomeEmpresa: companyName.trim()
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (refreshSession) {
                    await refreshSession();
                }
                showToast("Configurações salvas!", "success");
                router.refresh();
            } else {
                showToast(data.error || "Erro ao salvar o perfil.", "error");
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            showToast("Erro de conexão ao salvar.", "error");
        } finally {
            setIsSaving(false);
        }
    }

    const handleSaveComissoes = async () => {
        setIsSavingComissoes(true);
        let hasError = false;

        try {
            const promises = fabricas.map(async (fab) => {
                const novaRate = comissoes[fab.id];
                if (novaRate === undefined || parseFloat(novaRate) === fab.taxaComissao) return;

                const res = await fetch(`/api/fabricas/${fab.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taxaComissao: novaRate })
                });

                if (!res.ok) {
                    hasError = true;
                    const err = await res.json();
                    console.error(`Erro ao salvar ${fab.nome}:`, err);
                }
            });

            await Promise.all(promises);

            if (hasError) {
                showToast("Algumas taxas não puderam ser salvas.", "error");
            } else {
                showToast("Taxas de comissão salvas!", "success");
                await refreshData();
            }
        } catch (error) {
            console.error('Error saving comissoes:', error);
            showToast("Erro de conexão ao salvar taxas.", "error");
        } finally {
            setIsSavingComissoes(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-blue-600/20 text-blue-500">
                    <Settings className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Configurações</h1>
                    <p className="text-gray-400">Gerencie sua conta, equipe e preferências do sistema.</p>
                </div>
            </div>

            {/* Painel Administrativo (Acesso Restrito) */}
            {isAdmin && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 backdrop-blur-sm">
                    <h2 className="text-xl font-semibold text-blue-400 mb-6 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Portal Administrativo
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Link href="/dashboard/fabricas" className="group p-5 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Factory className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Gerenciar Fábricas</h3>
                                    <p className="text-xs text-gray-400">Cadastros e parametrizações</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                        </Link>

                        <Link href="/dashboard/usuarios" className="group p-5 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Gestão de Usuários</h3>
                                    <p className="text-xs text-gray-400">Acessos e permissões de equipe</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Identidade Global (Assinatura FRPlus) */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-emerald-400 mb-6 flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    Assinatura Global (FRPlus)
                </h2>
                {perfilGlobLoading ? (
                    <p className="text-gray-400 animate-pulse text-sm">Carregando perfil...</p>
                ) : (
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Nome Mestre (Empresa)</label>
                            <input
                                value={perfilGlob.nomeEmpresa}
                                onChange={(e) => setPerfilGlob({ ...perfilGlob, nomeEmpresa: e.target.value })}
                                placeholder="Fantini Representações"
                                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">E-mail Comercial</label>
                            <input
                                value={perfilGlob.email}
                                onChange={(e) => setPerfilGlob({ ...perfilGlob, email: e.target.value })}
                                placeholder="contato@fantini.com.br"
                                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">WhatsApp / Telefone</label>
                            <input
                                value={perfilGlob.telefone}
                                onChange={(e) => setPerfilGlob({ ...perfilGlob, telefone: e.target.value })}
                                placeholder="(31) 99694-4540"
                                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>
                )}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSavePerfilGlob}
                        disabled={perfilGlobSaving || perfilGlobLoading}
                        className="flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {perfilGlobSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {perfilGlobSaving ? 'Salvando...' : 'Salvar Assinatura'}
                    </button>
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
                            value={usuario?.email || "N/D"}
                            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-gray-500 cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Salvando...' : 'Salvar Perfil'}
                    </button>
                </div>
            </div>

            {/* Comissão por Representada */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Comissão por Representada</h2>
                        <p className="text-gray-400 text-sm">Defina o percentual de comissão para cada fábrica/representada.</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                        <Factory className="h-5 w-5" />
                    </div>
                </div>

                {fabricas.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">Nenhuma representada cadastrada.</p>
                ) : (
                    <div className="space-y-3">
                        {fabricas.map(fab => (
                            <div
                                key={fab.id}
                                className="flex items-center gap-4 p-3 rounded-lg bg-black/20 border border-white/5"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{fab.nome}</p>
                                    <p className="text-xs text-gray-500">{fab.produtosCount ?? 0} produtos</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        placeholder="0"
                                        value={comissoes[fab.id] ?? '0'}
                                        onChange={(e) => setComissoes(prev => ({ ...prev, [fab.id]: e.target.value }))}
                                        className="w-20 rounded-lg bg-black/30 border border-white/10 p-2 text-white text-sm text-center focus:border-amber-500 focus:outline-none tabular-nums"
                                    />
                                    <span className="text-xs text-gray-400 font-medium">%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {fabricas.length > 0 && (
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSaveComissoes}
                            disabled={isSavingComissoes}
                            className="flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSavingComissoes ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSavingComissoes ? 'Salvando...' : 'Salvar Taxas'}
                        </button>
                    </div>
                )}
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

                <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-4">
                    {/* Factory Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Vincular Importação à Representada (Obrigatório)</label>
                        <select
                            value={selectedFabricaId}
                            onChange={(e) => setSelectedFabricaId(e.target.value)}
                            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50 appearance-none cursor-pointer"
                        >
                            <option value="" disabled>Selecione a Representada...</option>
                            {fabricas.map(fab => (
                                <option key={fab.id} value={fab.id}>
                                    {fab.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
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
                            disabled={!importFile || !selectedFabricaId || isImporting}
                            className="shrink-0 flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? (
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {isImporting ? (importProgress || 'Importando...') : 'Iniciar Importação'}
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-black/20 border border-white/5">
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

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-black/20 border border-red-500/20">
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
