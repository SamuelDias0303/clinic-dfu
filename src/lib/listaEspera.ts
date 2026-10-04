import type { Lead } from '../types';

export const STATUS_LISTA_ESPERA = 'LISTA_ESPERA' as const;

/** Lead recem-criado ainda sem `createdAt` resolvido pelo servidor vai para o fim da fila. */
const SEM_DATA = Number.MAX_SAFE_INTEGER;

function dataEntrada(lead: Lead): number {
  const data = lead.createdAt?.toDate?.();
  return data ? data.getTime() : SEM_DATA;
}

/** Ativos: `arquivado` ausente ou false. Mantem a ordem recebida. */
export function naoArquivados(leads: Lead[]): Lead[] {
  return leads.filter((lead) => !lead.arquivado);
}

export function arquivados(leads: Lead[]): Lead[] {
  return leads.filter((lead) => lead.arquivado === true);
}

/**
 * Fila da lista de espera: so quem esta em LISTA_ESPERA e nao arquivado;
 * prioritarios primeiro; dentro de cada grupo, quem entrou antes. Nao depende
 * do interruptor `agenda.lotada` — desligar o interruptor nao esvazia a fila.
 */
export function ordenarFila(leads: Lead[]): Lead[] {
  return naoArquivados(leads)
    .filter((lead) => lead.status === STATUS_LISTA_ESPERA)
    .sort((a, b) => {
      if (Boolean(a.prioritario) !== Boolean(b.prioritario)) return a.prioritario ? -1 : 1;
      const diferenca = dataEntrada(a) - dataEntrada(b);
      if (diferenca !== 0) return diferenca;
      return (a.id ?? '').localeCompare(b.id ?? '');
    });
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** Sem "do/da": nao ha genero informado, e adivinhar errava (ver depoimentos). */
export function mensagemChamar(lead: Pick<Lead, 'responsavel' | 'bebeNome'>): string {
  const nome = primeiroNome(lead.responsavel);
  const saudacao = nome ? `Olá, ${nome}!` : 'Olá!';
  const bebe = lead.bebeNome?.trim() ? ` de ${lead.bebeNome.trim()}` : ' do seu bebê';
  return `${saudacao} Abriu uma vaga para a avaliação${bebe}. Podemos agendar?`;
}

export function linkChamar(lead: Pick<Lead, 'responsavel' | 'bebeNome' | 'whatsapp'>): string {
  const numero = lead.whatsapp.replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagemChamar(lead))}`;
}
