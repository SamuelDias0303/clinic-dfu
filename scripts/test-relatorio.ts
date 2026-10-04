import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ordenarFila as ordenarFilaTS } from '../src/lib/listaEspera';
import type { Lead } from '../src/types';

const require = createRequire(import.meta.url);
const R = require('../tools/relatorio-diario/Relatorio.js');

// "Agora" = 05/10/2026 20:00 em Brasilia (23:00Z)
const AGORA = new Date('2026-10-05T23:00:00Z');

// --- decodificarDocumento -------------------------------------------------
const doc = {
  name: 'projects/clinic-dfu/databases/(default)/documents/whitelabels/raiza-fisio/leads/abc123',
  fields: {
    status: { stringValue: 'LISTA_ESPERA' },
    prioritario: { booleanValue: true },
    quantidade: { integerValue: '5' },
    nota: { doubleValue: 1.5 },
    createdAt: { timestampValue: '2026-10-01T10:00:00.123Z' },
    preocupacoes: { arrayValue: { values: [{ stringValue: 'A' }, { stringValue: 'B' }] } },
    vazio: { arrayValue: {} },
    endereco: { mapValue: { fields: { cidade: { stringValue: 'Brasilia' } } } },
    nada: { nullValue: null },
  },
};
assert.deepEqual(R.decodificarDocumento(doc), {
  id: 'abc123',
  status: 'LISTA_ESPERA',
  prioritario: true,
  quantidade: 5,
  nota: 1.5,
  createdAt: '2026-10-01T10:00:00.123Z',
  preocupacoes: ['A', 'B'],
  vazio: [],
  endereco: { cidade: 'Brasilia' },
  nada: null,
});
assert.deepEqual(R.decodificarDocumento({ name: 'x/y/z' }), { id: 'z' });

// --- datas em Brasilia (Review Focus 1) -----------------------------------
// 23:30 BRT de 05/10 = 02:30Z de 06/10 -> ainda e dia 05
assert.equal(R.diaBrasilia(new Date('2026-10-06T02:30:00Z')), '2026-10-05');
// 00:00 BRT de 06/10 = 03:00Z
assert.equal(R.diaBrasilia(new Date('2026-10-06T03:00:00Z')), '2026-10-06');
assert.deepEqual(R.ultimosDias(AGORA, 7), [
  '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
]);
assert.equal(R.rotuloDia('2026-10-05'), '05/10');

// --- primeiroNome ---------------------------------------------------------
assert.equal(R.primeiroNome('  Ana   Souza '), 'Ana');
assert.equal(R.primeiroNome(''), '—');
assert.equal(R.primeiroNome(undefined), '—');

// --- agregar --------------------------------------------------------------
type L = Record<string, unknown>;
const lead = (id: string, extra: L = {}): L => ({
  id, status: 'NOVO', prioritario: false, arquivado: false, responsavel: 'Fulano Tal',
  bebeNome: '', createdAt: '2026-10-01T10:00:00Z', ...extra,
});

const leads = [
  lead('a', { status: 'NOVO', createdAt: '2026-10-05T12:00:00Z' }),            // hoje, dentro das 24h
  lead('b', { status: 'NOVO', createdAt: '2026-10-04T10:00:00Z' }),            // ontem, fora das 24h
  lead('c', { status: 'LISTA_ESPERA', prioritario: true, responsavel: 'Ana Souza', bebeNome: 'Sofia', createdAt: '2026-10-01T10:00:00Z' }),
  lead('d', { status: 'LISTA_ESPERA', responsavel: 'Bruna Lima', createdAt: '2026-09-20T10:00:00Z' }),
  lead('e', { status: 'LISTA_ESPERA', responsavel: 'Carla Dias Silva', createdAt: null }),   // Review Focus 4
  lead('f', { status: 'EM_CONTATO' }),
  lead('g', { status: 'DESCARTADO', arquivado: true }),                         // arquivado: fora de tudo
  lead('h', { status: 'ESTRANHO' }),                                            // Review Focus 4
];
const r = R.agregar(leads, 2, AGORA);

