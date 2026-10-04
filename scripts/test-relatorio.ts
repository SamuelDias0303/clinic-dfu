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

// --- montarEmails: isolamento, privacidade, escape (Review Focus 2, 3, 5) --
const leadRaiza = (id: string, extra: L = {}): L => ({
  ...lead(id, extra),
  whatsapp: '+5561999998888',
  endereco: { logradouro: 'Rua Secreta', cidade: 'Brasilia' },
});

const dados = [
  {
    whitelabelId: 'raiza-fisio',
    nome: 'Raiza Freitas - Fisioterapia Pediatrica',
    depoimentosPendentes: 1,
    leads: [
      leadRaiza('r1', { status: 'LISTA_ESPERA', prioritario: true, responsavel: 'Ana Souza', bebeNome: 'Sofia', createdAt: '2026-10-01T10:00:00Z' }),
      leadRaiza('r2', { status: 'LISTA_ESPERA', responsavel: 'Bruna Lima', createdAt: '2026-09-20T10:00:00Z' }),
      leadRaiza('r3', { status: 'LISTA_ESPERA', responsavel: '<b>Eve</b> & "Cia"', createdAt: '2026-10-02T10:00:00Z' }),
      leadRaiza('r4', { status: 'NOVO', createdAt: '2026-10-05T12:00:00Z' }),
    ],
  },
  {
    whitelabelId: 'clinica-beta',
    nome: 'Clinica Beta',
    depoimentosPendentes: 0,
    leads: [
      leadRaiza('b1', { status: 'LISTA_ESPERA', responsavel: 'Zelia Pereira', createdAt: '2026-10-03T10:00:00Z' }),
    ],
  },
];
const destinatarios = [
  { email: 'raiza.fisio@gmail.com', tipo: 'TENANT', whitelabelId: 'raiza-fisio' },
  { email: 'smdb.ti@gmail.com', tipo: 'GLOBAL' },
];
const contexto = { agora: AGORA, backofficeUrl: 'https://clinic-dfu.web.app' };
const emails = R.montarEmails(destinatarios, dados, contexto);

assert.equal(emails.length, 2);
const [gestora, admin] = emails;
assert.equal(gestora.email, 'raiza.fisio@gmail.com');
assert.equal(admin.email, 'smdb.ti@gmail.com');

// assunto: data de Brasilia e tamanho da fila
assert.equal(gestora.assunto, 'Relatório diário — 05/10 — Lista de espera: 3');
assert.equal(admin.assunto, 'Relatório diário — 05/10 — Lista de espera: 4');

// isolamento: a gestora so ve o whitelabel dela (html e texto)
for (const corpo of [gestora.html, gestora.texto]) {
  assert.ok(corpo.includes('Raiza Freitas - Fisioterapia Pediatrica'));
  assert.ok(corpo.includes('Ana'));
  assert.ok(!corpo.includes('Clinica Beta'));
  assert.ok(!corpo.includes('Zelia'));
  assert.ok(!corpo.includes('Total consolidado'));
}
// o admin ve todos e o consolidado (ha mais de um whitelabel)
for (const corpo of [admin.html, admin.texto]) {
  assert.ok(corpo.includes('Raiza Freitas - Fisioterapia Pediatrica'));
  assert.ok(corpo.includes('Clinica Beta'));
  assert.ok(corpo.includes('Zelia'));
  assert.ok(corpo.includes('Total consolidado'));
}

// privacidade: sem telefone, endereco nem sobrenome
for (const corpo of [gestora.html, gestora.texto, admin.html, admin.texto]) {
  assert.ok(!corpo.includes('5561999998888'));
  assert.ok(!corpo.includes('Rua Secreta'));
  assert.ok(!corpo.includes('Souza'));
  assert.ok(!corpo.includes('Pereira'));
}
// primeiro nome + bebe
assert.ok(gestora.html.includes('Sofia'));

// escape de HTML (Review Focus 3): '<b>Eve</b> & "Cia"' -> primeiro nome '<b>Eve</b>'
assert.ok(!gestora.html.includes('<b>Eve</b>'));
assert.ok(gestora.html.includes('&lt;b&gt;Eve&lt;/b&gt;'));
assert.equal(R.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');

// documento HTML valido para e-mail: largura 600, link do backoffice, CSS inline
assert.ok(gestora.html.startsWith('<!doctype html>'));
assert.ok(gestora.html.includes('max-width:600px'));
assert.ok(gestora.html.includes('href="https://clinic-dfu.web.app"'));
assert.ok(!gestora.html.includes('<script'));

// sem dados (Review Focus 5)
const semDados = R.montarEmails(
  [{ email: 'raiza.fisio@gmail.com', tipo: 'TENANT', whitelabelId: 'raiza-fisio' }],
  [{ whitelabelId: 'raiza-fisio', nome: 'Raiza', leads: [], depoimentosPendentes: 0 }],
  contexto
);
assert.equal(semDados[0].assunto, 'Relatório diário — 05/10 — Lista de espera: 0');
assert.ok(semDados[0].html.includes('Ninguém na lista de espera'));
assert.ok(semDados[0].texto.includes('Ninguém na lista de espera'));

// GLOBAL com um unico whitelabel: sem bloco consolidado
const globalUnico = R.montarEmails([{ email: 'smdb.ti@gmail.com', tipo: 'GLOBAL' }], [dados[0]], contexto);
assert.ok(!globalUnico[0].html.includes('Total consolidado'));

// whitelabel inexistente e tipo invalido falham com mensagem clara
assert.throws(
  () => R.montarEmails([{ email: 'x@y.com', tipo: 'TENANT', whitelabelId: 'nao-existe' }], dados, contexto),
  /nao-existe/
);
assert.throws(
  () => R.montarEmails([{ email: 'x@y.com', tipo: 'OUTRO' }], dados, contexto),
  /OUTRO/
);

// dados estranhos nao derrubam (Review Focus 4): sem createdAt, status desconhecido, responsavel vazio
const estranhos = R.montarEmails(
  [{ email: 'smdb.ti@gmail.com', tipo: 'GLOBAL' }],
  [{
    whitelabelId: 'w', nome: undefined, depoimentosPendentes: undefined,
    leads: [
      { id: '1', status: 'LISTA_ESPERA', responsavel: '', createdAt: null },
      { id: '2', status: 'ESTRANHO' },
      { id: '3', status: 'LISTA_ESPERA', responsavel: 'Dani', bebeNome: undefined, createdAt: 'lixo' },
    ],
  }],
  contexto
);
assert.ok(estranhos[0].html.includes('Dani'));
assert.ok(estranhos[0].html.includes('—'));

console.log('OK: relatorio (nucleo puro).');
