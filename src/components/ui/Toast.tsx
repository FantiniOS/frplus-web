import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    isVisible?: boolean;
    onClose: () => void;
}

export function Toast({ message, type, isVisible = true, onClose }: ToastProps) {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-md"
                >
                    <div className={`rounded-full p-1 ${type === 'success' ? 'bg-green-500/20 text-green-500' :
                        type === 'error' ? 'bg-red-500/20 text-red-500' :
                            'bg-blue-500/20 text-blue-500'
                        }`}>
                        {type === 'success' && <CheckCircle className="h-4 w-4" />}
                        {type === 'error' && <AlertCircle className="h-4 w-4" />}
                        {type === 'info' && <Info className="h-4 w-4" />}
                    </div>

                    <span className="font-medium pr-2">{message}</span>

                    <button
                        onClick={onClose}
                        className="ml-2 rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
