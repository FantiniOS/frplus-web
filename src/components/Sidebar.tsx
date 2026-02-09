/* eslint-disable */
'use client';

import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  FileText,
  Settings,
  LogOut,
  Factory,
  BarChart3,
  Shield,
  Lightbulb,
  MessageCircle
} from "lucide-react";
import NextImage from "next/image";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { usuario, logout, isAdmin } = useAuth();

  const menuGroups = [
    {
      title: "Principal",
      items: [
        { icon: LayoutDashboard, label: "Visão Geral", href: "/dashboard" },
        { icon: Lightbulb, label: "Inteligência", href: "/dashboard/ai-insights" },
      ]
    },
    {
      title: "Cadastros",
      items: [
        { icon: Users, label: "Clientes", href: "/dashboard/clientes" },
        { icon: ShoppingBag, label: "Produtos", href: "/dashboard/produtos" },
        { icon: Factory, label: "Fábricas", href: "/dashboard/fabricas" },
      ]
    },
    {
      title: "Gestão",
      items: [
        { icon: FileText, label: "Pedidos", href: "/dashboard/pedidos" },
        { icon: BarChart3, label: "Relatórios", href: "/dashboard/relatorios" },
        { icon: MessageCircle, label: "WhatsApp", href: "/dashboard/whatsapp" },
      ]
    },
  ];

  // Add admin-only menu
  if (isAdmin) {
    menuGroups.push({
      title: "Administração",
      items: [
        { icon: Shield, label: "Usuários", href: "/dashboard/usuarios" },
      ]
    });
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/10 bg-black text-white transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex h-full flex-col px-3 py-4">
          {/* Logo */}
          <div className="mb-8 flex items-center px-4 justify-center">
            <NextImage
              src="/logo.png"
              alt="Logo"
              width={180}
              height={80}
              className="w-auto h-auto max-w-[180px] max-h-24 object-contain"
              unoptimized
            />
          </div>

          {/* Menu Principal */}
          <nav className="flex-1 space-y-6 overflow-y-auto">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <item.icon className="mr-3 h-5 w-5 text-gray-400" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User Info & Footer */}
          <div className="border-t border-white/10 pt-4 space-y-2">
            {usuario && (
              <div className="px-3 py-2 rounded-lg bg-white/5">
                <p className="text-sm font-medium text-white truncate">{usuario.nome}</p>
                <p className="text-xs text-gray-500">{usuario.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
              </div>
            )}

            <Link
              href="/dashboard/configuracoes"
              onClick={onClose}
              className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <Settings className="mr-3 h-5 w-5 text-gray-400" />
              Configurações
            </Link>
            <button
              onClick={() => {
                logout();
                if (onClose) onClose();
              }}
              className="mt-1 flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}