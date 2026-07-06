import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Patient } from '../types';
import { therapistService, Therapist } from '../services/therapistService';
import { useAuth } from '../contexts/AuthContext';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (patient: Omit<Patient, 'id' | 'createdAt'>) => Promise<void>;
  initialData?: Patient;
  title: string;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400';

export default function PatientFormModal({ isOpen, onClose, onSubmit, initialData, title }: PatientFormModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [formData, setFormData] = useState<Omit<Patient, 'id' | 'createdAt'>>({
    name: '',
    cpf: '',
    birthDate: '',
    fatherName: '',
    motherName: '',
    phone: '',
    email: '',
    healthPlan: '',
    address: '',
    homeLocationUrl: '',
    status: 'Ativo',
    therapistId: '',
    therapistName: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = therapistService.subscribeToTherapists(setTherapists, user?.activeWhitelabelId);
    return () => unsubscribe();
  }, [isOpen, user?.activeWhitelabelId]);

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, ...rest } = initialData;
      setFormData({
        ...rest,
        fatherName: rest.fatherName || '',
        motherName: rest.motherName || '',
        homeLocationUrl: rest.homeLocationUrl || '',
        therapistId: rest.therapistId || '',
        therapistName: rest.therapistName || '',
      });
      return;
    }

    setFormData({
      name: '',
      cpf: '',
      birthDate: '',
      fatherName: '',
      motherName: '',
      phone: '',
      email: '',
      healthPlan: '',
      address: '',
      homeLocationUrl: '',
      status: 'Ativo',
      therapistId: user?.activeRole === 'TERAPEUTA' ? user.email : '',
      therapistName: user?.activeRole === 'TERAPEUTA' ? user.name : '',
    });
  }, [initialData, isOpen, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const finalData = { ...formData };
      if (user?.activeRole === 'GESTOR' && !finalData.therapistId) {
        finalData.therapistId = 'platform';
        finalData.therapistName = 'Plataforma';
      }

      if (finalData.homeLocationUrl && !/^https?:\/\//i.test(finalData.homeLocationUrl)) {
        alert('Informe um link de localização válido iniciando com http:// ou https://.');
        setLoading(false);
        return;
      }

      await onSubmit(finalData);
      onClose();
    } catch (error) {
      console.error('Error submitting patient:', error);
      alert('Erro ao salvar paciente.');
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
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Nome Completo</label>
                <input type="text" required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} className={inputClass} placeholder="Ex: Catarina Braz Santos Saavedra" />
              </div>

              <div>
                <label className={labelClass}>CPF</label>
                <input type="text" value={formData.cpf} onChange={event => setFormData({ ...formData, cpf: event.target.value })} className={inputClass} placeholder="000.000.000-00" />
              </div>

              <div>
                <label className={labelClass}>Data de nascimento do paciente</label>
                <input type="text" value={formData.birthDate} onChange={event => setFormData({ ...formData, birthDate: event.target.value })} className={inputClass} placeholder="DD/MM/AAAA" />
              </div>

              <div>
                <label className={labelClass}>Nome do pai</label>
                <input type="text" value={formData.fatherName || ''} onChange={event => setFormData({ ...formData, fatherName: event.target.value })} className={inputClass} placeholder="Opcional" />
              </div>

              <div>
                <label className={labelClass}>Nome da mãe</label>
                <input type="text" value={formData.motherName || ''} onChange={event => setFormData({ ...formData, motherName: event.target.value })} className={inputClass} placeholder="Opcional" />
              </div>

              <div>
                <label className={labelClass}>Telefone</label>
                <input type="text" value={formData.phone} onChange={event => setFormData({ ...formData, phone: event.target.value })} className={inputClass} placeholder="(00) 0.0000-0000" />
              </div>

              <div>
                <label className={labelClass}>E-mail</label>
                <input type="email" value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} className={inputClass} placeholder="exemplo@email.com" />
              </div>

              <div>
                <label className={labelClass}>Convênio</label>
                <input type="text" value={formData.healthPlan} onChange={event => setFormData({ ...formData, healthPlan: event.target.value })} className={inputClass} placeholder="Ex: PARTICULAR, UNIMED..." />
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <select value={formData.status} onChange={event => setFormData({ ...formData, status: event.target.value as 'Ativo' | 'Inativo' })} className={inputClass}>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>

              {user?.activeRole === 'GESTOR' && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Terapeuta Responsável</label>
                  <select
                    value={formData.therapistId}
                    onChange={event => {
                      const therapist = therapists.find(item => item.id === event.target.value);
                      setFormData({ ...formData, therapistId: event.target.value, therapistName: therapist ? therapist.name : '' });
                    }}
                    className={inputClass}
                  >
                    <option value="">Selecione um terapeuta (opcional - padrão: Plataforma)</option>
                    {therapists.map(therapist => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className={labelClass}>Endereço</label>
                <input type="text" value={formData.address} onChange={event => setFormData({ ...formData, address: event.target.value })} className={inputClass} placeholder="Rua, número, bairro..." />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Link de localização da casa</label>
                <input type="url" value={formData.homeLocationUrl || ''} onChange={event => setFormData({ ...formData, homeLocationUrl: event.target.value })} className={inputClass} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Paciente'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
