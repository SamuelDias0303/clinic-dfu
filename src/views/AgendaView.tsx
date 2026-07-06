import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Appointment } from '../types';
import { appointmentService } from '../services/appointmentService';
import { useAuth } from '../contexts/AuthContext';
import AppointmentFormModal from '../components/AppointmentFormModal';
import DeleteAppointmentModal from '../components/DeleteAppointmentModal';

const hours = Array.from({ length: 14 }, (_, index) => `${String(index + 7).padStart(2, '0')}:00`);
const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface AppointmentCardProps {
  key?: React.Key;
  appointment: Appointment;
  onEdit: () => void;
  onDelete: () => void;
  showTherapist?: boolean;
}

function AppointmentCard({ appointment, onEdit, onDelete, showTherapist }: AppointmentCardProps) {
  const statusClass = appointment.status === 'CONCLUÍDO'
    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
    : appointment.status === 'EM ANDAMENTO'
      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
      : appointment.status === 'CANCELADO'
        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400';

  return (
    <div
      className={`z-10 flex w-full cursor-pointer flex-col justify-between rounded-lg border p-1.5 text-[9px] shadow-sm transition-all hover:scale-[1.02] active:scale-95 lg:p-2 lg:text-[10px] ${statusClass}`}
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      <div className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-1">
          <div className="truncate font-bold leading-tight">{appointment.patientName}</div>
          {appointment.recurrence && appointment.recurrence !== 'NONE' && (
            <div className="size-1.5 shrink-0 rounded-full bg-current opacity-50" title="Recorrente" />
          )}
        </div>
        <div className="mt-0.5 truncate font-medium opacity-80">{appointment.type}</div>
        {showTherapist && (
          <div className="mt-0.5 truncate text-[8px] italic opacity-70">T: {appointment.therapistName}</div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-bold tabular-nums">{appointment.time}</span>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-rose-600 transition-colors hover:bg-white/50 dark:hover:bg-black/20 lg:opacity-0 lg:group-hover/slot:opacity-100 lg:focus:opacity-100"
          title="Excluir"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function AgendaView() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; appointment?: Appointment }>({ isOpen: false });
  const [viewMode, setViewMode] = useState<'WEEK' | 'DAY'>(window.innerWidth < 1024 ? 'DAY' : 'WEEK');

  useEffect(() => {
    const filterId = user?.activeRole === 'TERAPEUTA' ? user.email : undefined;
    const whitelabelId = user?.activeWhitelabelId;

    const unsubscribe = appointmentService.subscribeToAppointments((data) => {
      setAppointments(data);
      setLoading(false);
    }, filterId, whitelabelId);

    return () => unsubscribe();
  }, [user]);

  const getStartOfWeek = (date: Date) => {
    const next = new Date(date);
    next.setDate(next.getDate() - next.getDay());
    return next;
  };

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    return date;
  });

  const handleCreateAppointment = async (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    await appointmentService.createAppointment(data, user?.activeWhitelabelId);
  };

  const handleUpdateAppointment = async (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    if (editingAppointment?.id) {
      await appointmentService.updateAppointment(editingAppointment.id, data, user?.activeWhitelabelId);
    }
  };

  const handleDeleteAppointment = (appointment: Appointment) => {
    if (!appointment.id) {
      alert('Erro: ID do agendamento não encontrado.');
      return;
    }
    setConfirmDelete({ isOpen: true, appointment });
  };

  const executeDeleteSingle = async () => {
    const id = confirmDelete.appointment?.id;
    if (!id) return;

    try {
      await appointmentService.deleteAppointment(id, user?.activeWhitelabelId);
      setConfirmDelete({ isOpen: false });
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      alert('Erro ao excluir agendamento: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const executeDeleteSeries = async () => {
    const recurrenceId = confirmDelete.appointment?.recurrenceId;
    if (!recurrenceId) return;

    try {
      await appointmentService.deleteRecurrence(recurrenceId, user?.activeWhitelabelId);
      setConfirmDelete({ isOpen: false });
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error deleting recurrence series:', error);
      alert('Erro ao excluir série de agendamentos: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const openNewAppointment = (date: Date, time: string) => {
    setSelectedSlot({ date: formatDateLocal(date), time });
    setEditingAppointment(undefined);
    setIsModalOpen(true);
  };

  const getAppointmentsForSlot = (date: Date, hour: string) => {
    const dateStr = formatDateLocal(date);
    const hourPrefix = hour.substring(0, 2);
    return appointments.filter(appointment => appointment.date === dateStr && appointment.time.startsWith(hourPrefix));
  };

  const movePeriod = (direction: 1 | -1) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + (viewMode === 'WEEK' ? 7 * direction : direction));
    date.setHours(0, 0, 0, 0);
    setCurrentDate(date);
  };

  const goToToday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    setCurrentDate(date);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="font-medium text-slate-500 dark:text-slate-400">Carregando sua agenda...</p>
      </div>
    );
  }

  const calendarGridClass = viewMode === 'WEEK'
    ? 'grid-cols-[72px_repeat(7,minmax(92px,1fr))]'
    : 'grid-cols-[60px_minmax(0,1fr)]';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 space-y-4 lg:space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-2xl">Agenda</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 lg:text-sm">Gerencie seus horários em tempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {(['DAY', 'WEEK'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded px-3 py-1.5 text-[10px] font-bold transition-all lg:text-xs ${
                  viewMode === mode
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {mode === 'DAY' ? 'Dia' : 'Semana'}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button onClick={() => movePeriod(-1)} className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 lg:p-1.5" title="Anterior">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToToday} className={`px-2 text-[10px] font-bold transition-colors lg:px-3 lg:text-xs ${currentDate.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-slate-600 hover:text-primary dark:text-slate-400'}`}>
              Hoje
            </button>
            <button onClick={() => movePeriod(1)} className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 lg:p-1.5" title="Próximo">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="hidden min-w-[140px] items-center justify-center md:flex">
            <span className="text-sm font-bold capitalize text-slate-700 dark:text-slate-300">{formatMonthYear(currentDate)}</span>
          </div>

          <button
            onClick={() => {
              setEditingAppointment(undefined);
              setSelectedSlot(null);
              setIsModalOpen(true);
            }}
            className="ml-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:ml-0 lg:px-4 lg:text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Novo Agendamento</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <span className="text-sm font-bold capitalize text-slate-900 dark:text-white">
          {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <CalendarIcon size={18} className="text-primary" />
      </div>

      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
          <div className={viewMode === 'WEEK' ? 'w-[720px] lg:w-full' : 'w-full min-w-0'}>
            <div className={`grid ${calendarGridClass} border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50`}>
              <div className="flex items-center justify-center border-r border-slate-100 p-3 dark:border-slate-800 lg:p-4">
                <Clock size={16} className="text-slate-400" />
              </div>
              {viewMode === 'WEEK' ? (
                weekDays.map((date, index) => (
                  <div key={date.toISOString()} className={`border-r border-slate-100 p-2 text-center dark:border-slate-800 lg:p-4 ${date.toDateString() === new Date().toDateString() ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                    <div className="truncate text-[8px] font-bold uppercase tracking-wider text-slate-400 lg:text-[10px]">{dayNames[index].substring(0, 3)}</div>
                    <div className={`text-xs font-bold lg:text-sm ${date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{date.getDate()}</div>
                  </div>
                ))
              ) : (
                <div className="border-r border-slate-100 bg-primary/5 p-3 pl-4 text-left dark:border-slate-800 dark:bg-primary/10 lg:p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {currentDate.toDateString() === new Date().toDateString() ? 'Hoje' : dayNames[currentDate.getDay()]}
                  </div>
                  <div className="text-sm font-bold text-primary">{currentDate.getDate()} de {formatMonthYear(currentDate)}</div>
                </div>
              )}
            </div>

            <div className="max-h-[calc(100vh-320px)] overflow-y-auto lg:max-h-[600px]">
              {hours.map(hour => (
                <div key={hour} className={`group grid ${calendarGridClass} border-b border-slate-50 dark:border-slate-800`}>
                  <div className="border-r border-slate-100 bg-slate-50/30 p-3 text-center text-[10px] font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-800/30 lg:p-4 lg:text-xs">
                    {hour}
                  </div>
                  {viewMode === 'WEEK' ? (
                    weekDays.map(date => {
                      const slotAppointments = getAppointmentsForSlot(date, hour);
                      return (
                        <div key={`${date.toISOString()}-${hour}`} className="group/slot relative flex min-h-[72px] flex-col gap-1 border-r border-slate-50 p-0.5 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50 lg:min-h-[80px] lg:p-1">
                          {slotAppointments.length > 0 ? (
                            slotAppointments.map(appointment => (
                              <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                showTherapist={user?.activeRole === 'GESTOR'}
                                onEdit={() => {
                                  setEditingAppointment(appointment);
                                  setSelectedSlot(null);
                                  setIsModalOpen(true);
                                }}
                                onDelete={() => handleDeleteAppointment(appointment)}
                              />
                            ))
                          ) : (
                            <button onClick={() => openNewAppointment(date, hour)} className="absolute inset-0 flex h-full w-full items-center justify-center text-primary/20 opacity-0 focus:text-primary/70 focus:opacity-100 group-hover/slot:opacity-100">
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="group/slot relative flex min-h-[90px] flex-col gap-1 border-r border-slate-50 p-1 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50 lg:min-h-[100px]">
                      {(() => {
                        const slotAppointments = getAppointmentsForSlot(currentDate, hour);
                        return slotAppointments.length > 0 ? (
                          slotAppointments.map(appointment => (
                            <AppointmentCard
                              key={appointment.id}
                              appointment={appointment}
                              showTherapist={user?.activeRole === 'GESTOR'}
                              onEdit={() => {
                                setEditingAppointment(appointment);
                                setSelectedSlot(null);
                                setIsModalOpen(true);
                              }}
                              onDelete={() => handleDeleteAppointment(appointment)}
                            />
                          ))
                        ) : (
                          <button onClick={() => openNewAppointment(currentDate, hour)} className="absolute inset-0 flex h-full w-full items-center justify-center text-primary/20 opacity-0 focus:text-primary/70 focus:opacity-100 group-hover/slot:opacity-100">
                            <Plus size={20} />
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DeleteAppointmentModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false })}
        onDeleteSingle={executeDeleteSingle}
        onDeleteSeries={confirmDelete.appointment?.recurrenceId ? executeDeleteSeries : undefined}
        isRecurring={!!confirmDelete.appointment?.recurrenceId && confirmDelete.appointment?.recurrence !== 'NONE'}
      />

      <AppointmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={editingAppointment ? handleUpdateAppointment : handleCreateAppointment}
        onDelete={editingAppointment ? async () => handleDeleteAppointment(editingAppointment) : undefined}
        initialData={editingAppointment}
        selectedSlot={selectedSlot}
        title={editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
      />
    </motion.div>
  );
}
