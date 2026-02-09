/* eslint-disable */
'use client';

import { Search, Plus, MoreHorizontal, MapPin, Filter, Trash2, Edit, ChevronDown, ChevronUp, User, FileText } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export default function ClientesPage() {
  const { clients, removeClient } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      removeClient(deleteId);
      setDeleteId(null);
    }
  };

  const filteredClients = clients.filter(client =>
    (client.nomeFantasia || client.razaoSocial || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj.includes(searchTerm) ||
    client.cidade.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => (a.nomeFantasia || a.razaoSocial || '').localeCompare(b.nomeFantasia || b.razaoSocial || ''));

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">

      {/* Cabeçalho da Página */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Minha Carteira</h1>
          <p className="text-sm text-gray-400">Gerencie seus {clients.length} clientes.</p>
        </div>
        <Link href="/dashboard/clientes/novo">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </button>
        </Link>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Tabela de Clientes (Data Grid) */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-gray-400">
            <tr>
              <th className="w-10 px-4 py-4"></th>
              <th className="px-6 py-4 font-medium">Cliente</th>
              <th className="px-6 py-4 font-medium hidden md:table-cell">Status</th>
              <th className="px-6 py-4 font-medium hidden md:table-cell">Localização</th>
              <th className="px-6 py-4 font-medium hidden md:table-cell">Última Compra</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredClients.map((cliente) => (
              <>
                <motion.tr
                  key={cliente.id}
                  className="group hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setExpandedClientId(expandedClientId === cliente.id ? null : cliente.id)}
                  variants={item}
                >
                  <td className="px-4 py-4">
                    <div className="p-1 rounded bg-blue-500/10 w-fit">
                      {expandedClientId === cliente.id ? (
                        <ChevronUp className="h-4 w-4 text-blue-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                  </td>

                  {/* Coluna Nome/CNPJ */}
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{cliente.nomeFantasia || cliente.razaoSocial}</div>
                    <div className="text-xs text-gray-500">{cliente.cnpj}</div>
                  </td>

                  {/* Coluna Status */}
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${(cliente.status || 'Ativo') === 'Ativo'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : cliente.status === 'Inativo'
                        ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                      {cliente.status || 'Ativo'}
                    </span>
                  </td>

                  {/* Coluna Localização */}
                  <td className="px-6 py-4 text-gray-300 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      {cliente.cidade}
                    </div>
                  </td>

                  {/* Coluna Última Compra */}
                  <td className="px-6 py-4 text-gray-300 hidden md:table-cell">
                    {cliente.ultima_compra ? new Date(cliente.ultima_compra).toLocaleDateString() : '-'}
                  </td>

                  {/* Ações */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteId(cliente.id)}
                        className="rounded p-2 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Excluir Cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={`/dashboard/clientes/${cliente.id}`}>
                        <button className="rounded p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Editar Cliente">
                          <Edit className="h-4 w-4" />
                        </button>
                      </Link>
                    </div>
                  </td>
                </motion.tr>

                {/* Expanded Detail Row */}
                {expandedClientId === cliente.id && (
                  <tr className="bg-white/5">
                    <td colSpan={6} className="p-0">
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm"
                      >
                        {/* Contato */}
                        <div className="space-y-3">
                          <h4 className="text-gray-500 text-xs uppercase font-medium flex items-center gap-2">
                            <User className="h-4 w-4" /> Contato
                          </h4>
                          <div>
                            <p className="text-gray-400 text-xs">Email</p>
                            <p className="text-white">{cliente.email}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Telefone / Celular</p>
                            <p className="text-white">
                              {cliente.telefone} {cliente.celular ? `/ ${cliente.celular}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Endereço */}
                        <div className="space-y-3">
                          <h4 className="text-gray-500 text-xs uppercase font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> Endereço
                          </h4>
                          <div>
                            <p className="text-white">
                              {cliente.endereco}, {cliente.numero}
                            </p>
                            <p className="text-gray-400">
                              {cliente.bairro} - {cliente.cidade}/{cliente.estado}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">CEP: {cliente.cep}</p>
                          </div>
                        </div>

                        {/* Fiscal / Extra */}
                        <div className="space-y-3">
                          <h4 className="text-gray-500 text-xs uppercase font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Dados Fiscais
                          </h4>
                          <div>
                            <p className="text-gray-400 text-xs">Razão Social</p>
                            <p className="text-white">{cliente.razaoSocial}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Inscrição Estadual</p>
                            <p className="text-white">{cliente.inscricaoEstadual || 'Isento'}</p>
                          </div>
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
