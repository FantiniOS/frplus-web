'use client';

import { usePathname, useRouter } from 'next/navigation';
import { FilePlus, History } from 'lucide-react';

export default function CaptacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black">
      {/* Page Content */}
      <div className="pb-20">
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 pb-safe">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => router.push('/captacao')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              pathname === '/captacao' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <FilePlus className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Novo Pedido</span>
          </button>
          
          <button
            onClick={() => router.push('/captacao/historico')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              pathname.includes('/historico') ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <History className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Histórico</span>
          </button>
        </div>
      </div>
    </div>
  );
}
