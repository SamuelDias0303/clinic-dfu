import { useMemo, useState } from 'react';
import { Package as PackageIcon } from 'lucide-react';
import { Appointment, Package, Patient } from '../types';
import { packageOverview } from '../lib/packageProgress';

interface PackagesOverviewCardProps {
  packages: Package[];
  patients: Patient[];
  appointments: Appointment[];
  // Gestor e admin filtram por terapeuta; o terapeuta já vê só os próprios pacientes.
  canFilterByTherapist: boolean;
}

export default function PackagesOverviewCard({ packages, patients, appointments, canFilterByTherapist }: PackagesOverviewCardProps) {
  const [therapistFilter, setTherapistFilter] = useState('');

  const rows = useMemo(() => packageOverview(packages, patients, appointments), [packages, patients, appointments]);

  const therapists = useMemo(() => {
    const byId = new Map<string, string>();
    rows.forEach((row) => byId.set(row.therapistId, row.therapistName));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visibleRows = therapistFilter ? rows.filter((row) => row.therapistId === therapistFilter) : rows;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <PackageIcon size={18} className="text-primary" />
          Pacotes de atendimento
        </h3>
        {canFilterByTherapist && therapists.length > 0 && (
          <select
            aria-label="Filtrar por terapeuta"
            value={therapistFilter}
            onChange={(event) => setTherapistFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Todos os terapeutas</option>
            {therapists.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      {visibleRows.length === 0 ? (
        <p className="p-6 text-sm text-slate-400 dark:text-slate-500">Nenhum pacote ativo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-800/50">
                <th className="px-6 py-3">Paciente</th>
                {canFilterByTherapist && <th className="px-6 py-3">Terapeuta</th>}
                <th className="px-6 py-3">Andamento</th>
                <th className="px-6 py-3">Restantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.map((row) => {
                const percent = Math.min(100, Math.round((row.used / row.total) * 100));
                return (
                  <tr key={row.packageId}>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{row.patientName}</td>
                    {canFilterByTherapist && (
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{row.therapistName}</td>
                    )}
                    <td className="px-6 py-3">
                      <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">{row.used} de {row.total} sessões</p>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={row.total}
                        aria-valuenow={Math.min(row.used, row.total)}
                        className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      >
                        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {row.complete ? 'Concluído' : row.remaining}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
