'use client';

import { useState } from 'react';
import { X, MessageCircle, Mail, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Client {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    email: string;
    telefone: string;
    celular: string;
    diasInativo?: number | null;
}

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onSuccess?: () => void;
}

const MESSAGE_TEMPLATES = [
    {
        id: 'reactivation',
        name: 'Reativação',
        message: 'Olá {nome}! Sentimos sua falta! Faz {dias} dias que não nos vemos. Temos novidades e condições especiais esperando por você. Que tal conversarmos?'
    },
    {
        id: 'followup',
        name: 'Acompanhamento',
        message: 'Olá {nome}! Gostaria de saber se está tudo bem com você. Estamos à disposição para atendê-lo. Precisa de algo?'
    },
    {
        id: 'promotion',
        name: 'Promoção',
        message: 'Olá {nome}! Temos condições especiais este mês! Entre em contato conosco para saber mais sobre nossas ofertas exclusivas.'
    },
    {
        id: 'custom',
        name: 'Personalizada',
        message: ''
    }
];

export function MessageModal({ isOpen, onClose, client, onSuccess }: MessageModalProps) {
    const [tipo, setTipo] = useState<'whatsapp' | 'email'>('whatsapp');
    const [selectedTemplate, setSelectedTemplate] = useState('reactivation');
    const [mensagem, setMensagem] = useState('');
    const [assunto, setAssunto] = useState('Mensagem de FRPlus');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // Process message template with variables
    const processMessage = (template: string) => {
        if (!client) return template;
        return template
            .replace('{nome}', client.nomeFantasia || client.razaoSocial)
            .replace('{dias}', client.diasInativo?.toString() || '?');
    };

    // Update message when template changes
    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId);
        const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
        if (template && templateId !== 'custom') {
            setMensagem(processMessage(template.message));
        } else {
            setMensagem('');
        }
    };

    // Send message
    const handleSend = async () => {
        if (!client || !mensagem.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/messaging/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clienteId: client.id,
                    tipo,
                    mensagem,
                    assunto: tipo === 'email' ? assunto : undefined
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setResult({ success: true, message: data.message || 'Mensagem enviada!' });
                onSuccess?.();
            } else {
                setResult({ success: false, message: data.error || 'Erro ao enviar mensagem' });
            }
        } catch {
            setResult({ success: false, message: 'Erro de conexão' });
        } finally {
            setLoading(false);
        }
    };

    // Initialize message when client changes
    useState(() => {
        if (client && isOpen) {
            handleTemplateChange('reactivation');
        }
    });

    if (!isOpen || !client) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-[#1a1a2e] rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Enviar Mensagem</h2>
                            <p className="text-sm text-gray-400">{client.nomeFantasia || client.razaoSocial}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Channel Selection */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTipo('whatsapp')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${tipo === 'whatsapp'
                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                            </button>
                            <button
                                onClick={() => setTipo('email')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${tipo === 'email'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <Mail className="h-4 w-4" />
                                Email
                            </button>
                        </div>

                        {/* Contact info */}
                        <div className="p-3 rounded-lg bg-white/5 text-sm">
                            {tipo === 'whatsapp' ? (
                                <span className="text-gray-300">
                                    <span className="text-gray-500">Para:</span> {client.celular || client.telefone}
                                </span>
                            ) : (
                                <span className="text-gray-300">
                                    <span className="text-gray-500">Para:</span> {client.email}
                                </span>
                            )}
                        </div>

                        {/* Email subject */}
                        {tipo === 'email' && (
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Assunto</label>
                                <input
                                    type="text"
                                    value={assunto}
                                    onChange={e => setAssunto(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        )}

                        {/* Template Selection */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Template</label>
                            <div className="flex flex-wrap gap-2">
                                {MESSAGE_TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleTemplateChange(template.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${selectedTemplate === template.id
                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {template.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Mensagem</label>
                            <textarea
                                value={mensagem}
                                onChange={e => setMensagem(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
                                placeholder="Digite sua mensagem..."
                            />
                        </div>

                        {/* Result message */}
                        {result && (
                            <div className={`p-3 rounded-lg text-sm ${result.success
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {result.message}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading || !mensagem.trim()}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tipo === 'whatsapp'
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Enviar
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
