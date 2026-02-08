'use client';

import { motion } from "framer-motion";
import { ArrowRight, Lock, User, Loader2 } from "lucide-react";
import NextImage from "next/image";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, usuario, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (usuario && !authLoading) {
      router.push('/dashboard');
    }
  }, [usuario, authLoading, router]);

  // Seed admin user on first load
  useEffect(() => {
    const seedAdmin = async () => {
      try {
        await fetch('/api/auth/seed', { method: 'POST' });
      } catch {
        // Ignore errors
      }
    };
    seedAdmin();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, senha);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Erro ao fazer login');
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">

      {/* Background Abstrato (Luzes de fundo) */}
      <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="absolute top-[40%] -right-[10%] h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]" />

      {/* Container Principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-md p-8"
      >
        <div className="glass-panel rounded-2xl p-8 shadow-2xl bg-white/5 border border-white/10 backdrop-blur-xl">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <NextImage src="/logo.png" alt="Logo" width={64} height={64} className="h-16 w-auto" />
            </div>
            <p className="text-sm text-gray-400">
              Acesse seu painel de inteligência comercial
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="group relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-500 transition-colors group-focus-within:text-blue-500" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Usuário ou Email"
                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 pl-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="group relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500 transition-colors group-focus-within:text-blue-500" />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 pl-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center rounded-lg bg-blue-600 p-3 font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center space-y-3">

            <p className="text-xs text-gray-600">
              Protegido por criptografia de ponta a ponta.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}