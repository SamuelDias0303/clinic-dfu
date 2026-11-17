import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { whitelabelLinksService } from '../services/whitelabelLinksService';
import { LEGACY_WHITELABEL_ID } from '../services/serviceScope';
import { Whitelabel } from '../types';

interface WhitelabelLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  whitelabel?: Whitelabel;
  // Todos os whitelabels carregados no backoffice; o modal tira o próprio e o legado.
  whitelabels: Whitelabel[];
}

export default function WhitelabelLinksModal({ isOpen, onClose, whitelabel, whitelabels }: WhitelabelLinksModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !whitelabel?.id) return;
    setLoading(true);
    const unsubscribe = whitelabelLinksService.subscribe(whitelabel.id, (links) => {
      setSelected(links?.targetIds ?? []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isOpen, whitelabel?.id]);

  if (!isOpen || !whitelabel?.id) return null;

  const options = whitelabels.filter((item) => item.id && item.id !== whitelabel.id && item.id !== LEGACY_WHITELABEL_ID);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const targets = options
        .filter((item) => selected.includes(item.id!))
        .map((item) => ({ id: item.id!, name: item.name, slug: item.slug }));
      await whitelabelLinksService.save(whitelabel.id!, targets);
      onClose();
    } catch (error) {
      console.error('Error saving whitelabel links:', error);
      alert('Erro ao salvar o compartilhamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Compartilhamento de pacientes</h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{whitelabel.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Os gestores de <strong>{whitelabel.name}</strong> poderão compartilhar pacientes com os whitelabels marcados abaixo.
            O vínculo vale só neste sentido: para o outro lado compartilhar de volta, marque também no whitelabel dele.
          </p>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-400">Não há outros whitelabels cadastrados.</p>
          ) : (
            <ul className="space-y-2">
              {options.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id!)}
                      onChange={() => toggle(item.id!)}
                      className="size-4 accent-primary"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                    <span className="text-xs text-slate-400">{item.slug}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Remover um destino não desfaz compartilhamentos já feitos. O gestor precisa descompartilhar os pacientes.
            Se um whitelabel for renomeado, abra este vínculo e salve de novo para atualizar o nome.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:p-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
