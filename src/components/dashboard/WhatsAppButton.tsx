'use client'

import { useState } from 'react'
import { MessageCircle, Loader2, AlertTriangle, X, ExternalLink, Copy, Check } from 'lucide-react'

interface WhatsAppButtonProps {
    clienteId: string
    telefone?: string
    className?: string
    size?: 'sm' | 'md'
    label?: string
}

export function WhatsAppButton({ clienteId, telefone, className = '', size = 'sm', label }: WhatsAppButtonProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{ mensagem: string; whatsappUrl: string } | null>(null)
    const [copied, setCopied] = useState(false)

    const handleClick = async () => {
        // Se já tem resultado, toggle (fecha)
        if (result) {
            setResult(null)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/ai/generate-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clienteId })
            })

            const data = await res.json()

            if (res.status === 429) {
                setError(data.error || 'Limite atingido. Aguarde 1 minuto.')
                setTimeout(() => setError(null), 6000)
                setLoading(false)
                return
            }

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar mensagem')
            }

            const rawPhone = (data.cliente?.telefone || telefone || '').trim()
            const cleanPhone = rawPhone.replace(/\D/g, '')

            if (!cleanPhone || cleanPhone.length < 10) {
                // Sem telefone — ainda mostra a mensagem para copiar manualmente
                const mensagem = data.mensagem || ''
                setResult({
                    mensagem,
                    whatsappUrl: '' // sem URL
                })
                setLoading(false)
                return
            }

            const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
            const mensagem = data.mensagem || ''
            const whatsappUrl = `https://wa.me/${phoneWithDDI}?text=${encodeURIComponent(mensagem)}`

            setResult({ mensagem, whatsappUrl })

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido'
            setError(msg)
            setTimeout(() => setError(null), 5000)
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        if (result?.mensagem) {
            navigator.clipboard.writeText(result.mensagem)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

    return (
        <div className="relative">
            <button
                onClick={handleClick}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait ${result
                        ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500/40'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    } ${size === 'sm' ? 'p-2' : 'px-3 py-2'} ${className}`}
                title={result ? 'Fechar mensagem' : 'Gerar mensagem IA e enviar via WhatsApp'}
            >
                {loading ? (
                    <Loader2 className={`${iconSize} animate-spin`} />
                ) : (
                    <MessageCircle className={iconSize} />
                )}
                {label && <span className="text-xs font-medium">{label}</span>}
            </button>

            {/* Card com mensagem gerada */}
            {result && (
                <div className="absolute right-0 top-full mt-2 z-[100] w-[340px] sm:w-[400px]">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-green-500/10 border-b border-white/5">
                            <span className="text-xs font-medium text-green-400 flex items-center gap-1.5">
                                <MessageCircle className="w-3 h-3" />
                                Mensagem Gerada por IA
                            </span>
                            <button onClick={() => setResult(null)} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                                <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                        </div>

                        {/* Mensagem */}
                        <div className="p-3 max-h-[200px] overflow-y-auto">
                            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{result.mensagem}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 p-3 pt-0">
                            <button
                                onClick={handleCopy}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-xs font-medium"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copiado!' : 'Copiar'}
                            </button>

                            {result.whatsappUrl ? (
                                <a
                                    href={result.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors text-xs font-medium"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Enviar WhatsApp
                                </a>
                            ) : (
                                <span className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Sem telefone
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast de erro */}
            {error && (
                <div className="fixed top-4 right-4 z-[200] max-w-sm">
                    <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-xl rounded-xl p-4 shadow-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-300">Erro no WhatsApp IA</p>
                            <p className="text-xs text-red-400/80 mt-1">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="p-1 rounded hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
