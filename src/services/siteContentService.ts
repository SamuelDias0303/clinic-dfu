import { getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { SITE_CONTENT_DOC_ID } from '../lib/tenantPaths';
import { SiteContent, SiteImageRef, SiteImageSlot } from '../types';
import { COLLECTIONS, scopedDoc, withTenantField } from './serviceScope';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

function contentDoc(whitelabelId?: string | null) {
  return scopedDoc(COLLECTIONS.siteContent, SITE_CONTENT_DOC_ID, whitelabelId);
}

export const siteContentService = {
  /** Retorna null quando o whitelabel ainda nao publicou conteudo. */
  async getContent(whitelabelId?: string | null): Promise<SiteContent | null> {
    const snapshot = await getDoc(contentDoc(whitelabelId));
    return snapshot.exists() ? (snapshot.data() as SiteContent) : null;
  },

  subscribeToContent(
    callback: (content: SiteContent | null) => void,
    whitelabelId?: string | null
  ) {
    return onSnapshot(contentDoc(whitelabelId), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as SiteContent) : null);
    }, (error) => {
      console.error('Error subscribing to site content:', error);
      callback(null);
    });
  },

  async saveContent(
    content: SiteContent,
    whitelabelId?: string | null,
    updatedByEmail?: string
  ) {
    await setDoc(
      contentDoc(whitelabelId),
      {
        ...withTenantField(
          { ...content, atualizadoPor: updatedByEmail } as unknown as Record<string, unknown>,
          whitelabelId
        ),
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Sobe a imagem para `whitelabels/{id}/site/{slot}` e devolve a referencia
   * pronta para gravar no conteudo. As dimensoes vem do proprio arquivo para
   * preservar width/height no HTML e nao reintroduzir layout shift no site.
   */
  async uploadImage(
    file: File,
    slot: SiteImageSlot,
    alt: string,
    whitelabelId?: string | null
  ): Promise<SiteImageRef> {
    if (!whitelabelId) {
      throw new Error('whitelabelId e obrigatorio para enviar imagem do site.');
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Formato invalido. Use JPEG, PNG, WebP ou AVIF.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Imagem muito grande. O limite e 5 MB.');
    }

    const dimensions = await readImageDimensions(file);
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const storagePath = `whitelabels/${whitelabelId}/site/${slot}.${extension}`;
    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, file, { contentType: file.type });
    const src = await getDownloadURL(fileRef);

    return { src, alt, width: dimensions.width, height: dimensions.height, storagePath };
  },
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nao foi possivel ler a imagem enviada.'));
    };
    image.src = url;
  });
}
