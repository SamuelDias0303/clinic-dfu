import React, { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { MAX_SHARED_WHITELABELS, clampShareTargets } from '../lib/sharing';
import { Patient } from '../types';

type SavedPatient = Patient & { id: string };

interface SharePatientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Só pacientes deste whitelabel (os recebidos de outro não entram).
  patients: SavedPatient[];
  targets: { id: string; name: string; slug: string }[];
  onConfirm: (changes: { patient: SavedPatient; sharedWith: string[] }[]) => Promise<void>;
}

type Mode = 'SHARE' | 'UNSHARE';

export default function SharePatientsModal({ isOpen, onClose, patients, targets, onConfirm }: SharePatientsModalProps) {
  const [mode, setMode] = useState<Mode>('SHARE');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const allowedIds = useMemo(() => targets.map((target) => target.id), [targets]);
  const nameOf = (id: string) => targets.find((target) => target.id === id)?.name ?? id;

  const visiblePatients = useMemo(
    () => patients.filter((patient) => patient.name.toLowerCase().includes(search.toLowerCase())),
    [patients, search],
  );

  const nextList = (patient: SavedPatient) => mode === 'SHARE'
    ? clampShareTargets([...(patient.sharedWith ?? []), ...targetIds], allowedIds)
    : (patient.sharedWith ?? []).filter((id) => !targetIds.includes(id));

  const changes = patients
    .filter((patient) => patientIds.includes(patient.id))
    .map((patient) => ({ patient, sharedWith: nextList(patient) }))
    .filter(({ patient, sharedWith }) => sharedWith.join('|') !== (patient.sharedWith ?? []).join('|'));

  // Pacientes que passariam de 3 destinos (clampShareTargets corta): avisa antes de salvar.
  const overLimit = mode === 'SHARE' && patients
    .filter((patient) => patientIds.includes(patient.id))
    .some((patient) => new Set([...(patient.sharedWith ?? []), ...targetIds]).size > MAX_SHARED_WHITELABELS);

  if (!isOpen) return null;

  const toggle = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(changes);
      setPatientIds([]);
      setTargetIds([]);
      onClose();
    } catch (error) {
      console.error('Error sharing patients:', error);
      alert('Erro ao atualizar o compartilhamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Compartilhar pacientes</h3>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="flex gap-2">
            {([['SHARE', 'Compartilhar'], ['UNSHARE', 'Remover compartilhamento']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === value
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-500">{mode === 'SHARE' ? 'Compartilhar com' : 'Remover de'}</p>
            <div className="flex flex-wrap gap-2">
              {targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => toggle(targetIds, setTargetIds, target.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                    targetIds.includes(target.id)
                      ? 'border-primary bg-primary text-white'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {target.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase text-slate-500">Pacientes ({patientIds.length} selecionados)</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar paciente..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {visiblePatients.map((patient) => (
                <li key={patient.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={patientIds.includes(patient.id)}
                      onChange={() => toggle(patientIds, setPatientIds, patient.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">{patient.name}</span>
                    {(patient.sharedWith ?? []).length > 0 && (
                      <span className="text-xs text-slate-400">com {(patient.sharedWith ?? []).map(nameOf).join(', ')}</span>
                    )}
                  </label>
                </li>
              ))}
              {visiblePatients.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Nenhum paciente encontrado.</li>}
            </ul>
          </div>

          {overLimit && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Cada paciente pode ser compartilhado com no máximo {MAX_SHARED_WHITELABELS} whitelabels. Os destinos além do limite não serão aplicados.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:p-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || targetIds.length === 0 || changes.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : mode === 'SHARE' ? `Compartilhar (${changes.length})` : `Remover (${changes.length})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
