import React, { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { SiteContent, SiteImageRef, SiteImageSlot } from '../types';
import { siteContentService } from '../services/siteContentService';
import { useAuth } from '../contexts/AuthContext';

const SLOT_LABEL: Record<SiteImageSlot, string> = {
  hero: 'Topo da pagina',
  terapia: 'Metodo De Setti',
  assimetria: 'Card de assimetria craniana',
  torcicolo: 'Card de torcicolo congenito',
  bebeSorrindo: 'Como funciona',
  recemNascido: 'Sinais de atencao',
  raiza: 'Foto da profissional',
};

interface SiteImagesPanelProps {
  images: SiteContent['imagens'];
  onChange: (images: SiteContent['imagens']) => void;
}

/**
 * O Cloud Storage ainda nao foi provisionado neste projeto — desde out/2024 o
 * Firebase exige plano Blaze para criar bucket novo. Ate essa decisao, o upload
 * fica desabilitado e a troca de foto acontece pelo repositorio da landing page
 * (`public/img/`). A edicao de texto alternativo continua funcionando.
 *
 * Para religar: ativar Storage no console, publicar `storage.rules` e definir
 * VITE_STORAGE_ENABLED=true.
 */
const STORAGE_ENABLED =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_STORAGE_ENABLED) === 'true';

export default function SiteImagesPanel({ images, onChange }: SiteImagesPanelProps) {
  const { user } = useAuth();
  const whitelabelId = user?.activeWhitelabelId;
  const [uploading, setUploading] = useState<SiteImageSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateSlot = (slot: SiteImageSlot, value: SiteImageRef) => {
    onChange({ ...images, [slot]: value });
  };

  const handleUpload = async (slot: SiteImageSlot, file: File) => {
    setUploading(slot);
    setError(null);
    try {
      const ref = await siteContentService.uploadImage(file, slot, images[slot].alt, whitelabelId);
      updateSlot(slot, ref);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha no envio da imagem.');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}

      {STORAGE_ENABLED ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Prefira fotos claras, com luz natural. Ate 5 MB, em JPEG, PNG, WebP ou AVIF. O texto
          alternativo descreve a imagem para leitores de tela e para o Google.
        </p>
      ) : (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
          Envio de imagem indisponivel: o Cloud Storage ainda nao foi ativado neste projeto. A troca de
          fotos acontece pelo repositorio da landing page. O texto alternativo abaixo continua editavel.
        </p>
      )}

      {(Object.keys(SLOT_LABEL) as SiteImageSlot[]).map((slot) => {
        const image = images[slot];
        if (!image) return null;

        return (
          <div
            key={slot}
            className="flex flex-col sm:flex-row gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-24 w-32 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {SLOT_LABEL[slot]}
                </span>
                <span className="text-[11px] text-slate-400">
                  {image.width}×{image.height}
                </span>
              </div>
              <input
                value={image.alt}
                onChange={(e) => updateSlot(slot, { ...image, alt: e.target.value })}
                placeholder="Texto alternativo"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
              />
              {STORAGE_ENABLED && (
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  {uploading === slot ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Upload size={14} />
                  )}
                  Trocar imagem
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(slot, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
