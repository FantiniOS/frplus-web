/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users, Edit, Trash2, Loader2, Shield, User, Plus } from 'lucide-react';

interface Usuario {
    id: string;
    nome: string;
    username: string;
    email: string | null;
    role: 'admin' | 'vendedor';
    ativo: boolean;
    createdAt: string;
}

export default function UsuariosPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<Usuario | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        username: '',
        email: '',
        senha: '',
        role: 'vendedor'
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Redirect non-admin users
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/dashboard');
        }
    }, [isAdmin, authLoading, router]);

    const fetchUsuarios = async () => {
        try {
            const res = await fetch('/api/usuarios');
            if (res.ok) {
                const data = await res.json();
                setUsuarios(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchUsuarios();
        }
    }, [isAdmin]);

    const openModal = (user?: Usuario) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                nome: user.nome,
                username: user.username,
                email: user.email || '',
                senha: '',
                role: user.role
            });
        } else {
            setEditingUser(null);
            setFormData({ nome: '', username: '', email: '', senha: '', role: 'vendedor' });
        }
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const url = editingUser ? `/api/usuarios/${editingUser.id}` : '/api/usuarios';
            const method = editingUser ? 'PUT' : 'POST';

            const body: Record<string, unknown> = {
                nome: formData.nome,
                username: formData.username,
                email: formData.email || null,
                role: formData.role
            };

            if (formData.senha) {
                body.senha = formData.senha;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowModal(false);
                fetchUsuarios();
            } else {
                const data = await res.json();
                setError(data.error || 'Erro ao salvar usuário');
            }
        } catch {
            setError('Erro de conexão');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (user: Usuario) => {
        try {
            await fetch(`/api/usuarios/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: !user.ativo })
            });
            fetchUsuarios();
        } catch (error) {
            console.error('Error toggling user:', error);
        }
    };

    const handleDelete = async (user: Usuario) => {
        if (!confirm(`Tem certeza que deseja excluir "${user.nome}"?`)) return;

        try {
            await fetch(`/api/usuarios/${user.id}`, { method: 'DELETE' });
            fetchUsuarios();
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Usuários</h1>
                    <p className="text-sm text-gray-400">Gerencie os usuários do sistema</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Novo Usuário
                </button>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-4 py-3 text-left">Nome</th>
                                <th className="px-4 py-3 text-left">Usuário</th>
                                <th className="px-4 py-3 text-left">Email</th>
                                <th className="px-4 py-3 text-center">Role</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {usuarios.map(user => (
                                <tr key={user.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                                                {user.role === 'admin' ? (
                                                    <Shield className="h-4 w-4 text-purple-400" />
                                                ) : (
                                                    <User className="h-4 w-4 text-blue-400" />
                                                )}
                                            </div>
                                            <span className="font-medium text-white">{user.nome}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-300">{user.username}</td>
                                    <td className="px-4 py-3 text-gray-300">{user.email}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'admin'
                                            ? 'bg-purple-500/20 text-purple-400'
                                            : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {user.role === 'admin' ? 'Administrador' : 'Vendedor'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={`px-2 py-1 rounded-full text-xs ${user.ativo
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}
                                        >
                                            {user.ativo ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => openModal(user)}
                                                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
                        <div className="p-4 border-b border-white/10">
                            <h2 className="text-lg font-semibold text-white">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Usuário (Login)</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Email (Opcional)</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.senha}
                                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                    required={!editingUser}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Permissão</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="vendedor">Vendedor</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                    {editingUser ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
