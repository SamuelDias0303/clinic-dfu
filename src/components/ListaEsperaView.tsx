import React, { useState } from 'react';
import { Archive, MessageCircle, Star } from 'lucide-react';
import { Lead } from '../types';
import { leadService } from '../services/leadService';
import { useAuth } from '../contexts/AuthContext';
import { linkChamar } from '../lib/listaEspera';

const FAIXA_LABEL: Record<string, string> = {
  '0-1m': '0-1 mes',
  '1-3m': '1-3 meses',
  '3-6m': '3-6 meses',
  '6-12m': '6-12 meses',
  '12-24m': '12-24 meses',
  outra: 'Outra',
};

interface ListaEsperaViewProps {
  /** Ja ordenada por `ordenarFila`. */
  fila: Lead[];
  onSelect: (lead: Lead) => void;
}

export default function ListaEsperaView({ fila, onSelect }: ListaEsperaViewProps) {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;

  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const alternarPrioridade = async (lead: Lead) => {
    if (!lead.id) return;
    setProcessandoId(lead.id);
    setErro(null);
    try {
      await leadService.updateLead(lead.id, { prioritario: !lead.prioritario }, whitelabelId);
    } catch (err) {
      console.error(err);
      setErro('Nao foi possivel alterar a prioridade.');
    } finally {
      setProcessandoId(null);
    }
  };

  const arquivar = async (lead: Lead) => {
    if (!lead.id) return;
    if (!window.confirm(`Arquivar ${lead.responsavel}? Sai da lista de espera e pode ser restaurado em Solicitacoes > Arquivadas.`)) {
      return;
    }
    setProcessandoId(lead.id);
    setErro(null);
    try {
      await leadService.setArquivado(lead.id, true, whitelabelId);
    } catch (err) {
      console.error(err);
      setErro('Nao foi possivel arquivar.');
    } finally {
      setProcessandoId(null);
    }
  };

  const chamar = async (lead: Lead) => {
    if (!lead.id) return;
    if (!window.confirm(`Chamar ${lead.responsavel} pelo WhatsApp e tirar da lista de espera?`)) return;
    setErro(null);
    // Abre antes do await (navegadores bloqueiam janela aberta depois de operacao
    // assincrona). Sem `noopener` na chamada: com ele `window.open` sempre devolve
    // null e nao da pra saber se o pop-up foi bloqueado. So tira o lead da fila
    // se a janela realmente abriu.
    const janela = window.open('', '_blank');
    if (!janela) {
      setErro('O navegador bloqueou a janela do WhatsApp. Libere pop-ups para este site e tente de novo.');
      return;
    }
    janela.opener = null;
    janela.location.href = linkChamar(lead);
    setProcessandoId(lead.id);
    try {
      await leadService.updateStatus(lead.id, 'EM_CONTATO', whitelabelId);
    } catch (err) {
      console.error(err);
      setErro('WhatsApp aberto, mas nao foi possivel mover o contato para "Em contato". Atualize o status no detalhe.');
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
          Fila de quem preencheu o formulario com a agenda lotada. Contatos que chegaram so pelo
          WhatsApp nao aparecem aqui — para incluir alguem, abra a solicitacao em Solicitacoes e
          mude o status para Lista de espera.
        </p>
        <button
          type="button"
          disabled={fila.length === 0 || processandoId !== null}
          onClick={() => chamar(fila[0])}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <MessageCircle size={16} /> Chamar proximo
        </button>
      </div>

      {erro && (
        <p className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {erro}
        </p>
      )}

      {fila.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Ninguem na lista de espera.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Responsavel</th>
                  <th className="px-4 py-3 font-semibold">Bebe</th>
                  <th className="px-4 py-3 font-semibold">Preocupacoes</th>
                  <th className="px-4 py-3 font-semibold">Entrou em</th>
                  <th className="px-4 py-3 font-semibold text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fila.map((lead, index) => (
                  <tr
                    key={lead.id}
                    onClick={() => onSelect(lead)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {lead.responsavel}
                      <span className="block text-xs font-normal text-slate-400">{lead.whatsapp}</span>
                    </td>
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
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={processandoId === lead.id}
                          onClick={() => alternarPrioridade(lead)}
                          aria-label={lead.prioritario ? 'Remover prioridade' : 'Priorizar'}
                          title={lead.prioritario ? 'Prioritario (clique para remover)' : 'Priorizar'}
                          className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 ${
                            lead.prioritario ? 'text-amber-500' : 'text-slate-300'
                          }`}
                        >
                          <Star size={18} fill={lead.prioritario ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          disabled={processandoId === lead.id}
                          onClick={() => chamar(lead)}
                          className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
                        >
                          Chamar
                        </button>
                        <button
                          type="button"
                          disabled={processandoId === lead.id}
                          onClick={() => arquivar(lead)}
                          aria-label="Arquivar"
                          title="Arquivar (sai da lista, pode restaurar depois)"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Archive size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
