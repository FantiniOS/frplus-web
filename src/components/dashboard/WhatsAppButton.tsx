'use client'

import { useState } from 'react'
import { MessageCircle, Loader2, AlertTriangle, X } from 'lucide-react'

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

    const handleClick = async () => {
        setLoading(true)
        setError(null)

        try {
            // 1. Chamar a rota de IA para gerar a mensagem
            const res = await fetch('/api/ai/generate-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clienteId })
            })

            const data = await res.json()

            // Tratamento de rate limit (429)
            if (res.status === 429) {
                setError(data.error || 'Limite atingido. Aguarde 1 minuto.')
                setTimeout(() => setError(null), 6000)
                setLoading(false)
                return
            }

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar mensagem')
            }

            // 2. Pegar o telefone (da resposta da API ou das props)
            const phoneNumber = data.cliente?.telefone || telefone
            if (!phoneNumber) {
                setError('Cliente sem telefone cadastrado.')
                setTimeout(() => setError(null), 5000)
                setLoading(false)
                return
            }

            // 3. Limpar o telefone: remover parênteses, traços, espaços
            const cleanPhone = phoneNumber.replace(/\D/g, '')

            // 4. Garantir DDI do Brasil (55)
            const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

            // 5. Abrir WhatsApp com a mensagem gerada
            const mensagem = data.mensagem || ''
            const whatsappUrl = `https://wa.me/${phoneWithDDI}?text=${encodeURIComponent(mensagem)}`
            window.open(whatsappUrl, '_blank')

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido'
            setError(msg)
            setTimeout(() => setError(null), 5000)
        } finally {
            setLoading(false)
        }
    }

    const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

    return (
        <>
            <button
                onClick={handleClick}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait ${size === 'sm' ? 'p-2' : 'px-3 py-2'
                    } ${className}`}
                title="Gerar mensagem IA e enviar via WhatsApp"
            >
                {loading ? (
                    <Loader2 className={`${iconSize} animate-spin`} />
                ) : (
                    <MessageCircle className={iconSize} />
                )}
                {label && <span className="text-xs font-medium">{label}</span>}
            </button>

            {/* Toast de erro flutuante */}
            {error && (
                <div className="fixed top-4 right-4 z-[200] max-w-sm animate-in slide-in-from-top-2 fade-in duration-300">
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
        </>
    )
}
