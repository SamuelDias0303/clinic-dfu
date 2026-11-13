import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Appointment, Evolution } from '../types';
import { clinicalRecordService } from '../services/clinicalRecordService';
import { appointmentService } from '../services/appointmentService';
import { evolutionCandidates } from '../lib/clinicalHelpers';

interface LinkEvolutionModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  // Evoluções já ligadas a algum agendamento (pelo evolutionId), que não podem ser reaproveitadas.
  usedEvolutionIds: Set<string>;
  whitelabelId?: string | null;
}

// Sessões antigas ficaram "pendentes" mesmo com a evolução escrita no prontuário, porque
// não havia vínculo. Aqui o terapeuta aponta qual evolução já existente é a da sessão.
export default function LinkEvolutionModal({ appointment, onClose, usedEvolutionIds, whitelabelId }: LinkEvolutionModalProps) {
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosenId, setChosenId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setLoading(true);
    setChosenId('');
    return clinicalRecordService.subscribeToEvolutions(appointment.patientId, (data) => {
      setEvolutions(data);
      setLoading(false);
    }, whitelabelId);
  }, [appointment, whitelabelId]);

  if (!appointment) return null;

  const candidates = evolutionCandidates<Evolution>(evolutions, appointment.date, usedEvolutionIds);

  const handleSubmit = async () => {
    if (!appointment.id || !chosenId) return;
    setSaving(true);
    try {
      await clinicalRecordService.updateEvolution(chosenId, { appointmentId: appointment.id }, whitelabelId);
      await appointmentService.updateAppointment(appointment.id, { evolutionId: chosenId }, whitelabelId);
      onClose();
    } catch (error) {
      console.error('Error linking evolution:', error);
      alert('Erro ao vincular a evolução.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Vincular evolução já registrada</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {appointment.patientName} · sessão de {appointment.date.split('-').reverse().join('/')} às {appointment.time}. Escolha a evolução que já foi escrita para esta sessão.
          </p>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : candidates.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              Nenhuma evolução disponível para vincular. Use "Evoluir" para registrar uma nova.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((evolution) => (
                <li key={evolution.id}>
                  <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    chosenId === evolution.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
                  }`}>
                    <input type="radio" name="evolution" checked={chosenId === evolution.id} onChange={() => setChosenId(evolution.id!)} className="mt-1" />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-800 dark:text-slate-100">{evolution.date} às {evolution.time.slice(0, 5)}</span>
                      <span className="block text-slate-600 dark:text-slate-300">
                        {evolution.content.length > 160 ? `${evolution.content.slice(0, 160)}…` : evolution.content}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
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
            disabled={saving || !chosenId}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            Vincular
          </button>
        </div>
      </div>
    </div>
  );
}
