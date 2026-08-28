import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Loader2 } from 'lucide-react';
import { Lead, LeadStatus } from '../types';
import { leadService } from '../services/leadService';
import { testimonialService } from '../services/testimonialService';
import { useAuth } from '../contexts/AuthContext';
import LeadDetailModal, { formatarEndereco } from '../components/LeadDetailModal';
import SiteContentEditor from '../components/SiteContentEditor';
import DepoimentosModeracao from '../components/DepoimentosModeracao';

type Tab = 'SOLICITACOES' | 'DEPOIMENTOS' | 'CONTEUDO';

const STATUS_META: Record<LeadStatus, { label: string; chip: string }> = {
  NOVO: {
    label: 'Novo',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400',
  },
  EM_CONTATO: {
    label: 'Em contato',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400',
  },
  AGENDADO: {
    label: 'Agendado',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400',
  },
  CONVERTIDO: {
    label: 'Convertido',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  DESCARTADO: {
    label: 'Descartado',
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};

const FAIXA_LABEL: Record<string, string> = {
  '0-1m': '0-1 mes',
  '1-3m': '1-3 meses',
  '3-6m': '3-6 meses',
  '6-12m': '6-12 meses',
  '12-24m': '12-24 meses',
  outra: 'Outra',
};

function toCsv(leads: Lead[]) {
  const header = [
    'Data', 'Responsavel', 'WhatsApp', 'Bebe', 'Idade', 'Preocupacoes', 'Outro motivo',
    'Periodo', 'Gestacao e parto', 'Endereco', 'Status', 'Origem',
  ];
  const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = leads.map((lead) => [
    lead.createdAt?.toDate?.()?.toLocaleString('pt-BR') ?? '',
    lead.responsavel,
    lead.whatsapp,
    lead.bebeNome ?? '',
    FAIXA_LABEL[lead.bebeIdadeFaixa] ?? lead.bebeIdadeFaixa,
    lead.preocupacoes.join(' | '),
    lead.outroMotivo ?? '',
    lead.periodoContato ?? '',
    lead.observacoes ?? '',
    formatarEndereco(lead.endereco),
    STATUS_META[lead.status]?.label ?? lead.status,
    lead.origem,
  ].map(escape).join(','));

  return [header.map(escape).join(','), ...rows].join('\r\n');
}

export default function CaptacaoView() {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;

  const [tab, setTab] = useState<Tab>('SOLICITACOES');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'TODOS'>('TODOS');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [depoimentosPendentes, setDepoimentosPendentes] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = leadService.subscribeToLeads((data) => {
      setLeads(data);
      setLoading(false);
    }, whitelabelId);

    return () => unsubscribe();
  }, [whitelabelId]);

  useEffect(() => {
    const unsubscribe = testimonialService.subscribeToPending((data) => {
      setDepoimentosPendentes(data.length);
    }, whitelabelId);

    return () => unsubscribe();
  }, [whitelabelId]);

  const novos = useMemo(() => leads.filter((lead) => lead.status === 'NOVO').length, [leads]);
  const visible = useMemo(
    () => (filter === 'TODOS' ? leads : leads.filter((lead) => lead.status === filter)),
    [leads, filter]
  );

  const handleExportCsv = () => {
    const blob = new Blob(['﻿', toCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `solicitacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 lg:space-y-6">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Captacao
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium">
          Solicitacoes recebidas pelo site e conteudo publicado na pagina.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {([
          ['SOLICITACOES', `Solicitacoes${novos ? ` (${novos})` : ''}`],
          ['DEPOIMENTOS', `Depoimentos${depoimentosPendentes ? ` (${depoimentosPendentes})` : ''}`],
          ['CONTEUDO', 'Conteudo do site'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'CONTEUDO' ? (
        <SiteContentEditor />
      ) : tab === 'DEPOIMENTOS' ? (
        <DepoimentosModeracao />
      ) : loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(['TODOS', 'NOVO', 'EM_CONTATO', 'AGENDADO', 'CONVERTIDO', 'DESCARTADO'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === option
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {option === 'TODOS' ? 'Todos' : STATUS_META[option].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={visible.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {leads.length === 0
                  ? 'Nenhuma solicitacao recebida pelo site ainda.'
                  : 'Nenhuma solicitacao neste status.'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Responsavel</th>
                      <th className="px-4 py-3 font-semibold">WhatsApp</th>
                      <th className="px-4 py-3 font-semibold">Bebe</th>
                      <th className="px-4 py-3 font-semibold">Preocupacoes</th>
                      <th className="px-4 py-3 font-semibold">Recebido</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visible.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelected(lead)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {lead.responsavel}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lead.whatsapp}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {lead.bebeNome || '—'}
                          <span className="block text-xs text-slate-400">
                            {FAIXA_LABEL[lead.bebeIdadeFaixa] ?? lead.bebeIdadeFaixa}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {lead.preocupacoes.join(', ')}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {lead.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_META[lead.status]?.chip ?? ''}`}>
                            {STATUS_META[lead.status]?.label ?? lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
    </motion.div>
  );
}
