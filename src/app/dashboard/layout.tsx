/* eslint-disable */
'use client';

import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2, Menu } from "lucide-react";

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/');
    }
  }, [usuario, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!usuario) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">FRPlus</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 bg-gradient-to-br from-black to-gray-900 transition-all duration-300">
        <div className="container mx-auto p-4 md:p-8 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedContent>{children}</ProtectedContent>;
}
