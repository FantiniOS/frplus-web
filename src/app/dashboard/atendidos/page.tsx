'use client';

import { useState, useEffect } from 'react';
import { Download, Search, Briefcase, Calendar } from 'lucide-react';
import { getClientesAtendidos, ClienteAtendido } from '@/app/actions/atendidos';

export default function AtendidosPage() {
  const [clientes, setClientes] = useState<ClienteAtendido[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<ClienteAtendido[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarClientes();
  }, []);

  useEffect(() => {
    let filtrados = clientes;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtrados = filtrados.filter(
        (c) =>
          c.cliente.toLowerCase().includes(lowerSearch) ||
          c.cidade.toLowerCase().includes(lowerSearch)
      );
    }
    setFilteredClientes(filtrados);
  }, [searchTerm, clientes]);

  const carregarClientes = async () => {
    try {
      setLoading(true);
      const data = await getClientesAtendidos();
      setClientes(data);
      setFilteredClientes(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar a lista de clientes atendidos.');
    } finally {
      setLoading(false);
    }
  };

  const formataData = (data: Date | null | string) => {
    if (!data) return '-';
    const d = new Date(data);
    return new Intl.DateTimeFormat('pt-BR').format(d);
  };

  const exportarExcelCSV = () => {
    if (filteredClientes.length === 0) return;

    const cabecalho = ['Cliente', 'CNPJ', 'Cidade', 'Parceiro Desde'];
    const linhas = filteredClientes.map(c => [
      `"${c.cliente.replace(/"/g, '""')}"`,
      `"${c.cnpj}"`,
      `"${c.cidade.replace(/"/g, '""')}"`,
      `"${formataData(c.parceiroDesde)}"`
    ]);

    const csvContent = [
      cabecalho.join(';'),
      ...linhas.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clientes_Atendidos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-full flex-col p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto overflow-y-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30">
              <Briefcase className="h-6 w-6 text-emerald-400" />
            </span>
            Clientes Atendidos
          </h1>
          <p className="mt-2 text-gray-400">
            Acompanhe o histórico de prospecção e a base consolidada de clientes com pedidos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-moderned w-full sm:w-[300px]"
            />
          </div>
          <button 
            onClick={exportarExcelCSV}
            disabled={loading || filteredClientes.length === 0}
            className="btn-moderned text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 font-medium disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* METRICS OR SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card-modern p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <Briefcase className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Total Atendidos</p>
            <p className="text-2xl font-bold text-white">{clientes.length}</p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="card-modern flex flex-col flex-1 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="mt-4 animate-pulse">Carregando carteira de clientes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/5 border-b border-white/10 sticky top-0 z-10 font-medium text-gray-300">
                <tr>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">CNPJ</th>
                  <th className="px-6 py-4">Cidade</th>
                  <th className="px-6 py-4">Parceiro Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Nenhum cliente atendido encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-medium text-white">
                        {cliente.cliente}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {cliente.cnpj}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {cliente.cidade}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-500/70" />
                          <span>{formataData(cliente.parceiroDesde)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