assert.equal(r.total, 7);
assert.deepEqual(r.porStatus, {
  NOVO: 2, LISTA_ESPERA: 3, EM_CONTATO: 1, AGENDADO: 0, CONVERTIDO: 0, DESCARTADO: 0,
});
assert.equal(r.outros, 1);
assert.equal(r.novas24h, 1);                       // so o 'a'
assert.equal(r.dias.length, 7);
assert.equal(r.dias[6].dia, '2026-10-05');
assert.equal(r.dias[6].qtd, 1);                    // a
assert.equal(r.dias[5].qtd, 1);                    // b (04/10)
assert.equal(r.dias[2].qtd, 3);                    // 01/10: c, f e h
assert.equal(r.arquivadas, 1);
assert.equal(r.depoimentosPendentes, 2);
assert.equal(r.fila.tamanho, 3);
assert.equal(r.fila.prioritarios, 1);
assert.equal(r.fila.maisAntigaDias, 15);           // d: 20/09 10:00Z -> 05/10 23:00Z
assert.deepEqual(r.fila.top5.map((p: { primeiroNome: string }) => p.primeiroNome), ['Ana', 'Bruna', 'Carla']);
assert.deepEqual(r.fila.top5[0], {
  posicao: 1, primeiroNome: 'Ana', bebe: 'Sofia', esperaDias: 4, prioritario: true,
});
assert.equal(r.fila.top5[2].esperaDias, null);     // sem createdAt

// virada do dia: 23:30 BRT do dia 05 (= 02:30Z do dia 06) conta no dia 05 e nas 24h
const noite = R.agregar([lead('n', { createdAt: '2026-10-06T02:30:00Z' })], 0, new Date('2026-10-06T10:00:00Z'));
assert.equal(noite.dias[6].dia, '2026-10-06');     // "hoje" para quem le as 07:00 BRT de 06/10
assert.equal(noite.dias[5].dia, '2026-10-05');
assert.equal(noite.dias[5].qtd, 1);
assert.equal(noite.dias[6].qtd, 0);
assert.equal(noite.novas24h, 1);

// sem dados
const vazio = R.agregar([], 0, AGORA);
assert.equal(vazio.total, 0);
assert.equal(vazio.fila.tamanho, 0);
assert.equal(vazio.fila.maisAntigaDias, null);
assert.deepEqual(vazio.fila.top5, []);

// status herdado do prototipo nao pode virar contagem (ex.: 'constructor')
assert.equal(R.agregar([lead('x', { status: 'constructor' })], 0, AGORA).outros, 1);

// --- ordenarFila: paridade com src/lib/listaEspera.ts --------------------
const paraTS = (l: L): Lead => ({
  origem: 'x', responsavel: String(l.responsavel), whatsapp: '+5561999998888', bebeIdadeFaixa: '3-6m',
  preocupacoes: [], observacoes: 'ok', consentimento: true, consentimentoTexto: 'x',
  id: String(l.id), status: l.status as Lead['status'], prioritario: Boolean(l.prioritario),
  arquivado: Boolean(l.arquivado),
  createdAt: l.createdAt ? { toDate: () => new Date(String(l.createdAt)) } : undefined,
});
const paridade = [
  ...leads,
  lead('z', { status: 'LISTA_ESPERA', createdAt: '2026-10-01T10:00:00Z' }),   // empate de data com 'c' (sem prioridade)
  lead('y', { status: 'LISTA_ESPERA', prioritario: true, createdAt: '2026-10-02T10:00:00Z' }),
  lead('w', { status: 'LISTA_ESPERA', arquivado: true, prioritario: true }),
];
assert.deepEqual(
  R.ordenarFila(paridade).map((l: { id: string }) => l.id),
  ordenarFilaTS(paridade.map(paraTS)).map((l) => l.id)
);

// --- somar ----------------------------------------------------------------
const r2 = R.agregar([lead('q', { status: 'LISTA_ESPERA', createdAt: '2026-09-30T10:00:00Z' })], 1, AGORA);
const soma = R.somar([r, r2]);
assert.equal(soma.total, r.total + r2.total);
assert.equal(soma.porStatus.LISTA_ESPERA, 4);
assert.equal(soma.fila.tamanho, 4);
assert.equal(soma.fila.prioritarios, 1);
assert.equal(soma.fila.maisAntigaDias, 15);        // maior entre as filas
assert.equal(soma.depoimentosPendentes, 3);
assert.equal(soma.dias.length, 7);
assert.equal(soma.dias[6].qtd, r.dias[6].qtd + r2.dias[6].qtd);
assert.deepEqual(soma.fila.top5, []);

console.log('OK: relatorio (nucleo puro).');
