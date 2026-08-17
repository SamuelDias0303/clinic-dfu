import { onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { TestimonialPendente, TestimonialStatus } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';
import { siteContentService } from './siteContentService';

export const testimonialService = {
  subscribeToPending(
    callback: (items: TestimonialPendente[]) => void,
    whitelabelId?: string | null
  ) {
    const q = query(scopedCollection(COLLECTIONS.depoimentosPendentes, whitelabelId));

    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as TestimonialPendente[];

      const pendentes = items.filter((item) => item.status === 'PENDENTE');

      // Ordenacao no cliente, mesmo padrao de leadService.
      const sorted = [...pendentes].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      callback(sorted);
    }, (error) => {
      console.error('Error subscribing to testimonials:', error);
      callback([]);
    });
  },

  async updateStatus(id: string, status: TestimonialStatus, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.depoimentosPendentes, id, whitelabelId);
    await updateDoc(docRef, {
      ...withTenantField({ status }, whitelabelId),
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Aprova o depoimento: copia para `siteContent.depoimentos.itens` (o array
   * publicado que a landing page le) e so entao marca o pendente como
   * aprovado. Se o conteudo do site ainda nao foi publicado, falha cedo em
   * vez de criar um documento parcial.
   */
  async approve(item: TestimonialPendente, whitelabelId?: string | null, updatedByEmail?: string) {
    if (!item.id) throw new Error('Depoimento sem id.');

    const current = await siteContentService.getContent(whitelabelId);
    if (!current) {
      throw new Error('O conteudo do site ainda nao foi publicado — publique antes de aprovar depoimentos.');
    }

    const inicial = item.nome.trim().charAt(0).toUpperCase() || '?';
    const novoItem = {
      texto: item.texto.trim(),
      inicial,
      nome: item.nome.trim(),
      papel: item.papel,
    };

    await siteContentService.saveContent(
      {
        ...current,
        depoimentos: {
          ...current.depoimentos,
          itens: [...current.depoimentos.itens, novoItem],
        },
      },
      whitelabelId,
      updatedByEmail
    );

    await this.updateStatus(item.id, 'APROVADO', whitelabelId);
  },

  async reject(id: string, whitelabelId?: string | null) {
    await this.updateStatus(id, 'REJEITADO', whitelabelId);
  },
};
