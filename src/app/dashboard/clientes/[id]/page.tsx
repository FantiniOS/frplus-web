'use client';

import Link from "next/link";
import { ArrowLeft, Save, Building2, MapPin, DollarSign, Search, Loader2, User, CalendarPlus, X } from "lucide-react";
import { useData, Client } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { agendarVisita } from "@/app/actions/visitas";

export default function EditarClientePage({ params }: { params: { id: string } }) {
    const { clients, updateClient, showToast } = useData();
    const { isIndustria } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState<Partial<Client>>({});
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // Modal Visita State
    const [showModalVisita, setShowModalVisita] = useState(false);
    const [dataVisita, setDataVisita] = useState('');
    const [horaVisita, setHoraVisita] = useState('');
    const [obsVisita, setObsVisita] = useState('');
    const [loadingVisita, setLoadingVisita] = useState(false);

    useEffect(() => {
        if (isIndustria) {
            router.push('/dashboard/clientes');
        }
    }, [isIndustria, router]);

    useEffect(() => {
        const client = clients.find(c => c.id === params.id);
        if (client) setFormData(client);
    }, [clients, params.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Buscar dados pelo CNPJ
    const buscarCnpj = async () => {
        const cnpj = formData.cnpj?.replace(/\D/g, '');
        if (!cnpj || cnpj.length !== 14) {
            showToast("CNPJ inválido (14 dígitos)", "error");
            return;
        }

        setLoadingCnpj(true);
        try {
            const response = await fetch(`/api/cnpj/${cnpj}`);
            if (!response.ok) throw new Error('CNPJ não encontrado');

            const data = await response.json();

            setFormData(prev => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
                cep: data.cep?.replace(/\D/g, '') || prev.cep,
                endereco: data.logradouro || prev.endereco,
                numero: data.numero || prev.numero,
                bairro: data.bairro || prev.bairro,
                cidade: data.municipio || prev.cidade,
                estado: data.uf || prev.estado,
            }));

            showToast("Dados do CNPJ carregados!", "success");
        } catch {
            showToast("CNPJ não encontrado", "error");
        } finally {
            setLoadingCnpj(false);
        }
    };

    // Buscar endereço pelo CEP
    const buscarCep = async () => {
        const cep = formData.cep?.replace(/\D/g, '');
        if (!cep || cep.length !== 8) {
            showToast("CEP inválido (8 dígitos)", "error");
            return;
        }

        setLoadingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) throw new Error('CEP não encontrado');

            setFormData(prev => ({
                ...prev,
                endereco: data.logradouro || prev.endereco,
                bairro: data.bairro || prev.bairro,
                cidade: data.localidade || prev.cidade,
                uf: data.uf || prev.uf,
            }));

            showToast("Endereço carregado!", "success");
        } catch {
            showToast("CEP não encontrado", "error");
        } finally {
            setLoadingCep(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.razaoSocial || !formData.cnpj) {
            showToast("Preencha Razão Social e CNPJ", "error");
            return;
        }
        if (formData.id) {
            // Ensure compatibilty
            const updateData = {
                ...formData,
                nome: formData.razaoSocial, // Keep name synced for now
                tabelaPreco: formData.tabelaPreco || '50a199' // Ensure default table
            };
            updateClient(formData.id, updateData);
            router.push('/dashboard/clientes');
        }
    };

    const handleAgendarVisita = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dataVisita || !horaVisita) {
            showToast("Preencha data e hora da visita", "error");
            return;
        }

        setLoadingVisita(true);
        try {
            const dateObj = new Date(`${dataVisita}T${horaVisita}:00`);
            
            const res = await agendarVisita({
                titulo: "Visita Agendada",
                clienteId: formData.id!,
                dataVisita: dateObj,
                observacoes: obsVisita
            });

            if (res.success) {
                showToast("Visita agendada com sucesso!", "success");
                setShowModalVisita(false);
                setDataVisita('');
                setHoraVisita('');
                setObsVisita('');
            } else {
                showToast("Erro ao agendar visita", "error");
            }
        } catch (error) {
            showToast("Erro ao agendar visita", "error");
        } finally {
            setLoadingVisita(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/clientes" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Editar Cliente</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowModalVisita(true)}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600/20 px-4 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                    >
                        <CalendarPlus className="h-4 w-4" /> Agendar Visita
                    </button>
                    <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                        <Save className="h-4 w-4" /> Salvar
                    </button>
                </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Dados da Empresa */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Dados da Empresa</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div>
                            <label className="label-compact">CNPJ *</label>
                            <div className="flex gap-1">
                                <input name="cnpj" value={formData.cnpj || ''} onChange={handleChange} className="input-compact flex-1" />
                                <button
                                    type="button"
                                    onClick={buscarCnpj}
                                    disabled={loadingCnpj}
                                    className="px-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50"
                                    title="Buscar dados pelo CNPJ"
                                >
                                    {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="label-compact">Inscrição Estadual</label>
                            <input name="inscricaoEstadual" value={formData.inscricaoEstadual || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Razão Social *</label>
                            <input name="razaoSocial" value={formData.razaoSocial || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Nome Fantasia</label>
                            <input name="nomeFantasia" value={formData.nomeFantasia || ''} onChange={handleChange} className="input-compact" />
                        </div>
                    </div>
                </div>

                {/* Contato */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <User className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-white">Contato</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="label-compact">Nome do Comprador</label>
                            <input name="comprador" value={formData.comprador || ''} onChange={handleChange} placeholder="Nome do responsável" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Email</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="contato@empresa.com" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Telefone Fixo</label>
                            <input name="telefone" value={formData.telefone || ''} onChange={handleChange} placeholder="(00) 0000-0000" className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Celular / WhatsApp</label>
                            <input name="celular" value={formData.celular || ''} onChange={handleChange} placeholder="(00) 90000-0000" className="input-compact" />
                        </div>
                    </div>
                </div>

                {/* Endereço */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <MapPin className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-white">Localização</span>
                    </div>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                        <div>
                            <label className="label-compact">CEP</label>
                            <div className="flex gap-1">
                                <input name="cep" value={formData.cep || ''} onChange={handleChange} className="input-compact flex-1" />
                                <button
                                    type="button"
                                    onClick={buscarCep}
                                    disabled={loadingCep}
                                    className="px-2 rounded-lg bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 disabled:opacity-50"
                                    title="Buscar endereço pelo CEP"
                                >
                                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                            <label className="label-compact">Endereço</label>
                            <input name="endereco" value={formData.endereco || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Número</label>
                            <input name="numero" value={formData.numero || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Bairro</label>
                            <input name="bairro" value={formData.bairro || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Cidade</label>
                            <input name="cidade" value={formData.cidade || ''} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">UF</label>
                            <select name="uf" value={formData.uf || ''} onChange={handleChange} className="input-compact">
                                <option value="">-</option>
                                <option>AC</option><option>AL</option><option>AP</option><option>AM</option>
                                <option>BA</option><option>CE</option><option>DF</option><option>ES</option>
                                <option>GO</option><option>MA</option><option>MT</option><option>MS</option>
                                <option>MG</option><option>PA</option><option>PB</option><option>PR</option>
                                <option>PE</option><option>PI</option><option>RJ</option><option>RN</option>
                                <option>RS</option><option>RO</option><option>RR</option><option>SC</option>
                                <option>SP</option><option>SE</option><option>TO</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Comercial */}
                <div className="form-card">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Perfil Comercial</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div>
                            <label className="label-compact">Tabela de Preço</label>
                            <select name="tabelaPreco" value={formData.tabelaPreco || ''} onChange={handleChange} className="input-compact">
                                <option value="">Selecione...</option>
                                <option value="50a199">50 a 199 CX</option>
                                <option value="200a699">200 a 699 CX</option>
                                <option value="atacado">Atacado</option>
                                <option value="atacadoAVista">Atacado à Vista</option>
                                <option value="redes">Redes</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-compact">Limite de Crédito (R$)</label>
                            <input name="limiteCredito" type="number" value={formData.limiteCredito || 0} onChange={handleChange} className="input-compact" />
                        </div>
                        <div>
                            <label className="label-compact">Status</label>
                            <select name="status" value={formData.status || 'Ativo'} onChange={handleChange} className="input-compact">
                                <option>Ativo</option><option>Inativo</option><option>Bloqueado</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-compact">Observações</label>
                            <input name="observacoes" value={formData.observacoes || ''} onChange={handleChange} className="input-compact" />
                        </div>
                    </div>
                </div>
            </form>

            {/* ===== MODAL AGENDAR VISITA ===== */}
            {showModalVisita && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModalVisita(false)} />
                    
                    <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleAgendarVisita}>
                            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/15">
                                        <CalendarPlus className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Agendar Visita</h3>
                                        <p className="text-xs text-gray-400">Marque um horário com este cliente</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowModalVisita(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-300">Data *</label>
                                        <input
                                            type="date"
                                            required
                                            value={dataVisita}
                                            onChange={(e) => setDataVisita(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-300">Horário *</label>
                                        <input
                                            type="time"
                                            required
                                            value={horaVisita}
                                            onChange={(e) => setHoraVisita(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-300">Observações / Pauta</label>
                                    <textarea
                                        rows={3}
                                        value={obsVisita}
                                        onChange={(e) => setObsVisita(e.target.value)}
                                        placeholder="O que será discutido?"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06] bg-black/20 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => setShowModalVisita(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingVisita}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {loadingVisita ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
