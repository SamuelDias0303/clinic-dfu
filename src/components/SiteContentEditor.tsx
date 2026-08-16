import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { SiteContent } from '../types';
import { siteContentService } from '../services/siteContentService';
import { isLegacyWhitelabel } from '../services/serviceScope';
import { useAuth } from '../contexts/AuthContext';
import SiteImagesPanel from './SiteImagesPanel';

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none';

function Field({
  label,
  value,
  onChange,
  hint,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

function Section({
  title,
  description,
  children,
  defaultOpen,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
          {description && (
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-slate-200 dark:border-slate-800 p-5 space-y-4">{children}</div>}
    </div>
  );
}

/** Editor generico de lista com adicionar, remover e reordenar. */
function ListEditor<T>({
  items,
  onChange,
  makeEmpty,
  renderItem,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  makeEmpty: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
              Item {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                aria-label="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                aria-label="Remover item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {renderItem(item, (patch) => {
            const next = [...items];
            next[index] = { ...items[index], ...patch };
            onChange(next);
          })}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmpty()])}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary"
      >
        <Plus size={16} /> {addLabel}
      </button>
    </div>
  );
}

export default function SiteContentEditor() {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;

  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'erro'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // O ambiente legado nao tem caminho isolado de whitelabel, entao nao tem site.
  const semTenantReal = !whitelabelId || isLegacyWhitelabel(whitelabelId);

  useEffect(() => {
    if (semTenantReal) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    siteContentService
      .getContent(whitelabelId)
      .then((content) => {
        if (active) setDraft(content);
      })
      .catch((error) => {
        console.error(error);
        if (active) setMessage({ tone: 'erro', text: 'Nao foi possivel carregar o conteudo.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [whitelabelId, semTenantReal]);

  const patch = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await siteContentService.saveContent(draft, whitelabelId, user?.email);
      setMessage({ tone: 'ok', text: 'Conteudo publicado. O site reflete a mudanca no proximo carregamento.' });
    } catch (error) {
      console.error(error);
      setMessage({ tone: 'erro', text: 'Nao foi possivel salvar. Verifique suas permissoes.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'site-content.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SiteContent;
      if (!parsed.hero || !parsed.imagens) {
        throw new Error('Estrutura invalida');
      }
      setDraft(parsed);
      setMessage({ tone: 'ok', text: 'JSON carregado. Revise e clique em Publicar para salvar.' });
    } catch (error) {
      console.error(error);
      setMessage({ tone: 'erro', text: 'Arquivo invalido. Use o JSON exportado da landing page.' });
    }
  };

  if (semTenantReal) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
        <p className="text-slate-600 dark:text-slate-300 font-medium">
          Selecione um whitelabel real para editar o conteudo do site.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O ambiente legado nao possui site publico associado.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Upload size={14} /> Importar JSON
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!draft}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={14} /> Exportar JSON
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Publicar
        </button>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
          }`}
        >
          {message.text}
        </p>
      )}

      {!draft ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            Nenhum conteudo publicado para este whitelabel.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Importe o arquivo <code>site-content.seed.json</code> do repositorio da landing page para
            comecar a partir do conteudo que ja esta no ar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dica: trechos entre <code>*asteriscos*</code> aparecem destacados no site.
          </p>

          <Section title="Topo da pagina" description="Primeira dobra: badge, titulo e botoes." defaultOpen>
            <Field label="Badge" value={draft.hero.badge} onChange={(v) => patch('hero', { ...draft.hero, badge: v })} />
            <Field
              label="Titulo"
              value={draft.hero.titulo}
              rows={2}
              hint="Ex.: O cuidado exato para o *desenvolvimento perfeito* do seu bebe."
              onChange={(v) => patch('hero', { ...draft.hero, titulo: v })}
            />
            <Field label="Subtitulo" value={draft.hero.subtitulo} rows={3} onChange={(v) => patch('hero', { ...draft.hero, subtitulo: v })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Botao principal" value={draft.hero.ctaPrimario} onChange={(v) => patch('hero', { ...draft.hero, ctaPrimario: v })} />
              <Field label="Botao secundario" value={draft.hero.ctaSecundario} onChange={(v) => patch('hero', { ...draft.hero, ctaSecundario: v })} />
              <Field label="Selo — titulo" value={draft.hero.seloTitulo} onChange={(v) => patch('hero', { ...draft.hero, seloTitulo: v })} />
              <Field label="Selo — subtitulo" value={draft.hero.seloSubtitulo} onChange={(v) => patch('hero', { ...draft.hero, seloSubtitulo: v })} />
            </div>
          </Section>

          <Section title="Faixa de selos" description="Credenciais logo abaixo do topo.">
            <ListEditor
              items={draft.trustBar}
              onChange={(items) => patch('trustBar', items)}
              makeEmpty={() => ({ icone: 'Award', titulo: '', detalhe: '' })}
              addLabel="Adicionar selo"
              renderItem={(item, update) => (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Icone" value={item.icone} hint="Nome do icone lucide" onChange={(v) => update({ icone: v })} />
                  <Field label="Titulo" value={item.titulo} onChange={(v) => update({ titulo: v })} />
                  <Field label="Detalhe" value={item.detalhe} onChange={(v) => update({ detalhe: v })} />
                </div>
              )}
            />
          </Section>

          <Section title="Sinais de atencao" description="Cards de sintomas que levam ao WhatsApp.">
            <Field label="Eyebrow" value={draft.sintomas.eyebrow} onChange={(v) => patch('sintomas', { ...draft.sintomas, eyebrow: v })} />
            <Field label="Titulo" value={draft.sintomas.titulo} onChange={(v) => patch('sintomas', { ...draft.sintomas, titulo: v })} />
            <Field label="Introducao" value={draft.sintomas.intro} rows={2} onChange={(v) => patch('sintomas', { ...draft.sintomas, intro: v })} />
            <ListEditor
              items={draft.sintomas.itens}
              onChange={(itens) => patch('sintomas', { ...draft.sintomas, itens })}
              makeEmpty={() => ({ titulo: '', texto: '', mensagem: '' })}
              addLabel="Adicionar sintoma"
              renderItem={(item, update) => (
                <>
                  <Field label="Titulo" value={item.titulo} onChange={(v) => update({ titulo: v })} />
                  <Field label="Texto" value={item.texto} rows={3} onChange={(v) => update({ texto: v })} />
                  <Field
                    label="Mensagem do WhatsApp"
                    value={item.mensagem}
                    rows={2}
                    hint="Texto que ja vem preenchido quando a pessoa clica no card."
                    onChange={(v) => update({ mensagem: v })}
                  />
                </>
              )}
            />
          </Section>

          <Section title="Especialidades">
            <Field label="Eyebrow" value={draft.especialidades.eyebrow} onChange={(v) => patch('especialidades', { ...draft.especialidades, eyebrow: v })} />
            <Field label="Titulo" value={draft.especialidades.titulo} onChange={(v) => patch('especialidades', { ...draft.especialidades, titulo: v })} />
            <Field label="Introducao" value={draft.especialidades.intro} rows={2} onChange={(v) => patch('especialidades', { ...draft.especialidades, intro: v })} />
            <ListEditor
              items={draft.especialidades.cards}
              onChange={(cards) => patch('especialidades', { ...draft.especialidades, cards })}
              makeEmpty={() => ({ titulo: '', texto: '' })}
              addLabel="Adicionar especialidade"
              renderItem={(item, update) => (
                <>
                  <Field label="Titulo" value={item.titulo} onChange={(v) => update({ titulo: v })} />
                  <Field label="Texto" value={item.texto} rows={3} onChange={(v) => update({ texto: v })} />
                </>
              )}
            />
          </Section>

          <Section title="Metodo De Setti">
            <Field label="Badge" value={draft.metodo.badge} onChange={(v) => patch('metodo', { ...draft.metodo, badge: v })} />
            <Field label="Titulo" value={draft.metodo.titulo} onChange={(v) => patch('metodo', { ...draft.metodo, titulo: v })} />
            <Field label="Introducao" value={draft.metodo.intro} rows={3} onChange={(v) => patch('metodo', { ...draft.metodo, intro: v })} />
            <ListEditor
              items={draft.metodo.pilares.map((texto) => ({ texto }))}
              onChange={(items) => patch('metodo', { ...draft.metodo, pilares: items.map((i) => i.texto) })}
              makeEmpty={() => ({ texto: '' })}
              addLabel="Adicionar pilar"
              renderItem={(item, update) => (
                <Field label="Pilar" value={item.texto} onChange={(v) => update({ texto: v })} />
              )}
            />
          </Section>

          <Section title="Como funciona">
            <Field label="Eyebrow" value={draft.comoFunciona.eyebrow} onChange={(v) => patch('comoFunciona', { ...draft.comoFunciona, eyebrow: v })} />
            <Field label="Titulo" value={draft.comoFunciona.titulo} onChange={(v) => patch('comoFunciona', { ...draft.comoFunciona, titulo: v })} />
            <ListEditor
              items={draft.comoFunciona.passos}
              onChange={(passos) => patch('comoFunciona', { ...draft.comoFunciona, passos })}
              makeEmpty={() => ({ numero: '', titulo: '', texto: '' })}
              addLabel="Adicionar passo"
              renderItem={(item, update) => (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3">
                    <Field label="Numero" value={item.numero} onChange={(v) => update({ numero: v })} />
                    <Field label="Titulo" value={item.titulo} onChange={(v) => update({ titulo: v })} />
                  </div>
                  <Field label="Texto" value={item.texto} rows={2} onChange={(v) => update({ texto: v })} />
                </>
              )}
            />
            <Field label="Destaque — titulo" value={draft.comoFunciona.destaqueTitulo} onChange={(v) => patch('comoFunciona', { ...draft.comoFunciona, destaqueTitulo: v })} />
            <Field label="Destaque — texto" value={draft.comoFunciona.destaqueTexto} rows={3} onChange={(v) => patch('comoFunciona', { ...draft.comoFunciona, destaqueTexto: v })} />
            <Field label="Destaque — botao" value={draft.comoFunciona.destaqueCta} onChange={(v) => patch('comoFunciona', { ...draft.comoFunciona, destaqueCta: v })} />
          </Section>

          <Section title="Sobre a profissional">
            <Field label="Eyebrow" value={draft.sobre.eyebrow} onChange={(v) => patch('sobre', { ...draft.sobre, eyebrow: v })} />
            <Field label="Titulo" value={draft.sobre.titulo} onChange={(v) => patch('sobre', { ...draft.sobre, titulo: v })} />
            <ListEditor
              items={draft.sobre.paragrafos.map((texto) => ({ texto }))}
              onChange={(items) => patch('sobre', { ...draft.sobre, paragrafos: items.map((i) => i.texto) })}
              makeEmpty={() => ({ texto: '' })}
              addLabel="Adicionar paragrafo"
              renderItem={(item, update) => (
                <Field label="Paragrafo" value={item.texto} rows={3} onChange={(v) => update({ texto: v })} />
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Selo — label" value={draft.sobre.seloLabel} onChange={(v) => patch('sobre', { ...draft.sobre, seloLabel: v })} />
              <Field label="Selo — valor" value={draft.sobre.seloValor} onChange={(v) => patch('sobre', { ...draft.sobre, seloValor: v })} />
              <Field label="Contador — valor" value={draft.sobre.contadorValor} onChange={(v) => patch('sobre', { ...draft.sobre, contadorValor: v })} />
              <Field label="Contador — texto" value={draft.sobre.contadorTexto} onChange={(v) => patch('sobre', { ...draft.sobre, contadorTexto: v })} />
            </div>
          </Section>

          <Section title="Depoimentos">
            <Field label="Eyebrow" value={draft.depoimentos.eyebrow} onChange={(v) => patch('depoimentos', { ...draft.depoimentos, eyebrow: v })} />
            <Field label="Titulo" value={draft.depoimentos.titulo} onChange={(v) => patch('depoimentos', { ...draft.depoimentos, titulo: v })} />
            <ListEditor
              items={draft.depoimentos.itens}
              onChange={(itens) => patch('depoimentos', { ...draft.depoimentos, itens })}
              makeEmpty={() => ({ texto: '', inicial: '', nome: '', papel: '' })}
              addLabel="Adicionar depoimento"
              renderItem={(item, update) => (
                <>
                  <Field label="Depoimento" value={item.texto} rows={4} onChange={(v) => update({ texto: v })} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Inicial" value={item.inicial} onChange={(v) => update({ inicial: v })} />
                    <Field label="Nome" value={item.nome} onChange={(v) => update({ nome: v })} />
                    <Field label="Descricao" value={item.papel} onChange={(v) => update({ papel: v })} />
                  </div>
                </>
              )}
            />
          </Section>

          <Section title="Duvidas frequentes" description="Tambem alimenta o FAQ estruturado para o Google.">
            <Field label="Eyebrow" value={draft.faq.eyebrow} onChange={(v) => patch('faq', { ...draft.faq, eyebrow: v })} />
            <Field label="Titulo" value={draft.faq.titulo} onChange={(v) => patch('faq', { ...draft.faq, titulo: v })} />
            <ListEditor
              items={draft.faq.itens}
              onChange={(itens) => patch('faq', { ...draft.faq, itens })}
              makeEmpty={() => ({ pergunta: '', resposta: '' })}
              addLabel="Adicionar pergunta"
              renderItem={(item, update) => (
                <>
                  <Field label="Pergunta" value={item.pergunta} onChange={(v) => update({ pergunta: v })} />
                  <Field label="Resposta" value={item.resposta} rows={4} onChange={(v) => update({ resposta: v })} />
                </>
              )}
            />
          </Section>

          <Section title="Chamada final e rodape">
            <Field label="Titulo" value={draft.ctaFinal.titulo} rows={2} onChange={(v) => patch('ctaFinal', { ...draft.ctaFinal, titulo: v })} />
            <Field label="Texto" value={draft.ctaFinal.texto} rows={2} onChange={(v) => patch('ctaFinal', { ...draft.ctaFinal, texto: v })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Botao" value={draft.ctaFinal.botao} onChange={(v) => patch('ctaFinal', { ...draft.ctaFinal, botao: v })} />
              <Field label="Linha de apoio" value={draft.ctaFinal.rodape} onChange={(v) => patch('ctaFinal', { ...draft.ctaFinal, rodape: v })} />
              <Field label="Rodape — nome" value={draft.footer.nome} onChange={(v) => patch('footer', { ...draft.footer, nome: v })} />
              <Field label="Rodape — subtitulo" value={draft.footer.subtitulo} onChange={(v) => patch('footer', { ...draft.footer, subtitulo: v })} />
              <Field label="CREFITO" value={draft.footer.crefito} onChange={(v) => patch('footer', { ...draft.footer, crefito: v })} />
              <Field label="Copyright" value={draft.footer.copyright} onChange={(v) => patch('footer', { ...draft.footer, copyright: v })} />
            </div>
          </Section>

          <Section title="Contato e SEO">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="WhatsApp"
                value={draft.contato.whatsapp}
                hint="Somente numeros, com pais e DDD. Ex.: 5561982087618"
                onChange={(v) => patch('contato', { ...draft.contato, whatsapp: v })}
              />
              <Field label="Instagram" value={draft.contato.instagram} onChange={(v) => patch('contato', { ...draft.contato, instagram: v })} />
            </div>
            <Field label="Titulo da aba (SEO)" value={draft.seo.titulo} onChange={(v) => patch('seo', { ...draft.seo, titulo: v })} />
            <Field label="Descricao (SEO)" value={draft.seo.descricao} rows={3} onChange={(v) => patch('seo', { ...draft.seo, descricao: v })} />
            <Field label="Titulo ao compartilhar" value={draft.seo.ogTitulo} onChange={(v) => patch('seo', { ...draft.seo, ogTitulo: v })} />
            <Field label="Descricao ao compartilhar" value={draft.seo.ogDescricao} rows={2} onChange={(v) => patch('seo', { ...draft.seo, ogDescricao: v })} />
          </Section>

          <Section title="Imagens" description="Envie fotos reais para substituir as imagens atuais.">
            <SiteImagesPanel
              images={draft.imagens}
              onChange={(imagens) => patch('imagens', imagens)}
            />
          </Section>
        </div>
      )}
    </div>
  );
}
