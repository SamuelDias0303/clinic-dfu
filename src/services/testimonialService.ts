import { onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { TestimonialPendente, TestimonialStatus } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';
import { siteContentService } from './siteContentService';

/**
 * Formato usado hoje nos depoimentos publicados: "Mae do Leo (3 meses)" ou,
 * sem bebe informado, so o papel puro ("Mae"). Singular quando o valor e 1
 * ("1 mes" / "1 ano"), plural nos demais casos.
 *
 * "do"/"da" e so um chute pela ultima letra do nome — nao ha genero
 * informado no formulario. E o ponto de partida editavel na tela de
 * moderacao, nao o texto final.
 */
export function formatarPapelPublicado(item: Pick<TestimonialPendente, 'papel' | 'bebeNome' | 'bebeIdadeValor' | 'bebeIdadeUnidade'>) {
  if (!item.bebeNome?.trim()) return item.papel;

  let idade = '';
  if (item.bebeIdadeValor != null && item.bebeIdadeUnidade) {
    const singular = item.bebeIdadeValor === 1;
    const unidade = item.bebeIdadeUnidade === 'meses'
      ? (singular ? 'mês' : 'meses')
      : (singular ? 'ano' : 'anos');
    idade = ` (${item.bebeIdadeValor} ${unidade})`;
  }

  const nome = item.bebeNome.trim();
  const preposicao = nome.toLowerCase().endsWith('a') ? 'da' : 'do';

  return `${item.papel} ${preposicao} ${nome}${idade}`;
}

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
   *
   * `papelPublicado` vem da tela de moderacao (pre-preenchido por
   * `formatarPapelPublicado`, mas editavel — a heuristica de genero "do/da"
   * nao acerta sempre, entao quem modera confere antes de publicar).
   */
  async approve(
    item: TestimonialPendente,
    papelPublicado: string,
    whitelabelId?: string | null,
    updatedByEmail?: string
  ) {
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
      papel: papelPublicado.trim() || item.papel,
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
