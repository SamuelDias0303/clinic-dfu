import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Patient } from '../types';
import { Therapist } from '../services/therapistService';
import { patientService } from '../services/patientService';
import { isUnassigned } from '../lib/clinicalHelpers';

interface AssignTherapistModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  therapists: Therapist[];
  whitelabelId?: string | null;
}

// Vincula vários pacientes sem terapeuta de uma vez. Sem vínculo, nenhum terapeuta os enxerga.
export default function AssignTherapistModal({ isOpen, onClose, patients, therapists, whitelabelId }: AssignTherapistModalProps) {
  const unassigned = patients.filter(isUnassigned);
  const activeTherapists = therapists.filter((therapist) => therapist.status === 'Ativo');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [therapistId, setTherapistId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setTherapistId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allSelected = unassigned.length > 0 && selected.size === unassigned.length;
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSubmit = async () => {
    const therapist = activeTherapists.find((item) => item.id === therapistId);
    if (!therapist || selected.size === 0) return;

    setSaving(true);
    const ids = [...selected];
    const results = await Promise.allSettled(
      ids.map((id) => patientService.updatePatient(id, { therapistId: therapist.id, therapistName: therapist.name }, whitelabelId)),
    );
    setSaving(false);

    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      console.error('Error assigning therapist:', results.filter((result) => result.status === 'rejected'));
      alert(`${failed} de ${ids.length} pacientes não foram atualizados. Tente novamente.`);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Atribuir terapeuta</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Estes pacientes não têm terapeuta e por isso não aparecem para nenhum terapeuta. Escolha quem os atende.
          </p>

          <div>
            <label htmlFor="assign-therapist" className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Terapeuta</label>
            <select
              id="assign-therapist"
              value={therapistId}
              onChange={(event) => setTherapistId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Selecione um terapeuta</option>
              {activeTherapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(unassigned.map((patient) => patient.id!)))}
              />
              Selecionar todos ({unassigned.length})
            </label>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {unassigned.map((patient) => (
                <li key={patient.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/50">
                    <input type="checkbox" checked={selected.has(patient.id!)} onChange={() => toggle(patient.id!)} />
                    {patient.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800 sm:px-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !therapistId || selected.size === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            Atribuir {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
