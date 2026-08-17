import React, { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { TestimonialPendente } from '../types';
import { formatarPapelPublicado, testimonialService } from '../services/testimonialService';
import { useAuth } from '../contexts/AuthContext';

export default function DepoimentosModeracao() {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;

  const [itens, setItens] = useState<TestimonialPendente[]>([]);
  const [papeisPublicados, setPapeisPublicados] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = testimonialService.subscribeToPending((data) => {
      setItens(data);
      // So preenche o rascunho de campos ainda nao editados pelo gestor.
      setPapeisPublicados((atual) => {
        const next = { ...atual };
        data.forEach((item) => {
          if (item.id && !(item.id in next)) next[item.id] = formatarPapelPublicado(item);
        });
        return next;
      });
      setLoading(false);
    }, whitelabelId);

    return () => unsubscribe();
  }, [whitelabelId]);

  const handleAprovar = async (item: TestimonialPendente) => {
    if (!item.id) return;
    setProcessandoId(item.id);
    setErro(null);
    try {
      const papelPublicado = papeisPublicados[item.id] ?? formatarPapelPublicado(item);
      await testimonialService.approve(item, papelPublicado, whitelabelId, user?.email);
    } catch (err) {
      console.error(err);
      setErro(err instanceof Error ? err.message : 'Nao foi possivel aprovar o depoimento.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleRejeitar = async (item: TestimonialPendente) => {
    if (!item.id) return;
    setProcessandoId(item.id);
    setErro(null);
    try {
      await testimonialService.reject(item.id, whitelabelId);
    } catch (err) {
      console.error(err);
      setErro('Nao foi possivel rejeitar o depoimento.');
    } finally {
      setProcessandoId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {erro}
        </p>
      )}

      {itens.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Nenhum depoimento pendente de revisao.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.nome}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.papel}
                    {item.bebeNome ? ` · Bebê: ${item.bebeNome}` : ''}
                    {item.bebeIdadeValor != null && item.bebeIdadeUnidade
                      ? ` (${item.bebeIdadeValor} ${item.bebeIdadeUnidade})`
                      : ''}
                    {item.whatsapp ? ` · ${item.whatsapp}` : ''}
                    {item.createdAt?.toDate?.() ? ` · ${item.createdAt.toDate().toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {item.texto}
              </p>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Como vai aparecer no site (confira o "do"/"da" antes de aprovar)
                </span>
                <input
                  value={papeisPublicados[item.id ?? ''] ?? ''}
                  onChange={(e) =>
                    setPapeisPublicados((atual) => ({ ...atual, [item.id ?? '']: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={processandoId === item.id}
                  onClick={() => handleAprovar(item)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processandoId === item.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Aprovar e publicar
                </button>
                <button
                  type="button"
                  disabled={processandoId === item.id}
                  onClick={() => handleRejeitar(item)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  <X size={16} />
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
