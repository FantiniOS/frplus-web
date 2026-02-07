'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
    id: string;
    nome: string;
    username: string;
    email: string | null;
    role: 'admin' | 'vendedor';
}

interface AuthContextType {
    usuario: Usuario | null;
    loading: boolean;
    login: (identifier: string, senha: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUsuario(data.usuario);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (identifier: string, senha: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, senha })
            });

            const data = await res.json();

            if (res.ok) {
                setUsuario(data.usuario);
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erro ao fazer login' };
            }
        } catch {
            return { success: false, error: 'Erro de conexão' };
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/me', { method: 'DELETE' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUsuario(null);
            router.push('/');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                loading,
                login,
                logout,
                isAdmin: usuario?.role === 'admin'
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
