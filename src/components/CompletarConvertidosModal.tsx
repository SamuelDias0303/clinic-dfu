import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Lead } from '../types';
import { leadService, ResultadoAplicacao } from '../services/leadService';
import { patientService } from '../services/patientService';
import { clinicalRecordService } from '../services/clinicalRecordService';
import { useAuth } from '../contexts/AuthContext';
import { AjusteConversao, calcularAjustes, IgnoradoConversao } from '../lib/conversaoLead';

interface CompletarConvertidosModalProps {
  leads: Lead[];
  onClose: () => void;
}

function resumoTexto(texto: string) {
  const primeiraLinha = texto.split('\n')[0];
  return primeiraLinha.length > 90 ? `${primeiraLinha.slice(0, 90)}…` : primeiraLinha;
}

export default function CompletarConvertidosModal({ leads, onClose }: CompletarConvertidosModalProps) {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;
  // Foto dos leads na abertura: a lista da Captacao atualiza em tempo real e nao pode
  // reiniciar a previa (e a selecao do usuario) no meio da revisao.
  const leadsNaAbertura = useRef(leads);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<AjusteConversao[]>([]);
  const [ignorados, setIgnorados] = useState<IgnoradoConversao[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoAplicacao[] | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [pacientes, anamneses] = await Promise.all([
          patientService.listarPacientes(whitelabelId),
          clinicalRecordService.listarAnamneses(whitelabelId),
        ]);
        if (!ativo) return;
        const calculo = calcularAjustes(leadsNaAbertura.current, pacientes, anamneses);
        setAjustes(calculo.ajustes);
        setIgnorados(calculo.ignorados);
        setMarcados(new Set(calculo.ajustes.map((a) => a.leadId)));
      } catch (e) {
        console.error(e);
        if (ativo) setErro('Nao foi possivel carregar pacientes e anamneses. Verifique suas permissoes.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [whitelabelId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !aplicando) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, aplicando]);

  const selecionados = useMemo(() => ajustes.filter((a) => marcados.has(a.leadId)), [ajustes, marcados]);
  const ausentes = ignorados.filter((i) => i.motivo === 'PACIENTE_AUSENTE').length;
  const semNada = ignorados.filter((i) => i.motivo === 'NADA_A_COMPLETAR').length;

  const alternar = (leadId: string) => {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(leadId)) novo.delete(leadId);
      else novo.add(leadId);
      return novo;
    });
  };

  const aplicar = async () => {
    if (selecionados.length === 0) return;
    if (!window.confirm(`Completar o cadastro de ${selecionados.length} paciente(s)? Só campos vazios são preenchidos; nada é sobrescrito.`)) return;
    setAplicando(true);
    setErro(null);
    try {
      setResultados(await leadService.aplicarAjustes(selecionados, whitelabelId));
    } catch (e) {
      console.error(e);
      setErro('Nao foi possivel aplicar. Tente novamente.');
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Completar dados dos convertidos</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Copia para pacientes já criados o nome da mãe, o endereço e os antecedentes pessoais informados no site.
              Só preenche o que está vazio; nada é sobrescrito.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={aplicando}
            aria-label="Fechar"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {carregando && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          )}

          {erro && <p className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

          {!carregando && !resultados && !erro && ajustes.length === 0 && (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              Nada a completar: todos os pacientes convertidos já estão com os dados preenchidos.
            </p>
          )}

          {!carregando && !resultados && ajustes.length > 0 && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Revise e desmarque o que não quiser. Para conversões antigas, o responsável vira o nome da <b>mãe</b>;
                se em algum caso quem preencheu foi o pai, desmarque a linha (ou corrija depois no cadastro).
              </p>
              <ul className="space-y-2">
                {ajustes.map((ajuste) => (
                  <li key={ajuste.leadId} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marcados.has(ajuste.leadId)}
                        onChange={() => alternar(ajuste.leadId)}
                        className="mt-1 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5">
                        <span className="block font-bold text-slate-900 dark:text-white">{ajuste.pacienteNome}</span>
                        {ajuste.motherName && <span className="block">Mãe: <b>{ajuste.motherName}</b></span>}
                        {ajuste.address && <span className="block">Endereço: {ajuste.address}</span>}
                        {ajuste.antecedentes && (
                          <span className="block">
                            Antecedentes pessoais ({ajuste.antecedentes.acao === 'CRIAR' ? 'cria a anamnese' : 'preenche o campo vazio'}):{' '}
                            <span className="text-slate-500 dark:text-slate-400">{resumoTexto(ajuste.antecedentes.texto)}</span>
                          </span>
                        )}
                        {ajuste.avisos.map((aviso) => (
                          <span key={aviso} className="block text-xs text-amber-700 dark:text-amber-400">{aviso}</span>
                        ))}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {(semNada > 0 || ausentes > 0) && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {semNada > 0 && `${semNada} já completo(s). `}
                  {ausentes > 0 && `${ausentes} solicitação(ões) apontam para paciente que não existe mais (ignoradas).`}
                </p>
              )}
            </>
          )}

          {resultados && (
            <ul className="space-y-1.5">
              {resultados.map((r) => (
                <li key={r.leadId} className="flex items-start gap-2 text-sm">
                  {r.ok ? <Check className="text-emerald-600 shrink-0 mt-0.5" size={16} /> : <X className="text-rose-600 shrink-0 mt-0.5" size={16} />}
                  <span className="text-slate-700 dark:text-slate-200">
                    <b>{r.pacienteNome}</b>:{' '}
                    {r.ok
                      ? r.feito.length > 0 ? `preenchido (${r.feito.join(', ')})` : 'já estava preenchido, nada alterado'
                      : r.erro}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={aplicando}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {resultados || ajustes.length === 0 ? 'Fechar' : 'Cancelar'}
          </button>
          {!carregando && !resultados && ajustes.length > 0 && (
            <button
              type="button"
              disabled={aplicando || selecionados.length === 0}
              onClick={aplicar}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {aplicando && <Loader2 className="animate-spin" size={16} />}
              Aplicar a {selecionados.length} selecionado(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
