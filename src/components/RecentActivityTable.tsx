import React from 'react';
import { Appointment } from '../types';

const statusStyles = {
  AGUARDANDO: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  'EM ANDAMENTO': 'bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  'CONCLUÍDO': 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
  CANCELADO: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800',
};

interface RecentActivityTableProps {
  appointments?: Appointment[];
}

export default function RecentActivityTable({ appointments = [] }: RecentActivityTableProps) {
  const recentActivities = [...appointments]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6">
        <h3 className="font-bold text-slate-800 dark:text-white">Atividade Recente (Hoje)</h3>
        <button className="shrink-0 text-xs font-semibold text-primary hover:underline">Ver tudo</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-800/50">
              <th className="px-6 py-3">Paciente</th>
              <th className="px-6 py-3">Tipo</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Horário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivities.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma atividade recente encontrada para hoje.
                </td>
              </tr>
            ) : (
              recentActivities.map((activity) => (
                <tr key={activity.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80">
                  <td className="px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {activity.patientName.split(' ').map(name => name[0]).join('').substring(0, 2)}
                      </div>
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{activity.patientName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{activity.type}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[activity.status as keyof typeof statusStyles] || statusStyles.AGUARDANDO}`}>
                        {activity.status}
                      </span>
                      {activity.status === 'CONCLUÍDO' && !activity.clinicalEvolution && (
                        <span className="animate-pulse text-[9px] font-bold text-rose-500">Evolução Pendente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{activity.time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
