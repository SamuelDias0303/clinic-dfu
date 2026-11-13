import { CalendarDays, CheckCircle2, FileText, Link2, PenTool } from 'lucide-react';
import { Appointment } from '../types';
import { needsEvolution } from '../lib/clinicalHelpers';

const statusStyles: Record<Appointment['status'], string> = {
  AGUARDANDO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'EM ANDAMENTO': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'CONCLUÍDO': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELADO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const actionClass = 'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800';

interface MyDayCardProps {
  todayAppointments: Appointment[];
  // Sessões de dias anteriores concluídas e sem evolução (já limitadas pelo chamador).
  pendingEvolutions: Appointment[];
  pendingTotal: number;
  showTherapist: boolean;
  canRecordEvolution: boolean;
  busyId: string | null;
  onComplete: (appointment: Appointment) => void;
  onOpenProntuario: (appointment: Appointment) => void;
  onEvolve: (appointment: Appointment) => void;
  onLinkExisting: (appointment: Appointment) => void;
  onViewAgenda: () => void;
}

export default function MyDayCard({
  todayAppointments,
  pendingEvolutions,
  pendingTotal,
  showTherapist,
  canRecordEvolution,
  busyId,
  onComplete,
  onOpenProntuario,
  onEvolve,
  onLinkExisting,
  onViewAgenda,
}: MyDayCardProps) {
  const today = [...todayAppointments].sort((a, b) => a.time.localeCompare(b.time));
  const hasEvolution = (appointment: Appointment) => !!appointment.evolutionId || !!appointment.clinicalEvolution?.trim();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6">
        <h3 className="font-bold text-slate-800 dark:text-white">Meu dia</h3>
        <button onClick={onViewAgenda} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <CalendarDays size={14} />
          Abrir agenda
        </button>
      </div>

      {today.length === 0 ? (
        <p className="p-6 text-sm text-slate-400 dark:text-slate-500">Nenhum atendimento para hoje.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {today.map((appointment) => (
            <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{appointment.time}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{appointment.patientName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {appointment.type}{showTherapist && ` · ${appointment.therapistName}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[appointment.status]}`}>{appointment.status}</span>
                {needsEvolution(appointment) && (
                  <span className="text-[10px] font-bold text-rose-500">Evolução pendente</span>
                )}
                {(appointment.status === 'AGUARDANDO' || appointment.status === 'EM ANDAMENTO') && (
                  <button onClick={() => onComplete(appointment)} disabled={busyId === appointment.id} className={actionClass} title="Marcar sessão como concluída">
                    <CheckCircle2 size={14} />
                    Concluir
                  </button>
                )}
                {canRecordEvolution && appointment.status !== 'CANCELADO' && !hasEvolution(appointment) && (
                  <button onClick={() => onEvolve(appointment)} className={actionClass} title="Registrar evolução desta sessão">
                    <PenTool size={14} />
                    Evoluir
                  </button>
                )}
                <button onClick={() => onOpenProntuario(appointment)} className={actionClass} title="Abrir prontuário">
                  <FileText size={14} />
                  Prontuário
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingTotal > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <h4 className="px-4 pt-4 text-xs font-bold uppercase tracking-wider text-rose-500 sm:px-6">
            Evoluções pendentes ({pendingTotal})
          </h4>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingEvolutions.map((appointment) => (
              <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{appointment.patientName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {appointment.date.split('-').reverse().join('/')} às {appointment.time} · {appointment.type}
                    {showTherapist && ` · ${appointment.therapistName}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {canRecordEvolution && (
                    <>
                      <button onClick={() => onEvolve(appointment)} className={actionClass} title="Registrar evolução desta sessão">
                        <PenTool size={14} />
                        Evoluir
                      </button>
                      <button onClick={() => onLinkExisting(appointment)} className={actionClass} title="Esta sessão já tem evolução escrita: vincular">
                        <Link2 size={14} />
                        Já registrada
                      </button>
                    </>
                  )}
                  <button onClick={() => onOpenProntuario(appointment)} className={actionClass} title="Abrir prontuário">
                    <FileText size={14} />
                    Prontuário
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {pendingTotal > pendingEvolutions.length && (
            <p className="px-4 pb-4 text-xs text-slate-400 dark:text-slate-500 sm:px-6">
              + {pendingTotal - pendingEvolutions.length} outras sessões sem evolução.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
