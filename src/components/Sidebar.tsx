/* eslint-disable */
'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { getPerfilEmpresa } from "@/app/actions/perfilEmpresa";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  FileText,
  Settings,
  LogOut,
  BarChart3,
  Lightbulb,
  Wallet,
  Filter,
  UserPlus,
  UserCog,
  ChevronDown,
  Truck
} from "lucide-react";
import NextImage from "next/image";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { usuario, logout, isAdmin, isIndustria } = useAuth();
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("");
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTipo = searchParams.get('tipo');

  useEffect(() => {
    getPerfilEmpresa().then(data => setNomeEmpresa(data.nomeEmpresa));
  }, []);

  // Auto expand on load
  useEffect(() => {
    if (pathname?.includes('/dashboard/relatorios')) {
      setRelatoriosOpen(true);
    }
  }, [pathname]);

  const menuGroups = [
    {
      title: "Principal",
      items: [
        { icon: LayoutDashboard, label: "Visão Geral", href: "/dashboard", exact: true },
        { icon: Lightbulb, label: "Inteligência", href: "/dashboard/ai-insights" },
      ]
    },
    {
      title: "Cadastros",
      items: [
        { icon: Users, label: "Clientes", href: "/dashboard/clientes" },
        { icon: UserPlus, label: "Futuros Clientes", href: "/dashboard/prospects" },
        { icon: ShoppingBag, label: "Produtos", href: "/dashboard/produtos" },
        { icon: UserCog, label: "Vendedores", href: "/dashboard/vendedores" },
      ]
    },
    {
      title: "Gestão",
      items: [
        { icon: FileText, label: "Pedidos", href: "/dashboard/pedidos" },
        { icon: Truck, label: "Montagem de Cargas", href: "/dashboard/cargas" },
        { icon: Wallet, label: "Controle de Verbas", href: "/dashboard/verbas" },
        { icon: Filter, label: "Curva ABC", href: "/dashboard/curva-abc" },
      ]
    },
  ];

  const relatoriosSubItems = [
    { label: "Vendas", href: "/dashboard/relatorios" }, // Defualt tab on /dashboard/relatorios is 'vendas'
    { label: "Produtos", href: "/dashboard/relatorios?tipo=produtos" },
    { label: "Relatório Clientes", href: "/dashboard/relatorios?tipo=clientes" },
    { label: "Tabela de Preços", href: "/dashboard/relatorios?tipo=tabela" },
    { label: "Clientes Atendidos", href: "/dashboard/relatorios?tipo=atendidos" },
    { label: "Vendas por Cliente", href: "/dashboard/relatorios/vendas-cliente" },
    { label: "Comissões", href: "/dashboard/relatorios/comissoes" },
  ];

  const isItemActive = (href: string, exact?: boolean) => {
    // If exact, simple match
    if (exact) return pathname === href;
    
    // Check if it's a search param link
    if (href.includes('?tipo=')) {
      const tipo = href.split('?tipo=')[1];
      return pathname === '/dashboard/relatorios' && currentTipo === tipo;
    }
    
    // Check main relatorios link (defaults to vendas without specific ?tipo)
    if (href === '/dashboard/relatorios') {
      return pathname === '/dashboard/relatorios' && (!currentTipo || currentTipo === 'vendas');
    }

    return pathname?.includes(href);
  };

  const isRelatoriosParentActive = pathname?.includes('/dashboard/relatorios');

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`group fixed left-0 top-0 z-50 h-screen border-r border-white/10 bg-black text-white transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} md:translate-x-0 lg:w-20 lg:overflow-x-hidden xl:w-64 hover:w-64`}>
        <div className="flex h-full flex-col px-3 py-4">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center px-4 justify-center py-2 h-24 overflow-hidden">
            <div className="flex lg:hidden xl:flex group-hover:flex flex-col items-center">
            <NextImage
              src="/logo.png"
              alt="Logo"
              width={180}
              height={80}
              className="w-auto h-auto max-w-[180px] max-h-24 object-contain"
              unoptimized
            />
            {nomeEmpresa && (
              <div className="text-center mt-[-6px]">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                  {nomeEmpresa}
                </span>
              </div>
            )}
          </div>
            <div className="hidden lg:flex xl:hidden group-hover:hidden items-center justify-center font-bold text-2xl text-blue-500 h-full">FR</div>
          </div>

          {/* Menu Principal */}
          <nav className="flex-1 space-y-6 overflow-y-auto">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block lg:hidden xl:block group-hover:block whitespace-nowrap">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors overflow-hidden ${
                          active 
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <item.icon className={`flex-shrink-0 mr-3 h-5 w-5 ${active ? "text-white" : "text-gray-400"}`} />
                        <span className="block lg:hidden xl:block group-hover:block whitespace-nowrap overflow-hidden transition-opacity duration-300">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Relatórios (Menu Expansível Principal) */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block lg:hidden xl:block group-hover:block whitespace-nowrap">
                Relatórios e Análises
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setRelatoriosOpen(!relatoriosOpen)}
                  className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isRelatoriosParentActive 
                      ? "bg-white/5 text-white" 
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center">
                    <BarChart3 className={`flex-shrink-0 mr-3 h-5 w-5 ${isRelatoriosParentActive ? "text-white" : "text-gray-400"}`} />
                    <span className="block lg:hidden xl:block group-hover:block whitespace-nowrap overflow-hidden">Relatórios</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${relatoriosOpen ? 'rotate-180' : ''} block lg:hidden xl:block group-hover:block flex-shrink-0`} />
                </button>
                
                <div 
                  className={`grid transition-all duration-300 ease-in-out ${
                    relatoriosOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-8 mt-1 mb-1 space-y-1 border-l border-white/[0.06] pl-3 py-0.5">
                      {relatoriosSubItems.map((sub) => {
                        const active = isItemActive(sub.href);
                        return (
                          <button
                            key={sub.href}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(sub.href);
                              if (onClose) onClose();
                            }}
                            className={`w-full text-left block rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                              active 
                                ? "bg-blue-600/20 text-blue-400 border border-blue-500/10" 
                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* User Info & Footer */}
          <div className="border-t border-white/10 pt-4 mt-6 space-y-2">
            {usuario && (
              <div className="px-3 py-2 rounded-lg bg-white/5 mb-2 block lg:hidden xl:block group-hover:block whitespace-nowrap overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{usuario.nome}</p>
                <p className="text-xs text-gray-500">{usuario.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
              </div>
            )}

            <Link
              href="/dashboard/configuracoes"
              onClick={onClose}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors overflow-hidden ${
                isItemActive("/dashboard/configuracoes", true)
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Settings className={`flex-shrink-0 mr-3 h-5 w-5 ${isItemActive("/dashboard/configuracoes", true) ? "text-white" : "text-gray-400"}`} />
              <span className="block lg:hidden xl:block group-hover:block whitespace-nowrap overflow-hidden">Configurações</span>
            </Link>
            <button
              onClick={() => {
                logout();
                if (onClose) onClose();
              }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors overflow-hidden"
            >
              <LogOut className="flex-shrink-0 mr-3 h-5 w-5" />
              <span className="block lg:hidden xl:block group-hover:block whitespace-nowrap overflow-hidden">Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}