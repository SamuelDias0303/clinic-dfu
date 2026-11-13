import { useState } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { Appointment } from '../types';

const statusStyles: Record<Appointment['status'], string> = {
  AGUARDANDO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'EM ANDAMENTO': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'CONCLUÍDO': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELADO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const formatDate = (date: string) => date.split('-').reverse().join('/');

interface PatientAppointmentsListProps {
  patientName: string;
  appointments: Appointment[];
  showTherapist: boolean;
  onEdit: (appointment: Appointment) => void;
  onShowFullAgenda: () => void;
  onBackToDashboard?: () => void;
}

export default function PatientAppointmentsList({
  patientName,
  appointments,
  showTherapist,
  onEdit,
  onShowFullAgenda,
  onBackToDashboard,
}: PatientAppointmentsListProps) {
  const [onlyDone, setOnlyDone] = useState(false);

  const done = appointments.filter((appointment) => appointment.status === 'CONCLUÍDO').length;
  const pending = appointments.filter((appointment) => appointment.status === 'AGUARDANDO' || appointment.status === 'EM ANDAMENTO').length;
  const canceled = appointments.filter((appointment) => appointment.status === 'CANCELADO').length;

  const rows = [...appointments]
    .filter((appointment) => !onlyDone || appointment.status === 'CONCLUÍDO')
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-2xl">Agendamentos de {patientName}</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 lg:text-sm">
            {done} realizados · {pending} a realizar · {canceled} cancelados
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <ArrowLeft size={14} />
              Voltar ao Painel
            </button>
          )}
          <button
            onClick={onShowFullAgenda}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <CalendarDays size={14} />
            Ver agenda completa
          </button>
        </div>
      </div>

      <div className="flex w-fit items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {([false, true] as const).map((value) => (
          <button
            key={String(value)}
            onClick={() => setOnlyDone(value)}
            className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${
              onlyDone === value
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {value ? 'Somente realizados' : 'Todos'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500">
            {onlyDone ? 'Nenhum agendamento realizado ainda.' : 'Nenhum agendamento para este paciente.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-800/50">
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Horário</th>
                  <th className="px-6 py-3">Tipo</th>
                  {showTherapist && <th className="px-6 py-3">Terapeuta</th>}
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((appointment) => (
                  <tr
                    key={appointment.id}
                    onClick={() => onEdit(appointment)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-3 text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatDate(appointment.date)}</td>
                    <td className="px-6 py-3 text-sm tabular-nums text-slate-600 dark:text-slate-300">{appointment.time}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{appointment.type}</td>
                    {showTherapist && <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{appointment.therapistName}</td>}
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[appointment.status]}`}>
                        {appointment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
