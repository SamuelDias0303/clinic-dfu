import assert from 'node:assert/strict';
import { linkChamar, mensagemChamar, ordenarFila } from '../src/lib/listaEspera';
import type { Lead } from '../src/types';

const data = (iso: string) => ({ toDate: () => new Date(iso) });

function lead(parcial: Partial<Lead> & { id: string }): Lead {
  return {
    origem: 'landing-raiza',
    responsavel: 'Ana Souza',
    whatsapp: '+5561999998888',
    bebeIdadeFaixa: '3-6m',
    preocupacoes: ['Outro motivo'],
    observacoes: 'ok',
    consentimento: true,
    consentimentoTexto: 'x',
    status: 'LISTA_ESPERA',
    ...parcial,
  };
}

const ids = (leads: Lead[]) => leads.map((l) => l.id);

// Ordem por data de entrada (mais antigo primeiro)
assert.deepEqual(
  ids(ordenarFila([
    lead({ id: 'b', createdAt: data('2026-10-02T10:00:00Z') }),
    lead({ id: 'a', createdAt: data('2026-10-01T10:00:00Z') }),
  ])),
  ['a', 'b']
);

// Prioritarios primeiro; dentro de cada grupo, por data
assert.deepEqual(
  ids(ordenarFila([
    lead({ id: 'normal-velho', createdAt: data('2026-09-01T10:00:00Z') }),
    lead({ id: 'prio-novo', prioritario: true, createdAt: data('2026-10-03T10:00:00Z') }),
    lead({ id: 'prio-velho', prioritario: true, createdAt: data('2026-10-01T10:00:00Z') }),
    lead({ id: 'normal-novo', createdAt: data('2026-10-02T10:00:00Z') }),
  ])),
  ['prio-velho', 'prio-novo', 'normal-velho', 'normal-novo']
);

// So entra quem esta em LISTA_ESPERA
assert.deepEqual(
  ids(ordenarFila([
    lead({ id: 'fila', createdAt: data('2026-10-01T10:00:00Z') }),
    lead({ id: 'novo', status: 'NOVO', createdAt: data('2026-09-01T10:00:00Z') }),
    lead({ id: 'contato', status: 'EM_CONTATO', createdAt: data('2026-09-02T10:00:00Z') }),
  ])),
  ['fila']
);

// Review Focus 1: lead sem createdAt resolvido (serverTimestamp pendente) vai para o fim do grupo
assert.deepEqual(
  ids(ordenarFila([
    lead({ id: 'recem-criado' }),
    lead({ id: 'antigo', createdAt: data('2026-10-01T10:00:00Z') }),
  ])),
  ['antigo', 'recem-criado']
);

// Empate de data desempata por id (ordem estavel)
assert.deepEqual(
  ids(ordenarFila([
    lead({ id: 'z', createdAt: data('2026-10-01T10:00:00Z') }),
    lead({ id: 'a', createdAt: data('2026-10-01T10:00:00Z') }),
  ])),
  ['a', 'z']
);

// Fila vazia
assert.deepEqual(ordenarFila([]), []);

// Mensagem de chamada: com bebe, sem preposicao de genero
assert.equal(
  mensagemChamar({ responsavel: 'Ana Souza', bebeNome: 'Sofia' }),
  'Olá, Ana! Abriu uma vaga para a avaliação de Sofia. Podemos agendar?'
);

// Sem bebe
assert.equal(
  mensagemChamar({ responsavel: 'Ana Souza' }),
  'Olá, Ana! Abriu uma vaga para a avaliação do seu bebê. Podemos agendar?'
);

// Review Focus 4: espacos extras e nome vazio
assert.equal(
  mensagemChamar({ responsavel: '  maria   clara ', bebeNome: '  Leo ' }),
  'Olá, maria! Abriu uma vaga para a avaliação de Leo. Podemos agendar?'
);
assert.equal(
  mensagemChamar({ responsavel: '   ' }),
  'Olá! Abriu uma vaga para a avaliação do seu bebê. Podemos agendar?'
);

// Link: so digitos do WhatsApp, texto codificado
const link = linkChamar({ responsavel: 'Ana Souza', bebeNome: 'Sofia', whatsapp: '+55 (61) 99999-8888' });
assert.ok(link.startsWith('https://wa.me/5561999998888?text='));
assert.equal(
  decodeURIComponent(link.split('?text=')[1]),
  'Olá, Ana! Abriu uma vaga para a avaliação de Sofia. Podemos agendar?'
);

console.log('OK: lista de espera (ordenacao e mensagens).');
