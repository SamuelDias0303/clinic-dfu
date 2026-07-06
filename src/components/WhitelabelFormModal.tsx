import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Whitelabel } from '../types';

interface WhitelabelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (whitelabel: Omit<Whitelabel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: Whitelabel;
}

function buildSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const defaultTherapistSpecialties = ['Fisioterapia', 'Fonoaudiologia', 'Terapia Ocupacional', 'Psicologia'];

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function WhitelabelFormModal({ isOpen, onClose, onSubmit, initialData }: WhitelabelFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [appointmentTypesInput, setAppointmentTypesInput] = useState('Consulta, Avaliacao, Retorno, Exame');
  const [therapistSpecialtiesInput, setTherapistSpecialtiesInput] = useState(defaultTherapistSpecialties.join(', '));
  const [formData, setFormData] = useState<Omit<Whitelabel, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    slug: '',
    domain: '',
    status: 'ATIVO',
    plan: 'Padrao',
    contactEmail: '',
    contactPhone: '',
    branding: {
      primaryColor: '#0066ff',
    },
    settings: {
      defaultUnitName: 'Unidade Principal',
      appointmentTypes: ['Consulta', 'Avaliacao', 'Retorno', 'Exame'],
      therapistSpecialties: defaultTherapistSpecialties,
      enabledFeatures: ['agenda', 'pacientes', 'prontuario'],
    },
  });

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...rest } = initialData;
      const appointmentTypes = rest.settings?.appointmentTypes || ['Consulta', 'Avaliacao', 'Retorno', 'Exame'];
      const therapistSpecialties = rest.settings?.therapistSpecialties || defaultTherapistSpecialties;

      setAppointmentTypesInput(appointmentTypes.join(', '));
      setTherapistSpecialtiesInput(therapistSpecialties.join(', '));
      setFormData({
        ...rest,
        domain: rest.domain || '',
        contactEmail: rest.contactEmail || '',
        contactPhone: rest.contactPhone || '',
        branding: rest.branding || { primaryColor: '#0066ff' },
        settings: {
          defaultUnitName: rest.settings?.defaultUnitName || 'Unidade Principal',
          appointmentTypes,
          therapistSpecialties,
          enabledFeatures: rest.settings?.enabledFeatures || ['agenda', 'pacientes', 'prontuario'],
        },
      });
    } else {
      setAppointmentTypesInput('Consulta, Avaliacao, Retorno, Exame');
      setTherapistSpecialtiesInput(defaultTherapistSpecialties.join(', '));
      setFormData({
        name: '',
        slug: '',
        domain: '',
        status: 'ATIVO',
        plan: 'Padrao',
        contactEmail: '',
        contactPhone: '',
        branding: {
          primaryColor: '#0066ff',
        },
        settings: {
          defaultUnitName: 'Unidade Principal',
          appointmentTypes: ['Consulta', 'Avaliacao', 'Retorno', 'Exame'],
          therapistSpecialties: defaultTherapistSpecialties,
          enabledFeatures: ['agenda', 'pacientes', 'prontuario'],
        },
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const settings = {
        ...formData.settings,
        appointmentTypes: parseList(appointmentTypesInput),
        therapistSpecialties: parseList(therapistSpecialtiesInput),
      };

      await onSubmit({
        ...formData,
        settings,
        slug: formData.slug || buildSlug(formData.name),
        domain: formData.domain || undefined,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error saving whitelabel:', error);
      alert('Erro ao salvar whitelabel.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialData ? 'Editar Whitelabel' : 'Novo Whitelabel'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configuracoes principais do ambiente.</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
              <input
                required
                value={formData.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setFormData({ ...formData, name, slug: initialData ? formData.slug : buildSlug(name) });
                }}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Ex: Clinica Norte"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug</label>
              <input
                required
                value={formData.slug}
                onChange={(event) => setFormData({ ...formData, slug: buildSlug(event.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="clinica-norte"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dominio</label>
              <input
                value={formData.domain || ''}
                onChange={(event) => setFormData({ ...formData, domain: event.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="cliente.clinicdfu.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plano</label>
              <input
                required
                value={formData.plan}
                onChange={(event) => setFormData({ ...formData, plan: event.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Padrao"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail de contato</label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={(event) => setFormData({ ...formData, contactEmail: event.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="admin@cliente.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
              <input
                value={formData.contactPhone || ''}
                onChange={(event) => setFormData({ ...formData, contactPhone: event.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cor primaria</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.branding.primaryColor}
                  onChange={(event) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, primaryColor: event.target.value },
                  })}
                  className="size-10 rounded border border-slate-200 dark:border-slate-700 bg-transparent"
                />
                <input
                  value={formData.branding.primaryColor}
                  onChange={(event) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, primaryColor: event.target.value },
                  })}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(event) => setFormData({ ...formData, status: event.target.value as Whitelabel['status'] })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="ARQUIVADO">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade padrao</label>
              <input
                value={formData.settings?.defaultUnitName || ''}
                onChange={(event) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, defaultUnitName: event.target.value },
                })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipos de agendamento</label>
              <input
                value={appointmentTypesInput}
                onChange={(event) => setAppointmentTypesInput(event.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Consulta, Avaliacao, Retorno"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modalidades de terapeutas</label>
              <input
                value={therapistSpecialtiesInput}
                onChange={(event) => setTherapistSpecialtiesInput(event.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Fisioterapia, Fonoaudiologia, Terapia Ocupacional"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Use virgulas para separar as modalidades disponiveis para convites de terapeutas.
              </p>
            </div>
          </div>

          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:p-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Whitelabel'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
