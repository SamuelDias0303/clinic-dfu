import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ClipboardList, Clock, FileText, Loader2, Package as PackageIcon, Search, Trash2, User, Users, X } from 'lucide-react';
import { Appointment, Package as PackageRecord, Patient, WhitelabelLinks } from '../types';
import { packageProgress } from '../lib/packageProgress';
import { allowedShareTargets, isForeignPatient } from '../lib/sharing';
import { whitelabelLinksService } from '../services/whitelabelLinksService';
import { isLegacyWhitelabel } from '../services/serviceScope';
import { packageService } from '../services/packageService';
import { patientService } from '../services/patientService';
import { therapistService, Therapist } from '../services/therapistService';
import { clinicalRecordService } from '../services/clinicalRecordService';
import { useAuth } from '../contexts/AuthContext';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  initialData?: Appointment;
  selectedSlot?: { date: string; time: string } | null;
  title: string;
}

const appointmentTypes = ['Consulta', 'Avaliação', 'Retorno', 'Exame'];
const statuses = ['AGUARDANDO', 'EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO'];
const recurrenceOptions = [
  { value: 'NONE', label: 'Nenhuma' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
];

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400';

export default function AppointmentFormModal({ isOpen, onClose, onSubmit, onDelete, initialData, selectedSlot, title }: AppointmentFormModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ownPatients, setPatients] = useState<Patient[]>([]);
  const [sharedPatients, setSharedPatients] = useState<Patient[]>([]);
  const [links, setLinks] = useState<WhitelabelLinks | null>(null);
  const patients = [...ownPatients, ...sharedPatients];
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPatientListOpen, setIsPatientListOpen] = useState(false);
  const patientListRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Omit<Appointment, 'id' | 'createdAt'>>({
    patientId: '',
    patientName: '',
    therapistId: user?.activeRole === 'TERAPEUTA' ? user.email : '',
    therapistName: user?.activeRole === 'TERAPEUTA' ? user.name : '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'Consulta',
    status: 'AGUARDANDO',
    notes: '',
    clinicalEvolution: '',
    evolutionId: '',
    packageId: '',
    sharedToWhitelabels: [],
    recurrence: 'NONE',
    recurrenceDays: [],
  });
  const [patientPackages, setPatientPackages] = useState<PackageRecord[]>([]);
  const [packageAppointments, setPackageAppointments] = useState<Appointment[]>([]);
  const autoLinkedPatient = useRef('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patientListRef.current && !patientListRef.current.contains(event.target as Node)) {
        setIsPatientListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const unsubPatients = patientService.subscribeToPatients(setPatients, undefined, user?.activeWhitelabelId);
    const unsubTherapists = therapistService.subscribeToTherapists(setTherapists, user?.activeWhitelabelId);
    const whitelabelId = user?.activeWhitelabelId;
    const real = !!whitelabelId && !isLegacyWhitelabel(whitelabelId);
    const unsubShared = real ? patientService.subscribeToSharedPatients(whitelabelId, setSharedPatients) : () => {};
    const unsubLinks = real ? whitelabelLinksService.subscribe(whitelabelId, setLinks) : () => {};
    return () => {
      unsubPatients();
      unsubTherapists();
      unsubShared();
      unsubLinks();
    };
  }, [isOpen, user?.activeWhitelabelId]);

  useEffect(() => {
    autoLinkedPatient.current = '';
    if (initialData) {
      const { id, createdAt, ...rest } = initialData;
      setFormData({ ...rest, recurrence: rest.recurrence || 'NONE' });
      setSearchTerm(rest.patientName || '');
      return;
    }

    setFormData({
      patientId: '',
      patientName: '',
      therapistId: user?.activeRole === 'TERAPEUTA' ? user.email : '',
      therapistName: user?.activeRole === 'TERAPEUTA' ? user.name : '',
      date: selectedSlot?.date || new Date().toISOString().split('T')[0],
      time: selectedSlot?.time || '09:00',
      type: 'Consulta',
      status: 'AGUARDANDO',
      notes: '',
      clinicalEvolution: '',
      evolutionId: '',
      packageId: '',
      sharedToWhitelabels: [],
      recurrence: 'NONE',
      recurrenceDays: [],
    });
    setSearchTerm('');
  }, [initialData, selectedSlot, isOpen, user]);

  // Terapeuta só lê os próprios agendamentos; a contagem dele reflete isso.
  const packageTherapistId = user?.activeRole === 'TERAPEUTA' ? user.email : undefined;

  useEffect(() => {
    if (!isOpen || !formData.patientId) {
      setPatientPackages([]);
      setPackageAppointments([]);
      return;
    }

    const unsubPackages = packageService.subscribeToPatientPackages(formData.patientId, setPatientPackages, user?.activeWhitelabelId);
    const unsubAppointments = packageService.subscribeToPatientAppointments(formData.patientId, setPackageAppointments, packageTherapistId, user?.activeWhitelabelId);
    return () => {
      unsubPackages();
      unsubAppointments();
    };
  }, [isOpen, formData.patientId, user?.activeWhitelabelId, packageTherapistId]);

  const packageOptions = patientPackages
    .map(pkg => ({ pkg, progress: packageProgress(pkg, packageAppointments.filter(item => item.packageId === pkg.id)) }))
    .filter(({ pkg, progress }) => progress.open || pkg.id === formData.packageId);
  // Agendamento novo: vincula sozinho ao pacote aberto do paciente. Uma vez por paciente, para "Sem pacote" escolhido à mão não voltar.
  // shortcut: contagem pode chegar depois do pacote e vincular a um pacote que acabou de completar; o aviso do formulário cobre, revisar se incomodar.
  useEffect(() => {
    if (!isOpen || initialData || !formData.patientId || autoLinkedPatient.current === formData.patientId) return;
    const open = packageOptions.find(({ progress }) => progress.open);
    if (!open) return;
    autoLinkedPatient.current = formData.patientId;
    setFormData(current => current.patientId === formData.patientId && !current.packageId ? { ...current, packageId: open.pkg.id! } : current);
  }, [isOpen, initialData, formData.patientId, packageOptions]);

  const selectedPackage = packageOptions.find(({ pkg }) => pkg.id === formData.packageId);
  // shortcut: estimativa espelha os limites de buildRecurringAppointments (12 ocorrências, 6 se mensal, vezes os dias); revisar se aqueles limites mudarem.
  const recurrenceCount = formData.recurrence === 'NONE'
    ? 1
    : (formData.recurrence === 'MONTHLY' ? 6 : 12) * Math.max(1, formData.recurrenceDays?.length ?? 0);
  const packageWarning = !selectedPackage
    ? ''
    : selectedPackage.progress.complete
      ? 'Este pacote já está completo; o agendamento passa do total de sessões.'
      : recurrenceCount > selectedPackage.progress.remaining
        ? `A recorrência pode criar até ${recurrenceCount} agendamentos e o pacote tem ${selectedPackage.progress.remaining} sessões restantes.`
        : '';

  // Whitelabels em que o agendamento pode aparecer: o dono do paciente (se for de outro) ou os destinos do compartilhamento.
  const selectedPatient = patients.find(patient => patient.id === formData.patientId);
  const shareOwnerId = formData.patientWhitelabelId;
  const shareNameOf = (id: string, fallback: string) =>
    allowedShareTargets(links).find(target => target.id === id)?.name ?? fallback;
  const shareOptions = shareOwnerId
    ? [{ id: shareOwnerId, name: shareNameOf(shareOwnerId, 'Clínica de origem do paciente') }]
    : (selectedPatient?.sharedWith ?? []).map(id => ({ id, name: shareNameOf(id, id) }));

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    setFormData({
      ...formData,
      patientId,
      patientName: patient.name,
      packageId: '',
      patientWhitelabelId: user?.activeWhitelabelId && isForeignPatient(patient, user.activeWhitelabelId) ? patient.whitelabelId : undefined,
      sharedToWhitelabels: [],
    });
    setSearchTerm(patient.name);
    setIsPatientListOpen(false);
  };

  const handleTherapistChange = (therapistId: string) => {
    const therapist = therapists.find(t => t.id === therapistId);
    if (therapist) {
      setFormData({ ...formData, therapistId, therapistName: therapist.name });
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cpf?.includes(searchTerm);
    // Paciente compartilhado vem com o terapeuta do whitelabel de origem, que não vale aqui.
    const matchesTherapist = !formData.therapistId
      || p.therapistId === formData.therapistId
      || (!!user?.activeWhitelabelId && isForeignPatient(p, user.activeWhitelabelId));
    return matchesSearch && matchesTherapist;
  });

  const handleDayToggle = (day: number) => {
    const currentDays = formData.recurrenceDays || [];
    const recurrenceDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    setFormData({ ...formData, recurrenceDays });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const updatedFormData = { ...formData };

      if (formData.clinicalEvolution?.trim()) {
        const [year, month, day] = formData.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        const evolutionStatus = formData.status === 'CONCLUÍDO' ? 'FINALIZED' : 'DRAFT';

        if (formData.evolutionId) {
          await clinicalRecordService.updateEvolution(formData.evolutionId, {
            content: formData.clinicalEvolution,
            status: evolutionStatus,
            date: formattedDate,
            time: formData.time,
            type: formData.type,
          }, user?.activeWhitelabelId);
        } else {
          const newEvolutionRef = await clinicalRecordService.createEvolution({
            patientId: formData.patientId,
            therapistId: formData.therapistId,
            therapistName: formData.therapistName,
            date: formattedDate,
            time: formData.time,
            type: formData.type,
            content: formData.clinicalEvolution,
            status: evolutionStatus,
          }, user?.activeWhitelabelId);

          updatedFormData.evolutionId = newEvolutionRef.id;
        }
      }

      await onSubmit(updatedFormData);
      onClose();
    } catch (error: any) {
      console.error('Error submitting appointment:', error);
      alert(error.message || 'Erro ao salvar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Erro ao excluir agendamento.');
    } finally {
      setDeleting(false);
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
            {user?.activeRole === 'GESTOR' && (
              <div>
                <label className={labelClass}><Users size={14} /> Terapeuta</label>
                <select
                  value={formData.therapistId}
                  onChange={event => handleTherapistChange(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Selecione um terapeuta</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div className="relative" ref={patientListRef}>
              <label className={labelClass}><User size={14} /> Paciente</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={user?.activeRole === 'GESTOR' && !formData.therapistId ? 'Selecione um terapeuta primeiro...' : 'Buscar paciente por nome ou CPF...'}
                  value={searchTerm}
                  disabled={user?.activeRole === 'GESTOR' && !formData.therapistId}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setIsPatientListOpen(true);
                  }}
                  onFocus={() => setIsPatientListOpen(true)}
                  className={`${inputClass} pl-10 disabled:opacity-50`}
                  required
                />
                {formData.patientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, patientId: '', patientName: '', packageId: '', patientWhitelabelId: undefined, sharedToWhitelabels: [] });
                      setSearchTerm('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isPatientListOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map(patient => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => handlePatientChange(patient.id!)}
                          className="flex w-full flex-col border-b border-slate-50 px-4 py-2 text-left text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <span className="font-medium text-slate-900 dark:text-white">{patient.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{patient.cpf || 'Sem CPF'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        {searchTerm.length > 0 ? 'Nenhum paciente encontrado.' : 'Nenhum paciente vinculado a este terapeuta.'}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <input type="hidden" value={formData.patientId} required />
            </div>

            {formData.patientId && (
              <div>
                <label className={labelClass}><PackageIcon size={14} /> Pacote (opcional)</label>
                <select
                  value={formData.packageId || ''}
                  onChange={event => setFormData({ ...formData, packageId: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Sem pacote</option>
                  {packageOptions.map(({ pkg, progress }) => (
                    <option key={pkg.id} value={pkg.id}>
                      {progress.used} de {progress.total} sessões{pkg.status === 'ENCERRADO' ? ' (encerrado)' : progress.complete ? ' (completo)' : ''}
                    </option>
                  ))}
                </select>
                {packageWarning && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{packageWarning}</p>
                )}
              </div>
            )}

            {formData.patientId && shareOptions.length > 0 && (
              <div>
                <label className={labelClass}>Mostrar na agenda de</label>
                <div className="space-y-1">
                  {shareOptions.map(option => (
                    <label key={option.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={(formData.sharedToWhitelabels ?? []).includes(option.id)}
                        onChange={() => {
                          const current = formData.sharedToWhitelabels ?? [];
                          setFormData({
                            ...formData,
                            sharedToWhitelabels: current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id],
                          });
                        }}
                        className="size-4 accent-primary"
                      />
                      {option.name}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">Aparece só como bloco de leitura, sem notas nem evolução.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}><Calendar size={14} /> Data</label>
                <input required type="date" value={formData.date} onChange={event => setFormData({ ...formData, date: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}><Clock size={14} /> Horário</label>
                <input required type="time" value={formData.time} onChange={event => setFormData({ ...formData, time: event.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Tipo</label>
                <select value={formData.type} onChange={event => setFormData({ ...formData, type: event.target.value })} className={inputClass}>
                  {appointmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Recorrência</label>
                <select value={formData.recurrence} onChange={event => setFormData({ ...formData, recurrence: event.target.value as any, recurrenceDays: [] })} className={inputClass}>
                  {recurrenceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            {formData.recurrence !== 'NONE' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Dias da Semana</label>
                <div className="flex flex-wrap gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(index)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        formData.recurrenceDays?.includes(index)
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] italic text-slate-400">* Se nenhum dia for selecionado, a recorrência será baseada na data inicial.</p>
              </motion.div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Status</label>
              <select value={formData.status} onChange={event => setFormData({ ...formData, status: event.target.value as any })} className={inputClass}>
                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <label className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
                  <ClipboardList size={16} /> Evolução Clínica (Prontuário)
                </label>
                {formData.status === 'CONCLUÍDO' ? (
                  <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Será salva como FINALIZADA</span>
                ) : (
                  <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Será salva como RASCUNHO</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                O que você escrever aqui será <strong>automaticamente salvo no prontuário</strong> do paciente.
                Ao marcar o status do agendamento como "CONCLUÍDO", a evolução será finalizada.
              </p>
              <textarea
                value={formData.clinicalEvolution || ''}
                onChange={event => setFormData({ ...formData, clinicalEvolution: event.target.value })}
                className="h-32 w-full resize-none rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:text-white"
                placeholder="Descreva a evolução do paciente nesta sessão..."
              />
            </div>

            <div>
              <label className={labelClass}><FileText size={14} /> Observações Administrativas</label>
              <textarea
                value={formData.notes}
                onChange={event => setFormData({ ...formData, notes: event.target.value })}
                className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Notas administrativas adicionais..."
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button type="submit" disabled={loading || deleting || !formData.patientId} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Agendamento'}
              </button>
            </div>

            {initialData && onDelete && (
              <button type="button" onClick={handleDelete} disabled={loading || deleting} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-bold text-rose-600 transition-all hover:border-rose-100 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:border-rose-900 dark:hover:bg-rose-900/20">
                {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                Excluir Agendamento
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
