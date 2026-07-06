import React, { useEffect, useState } from 'react';
import { Briefcase, Loader2, MapPin, Star, User, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Therapist } from '../services/therapistService';

interface TherapistFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Therapist, 'id' | 'createdAt'>) => Promise<void>;
  initialData?: Therapist;
  title: string;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400';

export default function TherapistFormModal({ isOpen, onClose, onSubmit, initialData, title }: TherapistFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<Therapist, 'id' | 'createdAt'>>({
    name: '',
    email: '',
    specialty: '',
    status: 'Ativo',
    units: ['Unidade Principal'],
    rating: 5,
  });

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData({
        name: '',
        email: '',
        specialty: '',
        status: 'Ativo',
        units: ['Unidade Principal'],
        rating: 5,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error saving therapist:', error);
      alert('Erro ao salvar terapeuta.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div>
              <label className={labelClass}><User size={14} /> Nome Completo</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={event => setFormData({ ...formData, name: event.target.value })}
                className={inputClass}
                placeholder="Ex: Dr. Roberto Silva"
              />
            </div>

            <div>
              <label className={labelClass}>E-mail</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={event => setFormData({ ...formData, email: event.target.value })}
                className={inputClass}
                placeholder="Ex: roberto@clinica.com"
              />
            </div>

            <div>
              <label className={labelClass}><Briefcase size={14} /> Especialidade</label>
              <input
                type="text"
                required
                value={formData.specialty}
                onChange={event => setFormData({ ...formData, specialty: event.target.value })}
                className={inputClass}
                placeholder="Ex: Psicólogo Cognitivo Comportamental"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={formData.status}
                  onChange={event => setFormData({ ...formData, status: event.target.value as 'Ativo' | 'Inativo' })}
                  className={inputClass}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label className={labelClass}><Star size={14} /> Avaliação (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  required
                  value={formData.rating}
                  onChange={event => setFormData({ ...formData, rating: parseFloat(event.target.value) })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}><MapPin size={14} /> Unidades (separadas por vírgula)</label>
              <input
                type="text"
                required
                value={formData.units.join(', ')}
                onChange={event => setFormData({ ...formData, units: event.target.value.split(',').map(unit => unit.trim()) })}
                className={inputClass}
                placeholder="Ex: Unidade Principal, Unidade Sul"
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Terapeuta'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
