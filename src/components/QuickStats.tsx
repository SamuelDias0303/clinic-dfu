import React from 'react';

interface QuickStatsProps {
  patientsCount?: number;
  appointmentsCount?: number;
  weeklyCapacity?: number;
}

export default function QuickStats({ patientsCount = 0, appointmentsCount = 0, weeklyCapacity = 84 }: QuickStatsProps) {
  const currentProgress = Math.min(100, Math.round((appointmentsCount / weeklyCapacity) * 100));

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 sm:p-6 min-w-0">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4">Estatísticas Rápidas</h3>
        <div className="space-y-4">
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between gap-3">
              <span className="text-xs font-semibold inline-block text-slate-600 dark:text-slate-400 leading-tight">
                Capacidade Semanal ({appointmentsCount}/{weeklyCapacity})
              </span>
              <span className="text-xs font-semibold inline-block text-primary tabular-nums">{currentProgress}%</span>
            </div>
            <div className="overflow-hidden h-1.5 mb-4 text-xs flex rounded bg-primary/10 dark:bg-primary/20">
              <div
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 dark:border-slate-800">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Pacientes</span>
            <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{patientsCount}</span>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 dark:border-slate-800">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Agendamentos</span>
            <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{appointmentsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
