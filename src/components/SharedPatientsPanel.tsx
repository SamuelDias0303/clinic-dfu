import React, { useMemo, useState } from 'react';
import { Loader2, Search, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { SHARE_LEVELS, SHARE_LEVEL_LABELS, sharedRows, withTargetLevel, withoutTarget } from '../lib/sharing';
import { Patient, ShareLevel } from '../types';

type SavedPatient = Patient & { id: string };

interface SharedPatientsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Só pacientes deste whitelabel (os recebidos de outro não entram).
  patients: SavedPatient[];
  // Nome dos destinos liberados pelo admin; destino que saiu da lista aparece pelo id.
  targets: { id: string; name: string; slug: string }[];
  onChange: (change: { patient: SavedPatient; sharedWith: string[]; sharedAccess: Record<string, ShareLevel> }) => Promise<void>;
}

// Quem recebeu o quê, em que nível, com troca de nível e remoção na própria linha.
export default function SharedPatientsPanel({ isOpen, onClose, patients, targets, onChange }: SharedPatientsPanelProps) {
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const nameOf = (id: string) => targets.find((target) => target.id === id)?.name ?? id;

  const allRows = useMemo(
    () => sharedRows(patients, nameOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patients, targets],
  );
  const destinations = useMemo(
    () => [...new Map(allRows.map((row) => [row.targetId, row.targetName])).entries()],
    [allRows],
  );
  const rows = allRows.filter((row) =>
    row.patientName.toLowerCase().includes(search.toLowerCase())
    && (!targetFilter || row.targetId === targetFilter));

  if (!isOpen) return null;

  const run = async (key: string, patientId: string, buildChange: (patient: SavedPatient) => { sharedWith: string[]; sharedAccess: Record<string, ShareLevel> }) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;
    setBusyKey(key);
    try {
      await onChange({ patient, ...buildChange(patient) });
    } catch (error) {
      console.error('Error updating shared patient:', error);
      alert('Erro ao atualizar o compartilhamento.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleLevel = (patientId: string, targetId: string, level: ShareLevel) =>
    run(`${patientId}:${targetId}`, patientId, (patient) => withTargetLevel(patient, targetId, level));

  const handleRemove = (patientId: string, patientName: string, targetId: string) => {
    if (!window.confirm(`Parar de compartilhar ${patientName} com ${nameOf(targetId)}? O acesso e os blocos de agenda copiados lá somem.`)) return;
    void run(`${patientId}:${targetId}`, patientId, (patient) => withoutTarget(patient, targetId));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pacientes compartilhados</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{allRows.length} {allRows.length === 1 ? 'compartilhamento' : 'compartilhamentos'}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:px-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {destinations.length > 1 && (
            <select
              aria-label="Filtrar por destino"
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Todos os destinos</option>
              {destinations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">
              {allRows.length === 0 ? 'Nenhum paciente compartilhado ainda.' : 'Nenhum compartilhamento encontrado.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => {
                const key = `${row.patientId}:${row.targetId}`;
                const busy = busyKey === key;
                return (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{row.patientName}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">com {row.targetName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Nível de ${row.patientName} em ${row.targetName}`}
                        value={row.level}
                        disabled={busy || busyKey !== null}
                        onChange={(event) => handleLevel(row.patientId, row.targetId, event.target.value as ShareLevel)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {SHARE_LEVELS.map((level) => <option key={level} value={level}>{SHARE_LEVEL_LABELS[level]}</option>)}
                      </select>
                      <button
                        onClick={() => handleRemove(row.patientId, row.patientName, row.targetId)}
                        disabled={busy || busyKey !== null}
                        title="Parar de compartilhar"
                        aria-label={`Parar de compartilhar ${row.patientName} com ${row.targetName}`}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-900/20"
                      >
                        {busy ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
