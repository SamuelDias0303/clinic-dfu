import { Plus } from 'lucide-react';
import { Appointment } from '../types';
import { upperFirst } from '../lib/clinicalHelpers';

const statusStyles: Record<Appointment['status'], string> = {
  AGUARDANDO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'EM ANDAMENTO': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'CONCLUÍDO': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELADO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

interface DayAppointmentsListProps {
  date: Date;
  // Só os agendamentos deste dia.
  appointments: Appointment[];
  // Blocos de outros whitelabels: só leitura, fora do "Próximo" e de qualquer contagem.
  externalAppointments?: Appointment[];
  sourceNameOf?: (appointment: Appointment) => string;
  showTherapist: boolean;
  onEdit: (appointment: Appointment) => void;
  onNew: () => void;
}

// A visão por dia lista só o que existe: a grade de 14 horas vazias exigia rolar a tela
// inteira no celular para achar dois agendamentos.
export default function DayAppointmentsList({ date, appointments, externalAppointments = [], sourceNameOf, showTherapist, onEdit, onNew }: DayAppointmentsListProps) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = [...appointments].sort((a, b) => a.time.localeCompare(b.time));
  const nextId = isToday
    ? rows.find((appointment) => appointment.time >= nowTime && (appointment.status === 'AGUARDANDO' || appointment.status === 'EM ANDAMENTO'))?.id
    : undefined;

  const dayLabel = isToday ? 'Hoje' : upperFirst(date.toLocaleDateString('pt-BR', { weekday: 'long' }));
  const fullDate = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-primary/5 px-4 py-3 dark:border-slate-800 dark:bg-primary/10 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dayLabel}</p>
          <p className="text-sm font-bold text-primary">{fullDate}</p>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {rows.length} {rows.length === 1 ? 'agendamento' : 'agendamentos'}
        </p>
      </div>

      {rows.length === 0 && externalAppointments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum agendamento neste dia.</p>
          <button
            onClick={onNew}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
          >
            <Plus size={16} />
            Novo agendamento neste dia
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...externalAppointments].sort((a, b) => a.time.localeCompare(b.time)).map((appointment) => (
            <li key={`ext-${appointment.whitelabelId}-${appointment.id}`} className="flex items-center justify-between gap-3 bg-slate-50/70 px-4 py-3 dark:bg-slate-800/40 sm:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-slate-500 dark:text-slate-400">{appointment.time}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">{appointment.patientName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{appointment.type}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:border-slate-600 dark:text-slate-400">
                {sourceNameOf?.(appointment) ?? 'Outra clínica'}
              </span>
            </li>
          ))}
          {rows.map((appointment) => (
            <li key={appointment.id}>
              <button
                onClick={() => onEdit(appointment)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{appointment.time}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{appointment.patientName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {appointment.type}{showTherapist && ` · ${appointment.therapistName}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[appointment.status]}`}>{appointment.status}</span>
                  {appointment.id === nextId && <span className="text-[10px] font-bold text-primary">Próximo</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
