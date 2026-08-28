import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle, UserPlus, X } from 'lucide-react';
import { Lead, LeadStatus, Patient } from '../types';
import { buildPatientDraft, leadService } from '../services/leadService';
import { useAuth } from '../contexts/AuthContext';

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'EM_CONTATO', label: 'Em contato' },
  { value: 'AGENDADO', label: 'Agendado' },
  { value: 'CONVERTIDO', label: 'Convertido' },
  { value: 'DESCARTADO', label: 'Descartado' },
];

const FAIXA_LABEL: Record<string, string> = {
  '0-1m': '0 a 1 mes',
  '1-3m': '1 a 3 meses',
  '3-6m': '3 a 6 meses',
  '6-12m': '6 a 12 meses',
  '12-24m': '12 a 24 meses',
  outra: 'Outra',
};

const PERIODO_LABEL: Record<string, string> = {
  MANHA: 'Manha',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  QUALQUER: 'Qualquer horario',
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export default function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;

  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notas, setNotas] = useState(lead.notasInternas ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showConvert, setShowConvert] = useState(false);
  const [patientDraft, setPatientDraft] = useState<Omit<Patient, 'id' | 'createdAt'>>(
    buildPatientDraft(lead)
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSaveTriage = async () => {
    if (!lead.id) return;
    setSaving(true);
    setError(null);
    try {
      await leadService.updateLead(lead.id, { status, notasInternas: notas }, whitelabelId);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Nao foi possivel salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!lead.id) return;
    if (!patientDraft.name.trim()) {
      setError('Informe o nome do paciente.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await leadService.convertToPatient(lead.id, patientDraft, whitelabelId);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Nao foi possivel converter em paciente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const whatsappHref = `https://wa.me/${onlyDigits(lead.whatsapp)}`;
  const createdAt = lead.createdAt?.toDate?.();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{lead.responsavel}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lead.origem}
              {createdAt ? ` · ${createdAt.toLocaleString('pt-BR')}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">WhatsApp</dt>
              <dd className="text-slate-900 dark:text-slate-100 mt-0.5">{lead.whatsapp}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Bebe</dt>
              <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                {lead.bebeNome || 'Nao informado'} · {FAIXA_LABEL[lead.bebeIdadeFaixa] ?? lead.bebeIdadeFaixa}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Preocupacoes</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1.5">
                {lead.preocupacoes.map((item) => (
                  <span
                    key={item}
                    className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </dd>
            </div>
            {lead.outroMotivo && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Outro motivo</dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">{lead.outroMotivo}</dd>
              </div>
            )}
            {lead.endereco && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Endereco</dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {lead.endereco.logradouro}, {lead.endereco.numero}
                  {lead.endereco.complemento ? ` - ${lead.endereco.complemento}` : ''}
                  {' · '}{lead.endereco.bairro} · {lead.endereco.cidade}/{lead.endereco.estado}
                  {' · CEP '}{lead.endereco.cep}
                </dd>
              </div>
            )}
            {lead.periodoContato && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Melhor periodo</dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {PERIODO_LABEL[lead.periodoContato] ?? lead.periodoContato}
                </dd>
              </div>
            )}
            {lead.observacoes && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Gestacao e parto</dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5 whitespace-pre-wrap">{lead.observacoes}</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Consentimento</dt>
              <dd className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 italic">
                &ldquo;{lead.consentimentoTexto}&rdquo;
              </dd>
            </div>
          </dl>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle size={16} /> Abrir conversa no WhatsApp
          </a>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Notas internas
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                placeholder="Registro interno do contato. Nao aparece para o paciente."
              />
            </div>
          </div>

          {lead.convertedPatientId ? (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              Ja convertido em paciente.
            </p>
          ) : showConvert ? (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confira os dados antes de criar o paciente. CPF, nascimento e endereco nao vem do
                formulario e podem ser preenchidos agora ou depois no cadastro.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={patientDraft.name}
                  onChange={(e) => setPatientDraft({ ...patientDraft, name: e.target.value })}
                  placeholder="Nome do paciente"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                />
                <input
                  value={patientDraft.birthDate}
                  onChange={(e) => setPatientDraft({ ...patientDraft, birthDate: e.target.value })}
                  type="date"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                />
                <input
                  value={patientDraft.motherName ?? ''}
                  onChange={(e) => setPatientDraft({ ...patientDraft, motherName: e.target.value })}
                  placeholder="Nome da mae"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                />
                <input
                  value={patientDraft.fatherName ?? ''}
                  onChange={(e) => setPatientDraft({ ...patientDraft, fatherName: e.target.value })}
                  placeholder="Nome do pai"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          ) : null}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          {!lead.convertedPatientId && !showConvert && (
            <button
              type="button"
              onClick={() => setShowConvert(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <UserPlus size={16} /> Converter em paciente
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={showConvert ? handleConvert : handleSaveTriage}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            {showConvert ? 'Criar paciente' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
