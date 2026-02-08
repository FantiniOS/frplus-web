'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { QrCode, RefreshCw, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WhatsAppPage() {
    const { showToast } = useData();
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            // TODO: Call API to check instance status
            // const res = await fetch('/api/whatsapp/status');
            // const data = await res.json();
            // setStatus(data.status);
        } catch (error) {
            console.error('Error checking status', error);
        }
    };

    const connectInstance = async () => {
        setLoading(true);
        try {
            // TODO: Call API to connect/create instance
            // const res = await fetch('/api/whatsapp/connect');
            // const data = await res.json();
            // setQrCode(data.qrcode);
            // setStatus('connecting');

            // Mock for UI dev
            setTimeout(() => {
                setQrCode('mock-qr-code');
                setStatus('connecting');
                showToast('Aguardando leitura do QR Code...', 'info');
            }, 1000);
        } catch (error) {
            showToast('Erro ao conectar', 'error');
        } finally {
            setLoading(false);
        }
    };

    const disconnectInstance = async () => {
        if (!confirm('Tem certeza que deseja desconectar?')) return;
        setLoading(true);
        try {
            // TODO: Call API to logout
            setStatus('disconnected');
            setQrCode(null);
            showToast('Desconectado com sucesso', 'success');
        } catch (error) {
            showToast('Erro ao desconectar', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Conexão WhatsApp</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Card */}
                <div className="form-card">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Smartphone className="text-blue-400" />
                        Status da Conexão
                    </h2>

                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        {status === 'connected' ? (
                            <div className="flex flex-col items-center text-green-400">
                                <CheckCircle size={48} />
                                <p className="mt-2 font-medium">Conectado</p>
                            </div>
                        ) : status === 'connecting' ? (
                            <div className="flex flex-col items-center text-yellow-400">
                                <RefreshCw size={48} className="animate-spin" />
                                <p className="mt-2 font-medium">Aguardando Conexão...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-gray-400">
                                <XCircle size={48} />
                                <p className="mt-2 font-medium">Desconectado</p>
                            </div>
                        )}

                        <div className="w-full h-px bg-white/10 my-4" />

                        {status === 'disconnected' ? (
                            <button
                                onClick={connectInstance}
                                disabled={loading}
                                className="w-full btn-primary flex items-center justify-center gap-2"
                            >
                                <QrCode size={18} />
                                {loading ? 'Carregando...' : 'Gerar QR Code'}
                            </button>
                        ) : (
                            <button
                                onClick={disconnectInstance}
                                disabled={loading}
                                className="w-full btn-secondary flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                                <XCircle size={18} />
                                {loading ? 'Desconectando...' : 'Desconectar'}
                            </button>
                        )}
                    </div>
                </div>

                {/* QR Code Area */}
                <div className="form-card flex flex-col items-center justify-center min-h-[300px]">
                    {qrCode ? (
                        <div className="bg-white p-4 rounded-lg">
                            <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center">
                            O QR Code aparecerá aqui quando você clicar em "Gerar".
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
