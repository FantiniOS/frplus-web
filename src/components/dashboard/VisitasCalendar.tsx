'use client';

import { useState, useEffect } from "react";
import { getVisitasDoMes, agendarVisita, excluirVisita, atualizarVisita, marcarVisitaConcluida } from "@/app/actions/visitas";
import { Calendar, ChevronLeft, ChevronRight, MessageSquareCode, Clock, MapPin, Search, Plus, X, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createPortal } from "react-dom";

interface Visita {
  id: string;
  clienteId: string;
  dataVisita: Date;
  observacoes: string | null;
  status: string;
  cliente: {
    nomeFantasia: string;
    razaoSocial: string;
    telefone: string;
    celular: string;
  }
}

interface VisitasCalendarProps {
  year: number;
  month: number;
  clientes?: { id: string; nomeFantasia?: string | null; razaoSocial: string }[];
}

export function VisitasCalendar({ year, month, clientes = [] }: VisitasCalendarProps) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());

  const [showAddVisita, setShowAddVisita] = useState(false);
  const [editingVisitaId, setEditingVisitaId] = useState<string | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [hora, setHora] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadVisitas = async () => {
    setLoading(true);
    const res = await getVisitasDoMes(year, month);
    if (res.success && res.visitas) {
      setVisitas(res.visitas as unknown as Visita[]); // Handling Prisma date conversion
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVisitas();
  }, [year, month]);

  const handleAgendarVisita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !hora || !selectedDate) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      const datePart = new Date(year, month, selectedDate);
      const [hours, minutes] = hora.split(':').map(Number);
      datePart.setHours(hours, minutes, 0, 0);

      let res;
      if (editingVisitaId) {
        res = await atualizarVisita(editingVisitaId, {
          dataVisita: datePart,
          observacoes: observacoes || undefined,
        });
      } else {
        res = await agendarVisita({
          clienteId: selectedClienteId,
          dataVisita: datePart,
          observacoes: observacoes || undefined,
        });
      }

      if (res.success) {
        closeModal();
        loadVisitas();
      } else {
        alert("Erro ao salvar visita: " + res.error);
      }
    } catch (err) {
      alert("Erro inesperado ao salvar visita.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (v: Visita) => {
    setEditingVisitaId(v.id);
    setSelectedClienteId(v.clienteId);
    setHora(new Date(v.dataVisita).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setObservacoes(v.observacoes || "");
    setShowAddVisita(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja excluir esta visita?')) {
      const res = await excluirVisita(id);
      if (res.success) {
        loadVisitas();
      } else {
        alert("Erro ao excluir visita.");
      }
    }
  };

  const handleConcluir = async (id: string) => {
    const res = await marcarVisitaConcluida(id);
    if (res.success) {
      loadVisitas();
    } else {
      alert("Erro ao marcar visita como concluída.");
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowAddVisita(false);
    setEditingVisitaId(null);
    setSelectedClienteId("");
    setHora("");
    setObservacoes("");
  };

  // Calendar logic
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => null);
  
  const allDays = [...paddingDays, ...days];
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Map to group visits by day quickly
  const visitasByDay = new Map<number, Visita[]>();
  visitas.forEach(v => {
    const d = new Date(v.dataVisita);
    // Ensure we match the local day by forcing timezone or just getting UTC date safely if dates were saved as UTC
    // Since input type="datetime-local" is local, let's just extract the date
    const day = d.getDate();
    if (!visitasByDay.has(day)) visitasByDay.set(day, []);
    visitasByDay.get(day)!.push(v);
  });

  const selectedVisitas = selectedDate ? (visitasByDay.get(selectedDate) || []) : [];

  const handleWhatsApp = (phone: string, nome: string, horario: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (finalPhone.length === 11) finalPhone = `55${finalPhone}`;
    else if (finalPhone.length === 10) finalPhone = `55${finalPhone}`;
    
    const text = encodeURIComponent(`Olá ${nome}, confirmo nossa visita agendada para hoje às ${horario}.`);
    window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-5 shadow-xl shadow-black/30 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-emerald-500/15">
          <Calendar className="h-4 w-4 text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-white/90">Calendário de Visitas</h3>
        <span className="text-[10px] text-gray-600 ml-auto capitalize">
          {new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 h-full min-h-0">
          {/* Calendar Grid */}
          <div className="mb-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1 uppercase">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {allDays.map((day, i) => {
                if (day === null) {
                  return <div key={`padding-${i}`} className="h-8" />;
                }

                const hasVisitas = visitasByDay.has(day);
                const isSelected = selectedDate === day;
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative h-8 w-full rounded-md flex items-center justify-center text-xs font-medium transition-all duration-200
                      ${isSelected ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                      ${isToday && !isSelected ? 'border border-emerald-500/30 text-emerald-400' : ''}
                    `}
                  >
                    {day}
                    {hasVisitas && (
                      <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px w-full bg-white/[0.04] mb-4" />

          {/* Selected Day Details */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-[120px] custom-scrollbar">
            {selectedDate && (
              <div className="space-y-3">
                <div className="sticky top-0 bg-[#0c1221] py-1 z-10 flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {new Date(year, month, selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h4>
                  <button
                    onClick={() => {
                        setEditingVisitaId(null);
                        setSelectedClienteId("");
                        setHora("");
                        setObservacoes("");
                        setShowAddVisita(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agendar Visita
                  </button>
                </div>
                
                {selectedVisitas.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">Nenhuma visita agendada</p>
                ) : (
                  <div className="space-y-2 pb-2">
                    {selectedVisitas.map(v => {
                      const timeStr = new Date(v.dataVisita).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const clientName = v.cliente.nomeFantasia || v.cliente.razaoSocial;
                      const phone = v.cliente.celular || v.cliente.telefone;

                      return (
                        <div key={v.id} className={`group relative rounded-lg border border-white/[0.04] p-3 transition-colors overflow-hidden ${v.status === 'REALIZADA' ? 'bg-white/[0.01]' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                           {/* Status Indicator Bar */}
                           <div className={`absolute left-0 top-0 bottom-0 w-1 ${v.status === 'REALIZADA' ? 'bg-gray-500/30' : 'bg-emerald-500/50'}`} />
                          
                          <div className={`flex items-start justify-between pl-2 ${v.status === 'REALIZADA' ? 'opacity-50' : ''}`}>
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${v.status === 'REALIZADA' ? 'text-gray-400 bg-gray-500/10 line-through' : 'text-emerald-400 bg-emerald-500/10'}`}>
                                  {timeStr}
                                </span>
                                <p className={`text-sm font-medium truncate ${v.status === 'REALIZADA' ? 'text-gray-400 line-through' : 'text-white/90'}`}>
                                  {clientName}
                                </p>
                                {v.status === 'REALIZADA' && (
                                  <span className="inline-block text-[10px] bg-emerald-500/10 text-emerald-400/80 font-medium px-2 py-0.5 rounded-full no-underline ml-1">
                                    Concluído
                                  </span>
                                )}
                              </div>
                              {v.observacoes && (
                                <p className={`text-[10px] mt-1.5 line-clamp-2 pl-1 italic border-l ${v.status === 'REALIZADA' ? 'text-gray-600 border-gray-600/30' : 'text-gray-500 border-white/10'}`}>
                                  "{v.observacoes}"
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {v.status !== 'REALIZADA' && (
                                <button
                                  onClick={() => handleConcluir(v.id)}
                                  className="flex-shrink-0 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm group-hover:shadow-emerald-500/20"
                                  title="Marcar como Concluída"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEditClick(v)}
                                className="flex-shrink-0 p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all shadow-sm group-hover:shadow-blue-500/20"
                                title="Editar Visita"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="flex-shrink-0 p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all shadow-sm group-hover:shadow-red-500/20"
                                title="Excluir Visita"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              {phone && (
                                <button
                                  onClick={() => handleWhatsApp(phone, clientName, timeStr)}
                                  className="flex-shrink-0 p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-all shadow-sm group-hover:shadow-[#25D366]/20"
                                  title="Falar no WhatsApp"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Agendamento */}
      {showAddVisita && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeModal}>
          <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] p-6 shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">{editingVisitaId ? 'Editar Visita' : 'Agendar Visita'}</h2>
              <button 
                type="button"
                onClick={closeModal} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleAgendarVisita} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Data da Visita</label>
                <input
                  type="text"
                  value={selectedDate ? new Date(year, month, selectedDate).toLocaleDateString('pt-BR') : ''}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white cursor-not-allowed opacity-70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Cliente *</label>
                <select
                  value={selectedClienteId}
                  onChange={e => setSelectedClienteId(e.target.value)}
                  className={`w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 appearance-none ${editingVisitaId ? 'opacity-70 cursor-not-allowed' : ''}`}
                  required
                  disabled={!!editingVisitaId}
                >
                  <option value="" disabled>Selecione um cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nomeFantasia && c.nomeFantasia.trim() !== '' ? c.nomeFantasia : c.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Horário *</label>
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 appearance-none [color-scheme:dark]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 min-h-[100px] resize-none"
                  placeholder="Assuntos para a reunião, metas, etc."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? 'Salvando...' : editingVisitaId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

    </div>
  );
}
