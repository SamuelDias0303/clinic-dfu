# Relatório diário por e-mail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo dia às 20:00 (Brasília), enviar por e-mail um relatório visual de solicitações e lista de espera: a gestora `raiza.fisio@gmail.com` recebe só o whitelabel `raiza-fisio`; o admin global `smdb.ti@gmail.com` recebe todos, com total consolidado.

**Architecture:** Um Google Apps Script (dono: `smdb.ti@gmail.com`) com gatilho diário lê o Firestore pela API REST usando uma conta de serviço somente leitura, monta o e-mail em HTML (tabelas e CSS inline) e envia com `MailApp`. Toda a regra (decodificação, agregação, fila, HTML, isolamento por destinatário) fica em `Relatorio.js`, um módulo puro testado no Node; `Code.gs` só faz rede, envio e gatilho.

**Tech Stack:** Google Apps Script (V8), Firestore REST, JavaScript puro (módulo CommonJS-compatível), `tsx` + `node:assert` para teste, HTML de e-mail com CSS inline.

**Spec:** `docs/superpowers/specs/2026-10-04-relatorio-diario-design.md` (neste repositório).

## Global Constraints

- Repositório: `C:/trabalho/codigo-fonte/clinic-dfu` (branch `main`). Nada de código novo fora de `tools/relatorio-diario/`, `scripts/` e `package.json`.
- Projeto Firebase/Google Cloud: `clinic-dfu` (número `63949686062`). Whitelabel da gestora: `raiza-fisio`. Coleções: `whitelabels/{id}/leads` e `whitelabels/{id}/depoimentosPendentes`.
- Destinatários (só em configuração, nunca no código): `raiza.fisio@gmail.com` → `{tipo: "TENANT", whitelabelId: "raiza-fisio"}`; `smdb.ti@gmail.com` → `{tipo: "GLOBAL"}`.
- Horário: ~20:00 `America/Sao_Paulo`, gatilho `atHour(20).nearMinute(0).everyDays(1)`. Fuso fixo UTC-3 (`OFFSET_BRASILIA_MIN = -180`; sem horário de verão).
- Assunto exato: `Relatório diário — DD/MM — Lista de espera: N` (travessão `—` com espaços; `N` = tamanho da fila; no GLOBAL, soma de todas as filas).
- Privacidade: o e-mail **nunca** contém telefone, endereço, observações, sobrenome nem e-mail do lead. Só **primeiro nome** do responsável e nome do bebê (se informado). Todo texto vindo do banco passa por `esc()`.
- Arquivados (`arquivado == true`) ficam fora de **todas** as contagens e da fila; aparecem só na linha `Arquivadas: N`.
- Fila: `status == 'LISTA_ESPERA'` e não arquivado; prioritários primeiro; depois `createdAt` crescente; sem `createdAt` vai para o fim; empate por `id` (`localeCompare`). Deve ser idêntica a `ordenarFila` em `src/lib/listaEspera.ts` (teste de paridade).
- `Relatorio.js` não pode usar nada de Apps Script nem de Node (sem `require`, `Utilities`, `Logger`); usar `var` e funções declaradas, compatível com V8 do Apps Script. Exporta com `if (typeof module !== 'undefined') module.exports = {...}`.
- **Segredos**: a chave JSON da conta de serviço só vive nas Propriedades do Script (`SA_KEY`). Nunca em arquivo do repositório, nunca em log, nunca em commit. Não ler nem reutilizar `service-account.json` (credencial de administrador do repositório).
- Cores (iguais ao site): texto `#2C3135`, suave `#6B7378`, verde `#5F7A6D`, terracota `#B4533A`, fundo `#F7F3EE`, borda `#E5DED3`. Largura do e-mail 600 px, legível no celular.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Shell: o diretório de trabalho reseta a cada chamada; sempre `cd C:/trabalho/codigo-fonte/clinic-dfu && comando` numa só chamada. Comandos `firebase`/`gcloud` precisam de `--project clinic-dfu`.
- Passos marcados **(PUBLICAÇÃO)** (push) ou **(USUÁRIO)** (ações no Google Cloud/Apps Script) exigem confirmação ou ação do usuário.
- Não há framework de teste: "teste" = `scripts/test-relatorio.ts` com `node:assert`, mais `npm run lint`.

## Review Focus

1. **Virada do dia em Brasília:** lead criado às 23:30 BRT (02:30Z do dia seguinte) cai no dia certo nas barras de 7 dias e na janela de 24 h. Teste na Tarefa 1.
2. **Isolamento TENANT × GLOBAL:** o e-mail da gestora nunca contém nome de outro whitelabel nem leads dele; o do admin contém todos e o total consolidado só quando há mais de um whitelabel. Testes na Tarefa 2.
3. **Injeção de HTML:** `responsavel`/`bebeNome` com `<b>`, `&` ou aspas aparecem escapados; telefone e sobrenome não vazam. Testes na Tarefa 2.
4. **Dados estranhos não derrubam o relatório:** lead sem `createdAt`, status desconhecido, `responsavel` vazio, `bebeNome` ausente. Testes nas tarefas 1 e 2.
5. **Sem dados e whitelabel único:** zero leads renderiza "Ninguém na lista de espera" sem quebrar; `TENANT` com whitelabel inexistente falha com mensagem clara em vez de e-mail vazio. Testes na Tarefa 2. (Idempotência e isolamento de falhas por destinatário vivem em `Code.gs`: verificação manual na Tarefa 5.)

---

### Task 1: Núcleo puro: decodificação, datas, fila e agregação

**Files:**
- Create: `tools/relatorio-diario/package.json`
- Create: `tools/relatorio-diario/Relatorio.js`
- Create: `scripts/test-relatorio.ts`
- Modify: `package.json` (script `test:relatorio`)

**Interfaces:**
- Produces (usadas pela Tarefa 2 e por `Code.gs`):
  - `decodificarDocumento(doc)` → objeto simples com `id`
  - `diaBrasilia(data: Date, offsetMin?)` → `'YYYY-MM-DD'`; `ultimosDias(agora, n, offsetMin?)` → `string[]`; `rotuloDia('YYYY-MM-DD')` → `'DD/MM'`
  - `ordenarFila(leads)`; `primeiroNome(nome)`
  - `agregar(leads, depoimentosPendentes, agora, offsetMin?)` → `Resumo` (formato abaixo)
  - `somar(resumos)` → `Resumo` consolidado (com `fila.top5 = []`)
  - constantes `STATUS_ORDEM`, `STATUS_ROTULO`, `OFFSET_BRASILIA_MIN`
- Formato de `Resumo`: `{ total, porStatus: {NOVO, LISTA_ESPERA, EM_CONTATO, AGENDADO, CONVERTIDO, DESCARTADO}, outros, novas24h, dias: [{dia, rotulo, qtd}] (7), fila: {tamanho, prioritarios, maisAntigaDias|null, top5: [{posicao, primeiroNome, bebe, esperaDias|null, prioritario}]}, arquivadas, depoimentosPendentes }`
- Formato de lead (entrada): `{ id, status, prioritario, arquivado, responsavel, bebeNome, createdAt (string ISO | null) }`.

- [ ] **Step 1: `package.json` da pasta (força CommonJS)**

O `package.json` da raiz tem `"type": "module"`; sem este arquivo o `Relatorio.js` seria tratado como ESM e `module.exports` não funcionaria no teste.

Criar `tools/relatorio-diario/package.json`:

```json
{
  "name": "relatorio-diario",
  "private": true,
  "type": "commonjs"
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `scripts/test-relatorio.ts`:

```ts
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
```

Os leads `c`, `f` e `h` têm `createdAt` de 01/10 (por isso `dias[2].qtd === 3`).

- [ ] **Step 3: Script npm e ver falhar**

Em `package.json`, depois de `"test:fila": ...`, acrescentar:

```json
    "test:relatorio": "tsx scripts/test-relatorio.ts",
```

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run test:relatorio`
Expected: FAIL com `Cannot find module '../tools/relatorio-diario/Relatorio.js'`.

- [ ] **Step 4: Implementar o núcleo**

Criar `tools/relatorio-diario/Relatorio.js`:

```js
/**
 * Logica pura do relatorio diario (sem rede, sem API do Apps Script).
 *
 * Roda igual no Apps Script (V8) e no Node (scripts/test-relatorio.ts). Por isso:
 * so `var` e funcoes declaradas, e o `module.exports` no fim e condicional.
 *
 * Formato do lead (ja decodificado): { id, status, prioritario, arquivado,
 * responsavel, bebeNome, createdAt (string ISO ou null) }.
 */

var STATUS_ORDEM = ['NOVO', 'LISTA_ESPERA', 'EM_CONTATO', 'AGENDADO', 'CONVERTIDO', 'DESCARTADO'];
var STATUS_ROTULO = {
  NOVO: 'Novo',
  LISTA_ESPERA: 'Lista de espera',
  EM_CONTATO: 'Em contato',
  AGENDADO: 'Agendado',
  CONVERTIDO: 'Convertido',
  DESCARTADO: 'Descartado',
};
/** Brasil nao tem horario de verao desde 2019: deslocamento fixo UTC-3. */
var OFFSET_BRASILIA_MIN = -180;
var MS_DIA = 24 * 60 * 60 * 1000;
var SEM_DATA = Number.MAX_SAFE_INTEGER;

// --- Firestore REST -> objeto simples --------------------------------------

function decodificarValor(valor) {
  if (valor === null || typeof valor !== 'object') return undefined;
  if ('stringValue' in valor) return valor.stringValue;
  if ('booleanValue' in valor) return valor.booleanValue;
  if ('integerValue' in valor) return Number(valor.integerValue);
  if ('doubleValue' in valor) return Number(valor.doubleValue);
  if ('timestampValue' in valor) return valor.timestampValue;
  if ('nullValue' in valor) return null;
  if ('arrayValue' in valor) return (valor.arrayValue.values || []).map(decodificarValor);
  if ('mapValue' in valor) return decodificarCampos(valor.mapValue.fields || {});
  return undefined;
}

function decodificarCampos(campos) {
  var objeto = {};
  Object.keys(campos).forEach(function (chave) {
    objeto[chave] = decodificarValor(campos[chave]);
  });
  return objeto;
}

function decodificarDocumento(doc) {
  var objeto = decodificarCampos(doc.fields || {});
  objeto.id = String(doc.name || '').split('/').pop();
  return objeto;
}

// --- Datas (Brasilia) ------------------------------------------------------

function diaBrasilia(data, offsetMin) {
  var deslocamento = offsetMin === undefined ? OFFSET_BRASILIA_MIN : offsetMin;
  return new Date(data.getTime() + deslocamento * 60000).toISOString().slice(0, 10);
}

/** Os `quantidade` dias-calendario de Brasilia que terminam em "hoje" (do mais antigo ao mais novo). */
function ultimosDias(agora, quantidade, offsetMin) {
  var dias = [];
  for (var i = quantidade - 1; i >= 0; i--) {
    dias.push(diaBrasilia(new Date(agora.getTime() - i * MS_DIA), offsetMin));
  }
  return dias;
}

function rotuloDia(dia) {
  return dia.slice(8, 10) + '/' + dia.slice(5, 7);
}

function dataEntrada(lead) {
  if (!lead.createdAt) return SEM_DATA;
  var tempo = Date.parse(lead.createdAt);
  return isNaN(tempo) ? SEM_DATA : tempo;
}

// --- Fila (mesma regra de src/lib/listaEspera.ts) --------------------------

function ordenarFila(leads) {
  return leads
    .filter(function (lead) { return !lead.arquivado && lead.status === 'LISTA_ESPERA'; })
    .sort(function (a, b) {
      if (Boolean(a.prioritario) !== Boolean(b.prioritario)) return a.prioritario ? -1 : 1;
      var diferenca = dataEntrada(a) - dataEntrada(b);
      if (diferenca !== 0) return diferenca;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function primeiroNome(nome) {
  var primeiro = String(nome || '').trim().split(/\s+/)[0];
  return primeiro || '—';
}

// --- Agregacao --------------------------------------------------------------

function agregar(leads, depoimentosPendentes, agora, offsetMin) {
  var ativos = leads.filter(function (lead) { return !lead.arquivado; });

  var porStatus = {};
  STATUS_ORDEM.forEach(function (status) { porStatus[status] = 0; });
  var outros = 0;
  ativos.forEach(function (lead) {
    if (Object.prototype.hasOwnProperty.call(porStatus, lead.status)) porStatus[lead.status]++;
    else outros++;
  });

  var agoraMs = agora.getTime();
  var novas24h = ativos.filter(function (lead) {
    var tempo = dataEntrada(lead);
    return tempo !== SEM_DATA && tempo > agoraMs - MS_DIA && tempo <= agoraMs;
  }).length;

  var dias = ultimosDias(agora, 7, offsetMin).map(function (dia) {
    var qtd = ativos.filter(function (lead) {
      var tempo = dataEntrada(lead);
      return tempo !== SEM_DATA && diaBrasilia(new Date(tempo), offsetMin) === dia;
    }).length;
    return { dia: dia, rotulo: rotuloDia(dia), qtd: qtd };
  });

  var fila = ordenarFila(leads);
  var datas = fila.map(dataEntrada).filter(function (tempo) { return tempo !== SEM_DATA; });
  var maisAntigaDias = datas.length
    ? Math.max(0, Math.floor((agoraMs - Math.min.apply(null, datas)) / MS_DIA))
    : null;

  var top5 = fila.slice(0, 5).map(function (lead, indice) {
    var tempo = dataEntrada(lead);
    return {
      posicao: indice + 1,
      primeiroNome: primeiroNome(lead.responsavel),
      bebe: lead.bebeNome ? String(lead.bebeNome).trim() : '',
      esperaDias: tempo === SEM_DATA ? null : Math.max(0, Math.floor((agoraMs - tempo) / MS_DIA)),
      prioritario: Boolean(lead.prioritario),
    };
  });

  return {
    total: ativos.length,
    porStatus: porStatus,
    outros: outros,
    novas24h: novas24h,
    dias: dias,
    fila: {
      tamanho: fila.length,
      prioritarios: fila.filter(function (lead) { return lead.prioritario; }).length,
      maisAntigaDias: maisAntigaDias,
      top5: top5,
    },
    arquivadas: leads.length - ativos.length,
    depoimentosPendentes: depoimentosPendentes || 0,
  };
}

/** Consolida varios resumos (visao global). Nao carrega nomes: `fila.top5` fica vazio. */
function somar(resumos) {
  var soma = {
    total: 0,
    porStatus: {},
    outros: 0,
    novas24h: 0,
    dias: [],
    fila: { tamanho: 0, prioritarios: 0, maisAntigaDias: null, top5: [] },
    arquivadas: 0,
    depoimentosPendentes: 0,
  };
  STATUS_ORDEM.forEach(function (status) { soma.porStatus[status] = 0; });

  resumos.forEach(function (resumo) {
    soma.total += resumo.total;
    STATUS_ORDEM.forEach(function (status) { soma.porStatus[status] += resumo.porStatus[status]; });
    soma.outros += resumo.outros;
    soma.novas24h += resumo.novas24h;
    resumo.dias.forEach(function (dia, indice) {
      if (!soma.dias[indice]) soma.dias[indice] = { dia: dia.dia, rotulo: dia.rotulo, qtd: 0 };
      soma.dias[indice].qtd += dia.qtd;
    });
    soma.fila.tamanho += resumo.fila.tamanho;
    soma.fila.prioritarios += resumo.fila.prioritarios;
    var antiga = resumo.fila.maisAntigaDias;
    if (antiga !== null && (soma.fila.maisAntigaDias === null || antiga > soma.fila.maisAntigaDias)) {
      soma.fila.maisAntigaDias = antiga;
    }
    soma.arquivadas += resumo.arquivadas;
    soma.depoimentosPendentes += resumo.depoimentosPendentes;
  });
  return soma;
}

if (typeof module !== 'undefined') {
  module.exports = {
    STATUS_ORDEM: STATUS_ORDEM,
    STATUS_ROTULO: STATUS_ROTULO,
    OFFSET_BRASILIA_MIN: OFFSET_BRASILIA_MIN,
    decodificarDocumento: decodificarDocumento,
    diaBrasilia: diaBrasilia,
    ultimosDias: ultimosDias,
    rotuloDia: rotuloDia,
    ordenarFila: ordenarFila,
    primeiroNome: primeiroNome,
    agregar: agregar,
    somar: somar,
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run test:relatorio`
Expected: PASS, saída `OK: relatorio (nucleo puro).`

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run lint && npm run test:fila && npm run test:local`
Expected: tudo passa (o `tsc` agora também lê `tools/relatorio-diario/Relatorio.js`; sem `checkJs` ele só faz parse).

- [ ] **Step 6: Commit**

```bash
cd C:/trabalho/codigo-fonte/clinic-dfu && git add tools/relatorio-diario/package.json tools/relatorio-diario/Relatorio.js scripts/test-relatorio.ts package.json && git commit -m "$(cat <<'EOF'
Adiciona nucleo puro do relatorio diario

Decodificacao de documentos do Firestore REST, datas em Brasilia
(UTC-3 fixo), fila identica a ordenarFila do backoffice (com teste de
paridade) e agregacao por status, ultimas 24 h, 7 dias e lista de
espera. Teste em npm run test:relatorio.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Montagem do e-mail (HTML/texto) e isolamento por destinatário

**Files:**
- Modify: `tools/relatorio-diario/Relatorio.js`
- Modify: `scripts/test-relatorio.ts`
- Create: `scripts/preview-relatorio.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `agregar`, `somar`, `diaBrasilia` (Tarefa 1).
- Produces:
  - `esc(texto)` → string escapada para HTML
  - `renderHtml(ctx)` e `renderTexto(ctx)` com `ctx = { dataRotulo: 'DD/MM/AAAA', backofficeUrl, consolidado: Resumo|null, secoes: [{nome, resumo}] }`
  - `montarEmails(destinatarios, dados, contexto)` → `[{ email, assunto, html, texto }]`, com:
    - `destinatarios`: `[{ email, tipo: 'TENANT'|'GLOBAL', whitelabelId? }]`
    - `dados`: `[{ whitelabelId, nome, leads, depoimentosPendentes (número) }]`
    - `contexto`: `{ agora: Date, backofficeUrl: string, offsetMin?: number }`

- [ ] **Step 1: Acrescentar os testes (falham)**

Em `scripts/test-relatorio.ts`, **antes** da linha `console.log('OK: relatorio (nucleo puro).');`, acrescentar:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run test:relatorio`
Expected: FAIL com `R.montarEmails is not a function`.

- [ ] **Step 3: Implementar a renderização e `montarEmails`**

Em `tools/relatorio-diario/Relatorio.js`, **antes** do bloco `if (typeof module !== 'undefined') {`, acrescentar:

```js
// --- Renderizacao ------------------------------------------------------------

var COR = {
  texto: '#2C3135',
  suave: '#6B7378',
  verde: '#5F7A6D',
  terracota: '#B4533A',
  fundo: '#F7F3EE',
  borda: '#E5DED3',
};

function esc(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cartao(rotulo, valor, destaque) {
  var cor = destaque ? COR.terracota : COR.verde;
  return (
    '<td width="33%" style="padding:4px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ' + COR.borda + ';border-radius:10px">' +
    '<tr><td align="center" style="padding:12px 4px">' +
    '<div style="font-size:26px;font-weight:bold;color:' + cor + ';line-height:1.1">' + esc(valor) + '</div>' +
    '<div style="font-size:11px;color:' + COR.suave + ';text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">' + esc(rotulo) + '</div>' +
    '</td></tr></table></td>'
  );
}

function blocoStatus(resumo) {
  var celulas = STATUS_ORDEM.map(function (status) {
    return cartao(STATUS_ROTULO[status], resumo.porStatus[status], status === 'LISTA_ESPERA');
  });
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr>' + celulas.slice(0, 3).join('') + '</tr>' +
    '<tr>' + celulas.slice(3, 6).join('') + '</tr>' +
    '</table>'
  );
}

function blocoBarras(dias) {
  var maximo = 0;
  dias.forEach(function (dia) { if (dia.qtd > maximo) maximo = dia.qtd; });
  var linhas = dias.map(function (dia) {
    var largura = maximo === 0 ? 0 : Math.max(4, Math.round((dia.qtd / maximo) * 100));
    var barra = dia.qtd === 0
      ? ''
      : '<table role="presentation" width="' + largura + '%" cellpadding="0" cellspacing="0"><tr>' +
        '<td height="14" bgcolor="' + COR.verde + '" style="background:' + COR.verde + ';border-radius:4px;font-size:0;line-height:0">&nbsp;</td>' +
        '</tr></table>';
    return (
      '<tr>' +
      '<td width="46" style="font-size:12px;color:' + COR.suave + ';padding:3px 0">' + esc(dia.rotulo) + '</td>' +
      '<td style="padding:3px 6px">' + barra + '</td>' +
      '<td width="28" align="right" style="font-size:12px;font-weight:bold;color:' + COR.texto + '">' + dia.qtd + '</td>' +
      '</tr>'
    );
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhas.join('') + '</table>';
}

function textoAntiguidade(fila) {
  return fila.maisAntigaDias === null ? '' : ' · mais antigo há ' + fila.maisAntigaDias + ' dia(s)';
}

function blocoFila(fila) {
  if (fila.tamanho === 0) {
    return '<p style="font-size:14px;color:' + COR.suave + ';margin:0">Ninguém na lista de espera.</p>';
  }
  var resumo =
    '<p style="font-size:14px;color:' + COR.texto + ';margin:0 0 8px">' +
    fila.tamanho + ' na fila · ' + fila.prioritarios + ' prioritário(s)' + textoAntiguidade(fila) + '</p>';
  if (fila.top5.length === 0) return resumo;
  var linhas = fila.top5.map(function (pessoa) {
    var bebe = pessoa.bebe
      ? ' <span style="color:' + COR.suave + '">(bebê ' + esc(pessoa.bebe) + ')</span>'
      : '';
    var espera = pessoa.esperaDias === null ? '—' : pessoa.esperaDias + ' d';
    return (
      '<tr>' +
      '<td width="28" style="font-size:13px;font-weight:bold;color:' + COR.verde + ';padding:4px 0">' + pessoa.posicao + '</td>' +
      '<td style="font-size:13px;color:' + COR.texto + ';padding:4px 0">' +
      (pessoa.prioritario ? '<span style="color:#E0A100">★</span> ' : '') + esc(pessoa.primeiroNome) + bebe + '</td>' +
      '<td width="50" align="right" style="font-size:12px;color:' + COR.suave + ';padding:4px 0">' + espera + '</td>' +
      '</tr>'
    );
  });
  return resumo + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhas.join('') + '</table>';
}

function subtitulo(texto) {
  return '<div style="font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:' + COR.suave + ';margin:18px 0 8px">' + esc(texto) + '</div>';
}

function blocoSecao(titulo, resumo) {
  var rodape =
    'Depoimentos aguardando moderação: ' + resumo.depoimentosPendentes +
    ' · Arquivadas: ' + resumo.arquivadas + ' (fora das contagens)' +
    (resumo.outros > 0 ? ' · Outros status: ' + resumo.outros : '');
  return (
    '<div style="margin-top:22px">' +
    '<div style="font-size:17px;font-weight:bold;color:' + COR.texto + ';border-bottom:2px solid ' + COR.verde + ';padding-bottom:6px">' + esc(titulo) + '</div>' +
    '<p style="font-size:14px;color:' + COR.texto + ';margin:10px 0">' +
    '<b>' + resumo.total + '</b> solicitações ativas · <b>' + resumo.novas24h + '</b> nas últimas 24 h</p>' +
    blocoStatus(resumo) +
    subtitulo('Últimos 7 dias') +
    blocoBarras(resumo.dias) +
    subtitulo('Lista de espera') +
    blocoFila(resumo.fila) +
    '<p style="font-size:12px;color:' + COR.suave + ';margin:14px 0 0">' + esc(rodape) + '</p>' +
    '</div>'
  );
}

function renderHtml(ctx) {
  var corpo = '';
  if (ctx.consolidado) corpo += blocoSecao('Total consolidado', ctx.consolidado);
  ctx.secoes.forEach(function (secao) { corpo += blocoSecao(secao.nome, secao.resumo); });
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + COR.fundo + ';font-family:Arial,Helvetica,sans-serif;color:' + COR.texto + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + COR.fundo + '"><tr><td align="center" style="padding:16px 8px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px"><tr><td style="padding:20px">' +
    '<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:' + COR.verde + '">Relatório diário</div>' +
    '<div style="font-size:22px;font-weight:bold;margin:4px 0 0">' + esc(ctx.dataRotulo) + '</div>' +
    corpo +
    '<a href="' + esc(ctx.backofficeUrl) + '" style="display:inline-block;margin-top:24px;background:' + COR.terracota + ';color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">Abrir backoffice</a>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

function textoSecao(titulo, resumo) {
  var linhas = [
    '== ' + titulo + ' ==',
    'Ativas: ' + resumo.total + ' | Novas nas últimas 24 h: ' + resumo.novas24h,
    STATUS_ORDEM.map(function (status) { return STATUS_ROTULO[status] + ': ' + resumo.porStatus[status]; }).join(' | '),
    'Últimos 7 dias: ' + resumo.dias.map(function (dia) { return dia.rotulo + '=' + dia.qtd; }).join(' '),
  ];
  if (resumo.fila.tamanho === 0) {
    linhas.push('Ninguém na lista de espera.');
  } else {
    linhas.push('Lista de espera: ' + resumo.fila.tamanho + ' (' + resumo.fila.prioritarios + ' prioritário(s))' + textoAntiguidade(resumo.fila));
    resumo.fila.top5.forEach(function (pessoa) {
      linhas.push(
        pessoa.posicao + '. ' + (pessoa.prioritario ? '★ ' : '') + pessoa.primeiroNome +
        (pessoa.bebe ? ' (bebê ' + pessoa.bebe + ')' : '') +
        ' — ' + (pessoa.esperaDias === null ? '—' : pessoa.esperaDias + ' d')
      );
    });
  }
  linhas.push(
    'Depoimentos aguardando moderação: ' + resumo.depoimentosPendentes +
    ' | Arquivadas: ' + resumo.arquivadas + ' (fora das contagens)' +
    (resumo.outros > 0 ? ' | Outros status: ' + resumo.outros : '')
  );
  return linhas.join('\n');
}

function renderTexto(ctx) {
  var partes = ['Relatório diário — ' + ctx.dataRotulo];
  if (ctx.consolidado) partes.push(textoSecao('Total consolidado', ctx.consolidado));
  ctx.secoes.forEach(function (secao) { partes.push(textoSecao(secao.nome, secao.resumo)); });
  partes.push('Backoffice: ' + ctx.backofficeUrl);
  return partes.join('\n\n');
}

// --- Montagem por destinatario (isolamento) ---------------------------------

/**
 * `TENANT` recebe somente o whitelabel dele; `GLOBAL` recebe todos (e o total
 * consolidado quando ha mais de um). Os dados dos outros whitelabels podem
 * estar em `dados`, mas nunca entram no e-mail de um `TENANT`.
 */
function montarEmails(destinatarios, dados, contexto) {
  var agora = contexto.agora;
  var offsetMin = contexto.offsetMin;
  var dia = diaBrasilia(agora, offsetMin);
  var dataRotulo = dia.slice(8, 10) + '/' + dia.slice(5, 7) + '/' + dia.slice(0, 4);

  return destinatarios.map(function (destinatario) {
    var escolhidos;
    if (destinatario.tipo === 'GLOBAL') {
      escolhidos = dados;
    } else if (destinatario.tipo === 'TENANT') {
      escolhidos = dados.filter(function (item) { return item.whitelabelId === destinatario.whitelabelId; });
      if (escolhidos.length === 0) {
        throw new Error('Whitelabel nao encontrado para ' + destinatario.email + ': ' + destinatario.whitelabelId);
      }
    } else {
      throw new Error('Tipo de destinatario invalido para ' + destinatario.email + ': ' + destinatario.tipo);
    }

    var secoes = escolhidos.map(function (item) {
      return {
        nome: item.nome || item.whitelabelId,
        resumo: agregar(item.leads || [], item.depoimentosPendentes, agora, offsetMin),
      };
    });
    var resumos = secoes.map(function (secao) { return secao.resumo; });
    var consolidado = destinatario.tipo === 'GLOBAL' && secoes.length > 1 ? somar(resumos) : null;
    var tamanhoFila = resumos.reduce(function (acumulado, resumo) { return acumulado + resumo.fila.tamanho; }, 0);

    var ctx = {
      dataRotulo: dataRotulo,
      backofficeUrl: contexto.backofficeUrl,
      consolidado: consolidado,
      secoes: secoes,
    };
    return {
      email: destinatario.email,
      assunto: 'Relatório diário — ' + dataRotulo.slice(0, 5) + ' — Lista de espera: ' + tamanhoFila,
      html: renderHtml(ctx),
      texto: renderTexto(ctx),
    };
  });
}
```

E, dentro do `module.exports = { ... }`, acrescentar as chaves:

```js
    esc: esc,
    renderHtml: renderHtml,
    renderTexto: renderTexto,
    montarEmails: montarEmails,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run test:relatorio`
Expected: PASS, saída `OK: relatorio (nucleo puro).`

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run lint && npm run test:fila && npm run test:local`
Expected: tudo passa.

- [ ] **Step 5: Script de pré-visualização (conferência visual)**

Criar `scripts/preview-relatorio.ts`:

```ts
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const R = require('../tools/relatorio-diario/Relatorio.js');

/** Gera tools/relatorio-diario/preview/*.html com dados FICTICIOS, para abrir no navegador. */
const AGORA = new Date('2026-10-05T23:00:00Z');
const lead = (id: string, extra: Record<string, unknown> = {}) => ({
  id, status: 'NOVO', prioritario: false, arquivado: false, responsavel: 'Fulana Tal', bebeNome: '',
  createdAt: '2026-10-04T12:00:00Z', ...extra,
});
const dados = [
  {
    whitelabelId: 'raiza-fisio', nome: 'Raiza Freitas - Fisioterapia Pediatrica', depoimentosPendentes: 2,
    leads: [
      lead('1', { status: 'LISTA_ESPERA', prioritario: true, responsavel: 'Ana Souza', bebeNome: 'Sofia', createdAt: '2026-10-01T10:00:00Z' }),
      lead('2', { status: 'LISTA_ESPERA', responsavel: 'Bruna Lima', createdAt: '2026-09-20T10:00:00Z' }),
      lead('3', { status: 'LISTA_ESPERA', responsavel: 'Carla Dias', bebeNome: 'Leo', createdAt: '2026-10-03T10:00:00Z' }),
      lead('4', { status: 'NOVO', createdAt: '2026-10-05T12:00:00Z' }),
      lead('5', { status: 'NOVO', createdAt: '2026-10-05T14:00:00Z' }),
      lead('6', { status: 'EM_CONTATO', createdAt: '2026-10-02T10:00:00Z' }),
      lead('7', { status: 'AGENDADO', createdAt: '2026-10-03T10:00:00Z' }),
      lead('8', { status: 'CONVERTIDO', createdAt: '2026-09-30T10:00:00Z' }),
      lead('9', { status: 'DESCARTADO', arquivado: true }),
    ],
  },
  {
    whitelabelId: 'clinica-beta', nome: 'Clinica Beta', depoimentosPendentes: 0,
    leads: [lead('b1', { status: 'LISTA_ESPERA', responsavel: 'Zelia Pereira', createdAt: '2026-10-03T10:00:00Z' })],
  },
];
const emails = R.montarEmails(
  [
    { email: 'raiza.fisio@gmail.com', tipo: 'TENANT', whitelabelId: 'raiza-fisio' },
    { email: 'smdb.ti@gmail.com', tipo: 'GLOBAL' },
  ],
  dados,
  { agora: AGORA, backofficeUrl: 'https://clinic-dfu.web.app' }
);

const pasta = resolve(process.cwd(), 'tools', 'relatorio-diario', 'preview');
mkdirSync(pasta, { recursive: true });
writeFileSync(resolve(pasta, 'gestora.html'), emails[0].html);
writeFileSync(resolve(pasta, 'admin.html'), emails[1].html);
console.log(`Preview gerado em ${pasta} (gestora.html, admin.html)`);
```

Em `.gitignore`, acrescentar uma linha:

```
tools/relatorio-diario/preview/
```

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npx tsx scripts/preview-relatorio.ts`
Expected: `Preview gerado em ...\tools\relatorio-diario\preview (gestora.html, admin.html)`.

Conferir visualmente: abrir `tools/relatorio-diario/preview/admin.html` no navegador (por exemplo `preview_start` com `url` `file:///C:/trabalho/codigo-fonte/clinic-dfu/tools/relatorio-diario/preview/admin.html`, ou abrir o arquivo à mão). Verificar: cartões legíveis, barras proporcionais, fila com ★ e primeiro nome, largura de celular (redimensionar para 375 px) sem rolagem horizontal.

- [ ] **Step 6: Commit**

```bash
cd C:/trabalho/codigo-fonte/clinic-dfu && git add tools/relatorio-diario/Relatorio.js scripts/test-relatorio.ts scripts/preview-relatorio.ts .gitignore && git commit -m "$(cat <<'EOF'
Monta o e-mail do relatorio diario com isolamento por destinatario

HTML de e-mail (tabelas e CSS inline) com cartoes por status, barras
dos ultimos 7 dias e fila, mais versao em texto. TENANT recebe so o
whitelabel dele; GLOBAL recebe todos e o total consolidado. Sem
telefone, endereco ou sobrenome; todo texto do banco e escapado.
Script de pre-visualizacao com dados ficticios.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `Code.gs` e manifesto do Apps Script

**Files:**
- Create: `tools/relatorio-diario/Code.gs`
- Create: `tools/relatorio-diario/appsscript.json`

**Interfaces:**
- Consumes (globais de `Relatorio.js`, no mesmo projeto Apps Script): `decodificarDocumento`, `montarEmails`, `diaBrasilia`.
- Produces (funções públicas do Apps Script): `enviarRelatorio(opcoes)`, `testarSemEnviar()`, `criarGatilhoDiario()`.
- Propriedades do Script: `SA_KEY` (JSON da conta de serviço) e `CONFIG` (JSON de destinatários), mais `ultimoEnvio:<email>` (data `YYYY-MM-DD`).

`Code.gs` roda só dentro do Apps Script (usa `UrlFetchApp`, `Utilities`, `PropertiesService`, `MailApp`, `ScriptApp`, `CacheService`, `Logger`); a verificação aqui é de **sintaxe** e de leitura do código. O comportamento real é conferido na Tarefa 5.

- [ ] **Step 1: Criar o manifesto**

`tools/relatorio-diario/appsscript.json`:

```json
{
  "timeZone": "America/Sao_Paulo",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

- [ ] **Step 2: Criar `Code.gs`**

```js
/**
 * Relatorio diario por e-mail (Apps Script). A regra de negocio esta em
 * Relatorio.js (colado no mesmo projeto como Relatorio.gs); aqui so ha rede,
 * envio e gatilho.
 *
 * Propriedades do Script (Configuracoes do projeto > Propriedades do script):
 *   SA_KEY  JSON da chave da conta de serviço somente leitura (NUNCA fora daqui)
 *   CONFIG  { "backofficeUrl": "...", "destinatarios": [ { "email", "tipo": "TENANT"|"GLOBAL", "whitelabelId"? } ] }
 */

var PROJETO_FIRESTORE = 'clinic-dfu';
var FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/' + PROJETO_FIRESTORE + '/databases/(default)/documents';
var CAMPOS_LEAD = ['status', 'prioritario', 'arquivado', 'responsavel', 'bebeNome', 'createdAt'];

// --- Autenticacao (conta de servico -> token OAuth) --------------------------

function base64Url_(valor) {
  return Utilities.base64EncodeWebSafe(valor).replace(/=+$/, '');
}

function gerarToken_() {
  var bruto = PropertiesService.getScriptProperties().getProperty('SA_KEY');
  if (!bruto) throw new Error('Propriedade SA_KEY nao configurada.');
  var chave = JSON.parse(bruto);
  var agora = Math.floor(Date.now() / 1000);
  var entrada =
    base64Url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    base64Url_(JSON.stringify({
      iss: chave.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    }));
  var assinatura = Utilities.computeRsaSha256Signature(entrada, chave.private_key);
  var resposta = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: entrada + '.' + base64Url_(assinatura),
    },
    muteHttpExceptions: true,
  });
  // Nao registrar o corpo da resposta nem a chave: so o codigo HTTP.
  if (resposta.getResponseCode() !== 200) {
    throw new Error('Falha ao obter token da conta de servico: HTTP ' + resposta.getResponseCode());
  }
  var token = JSON.parse(resposta.getContentText()).access_token;
  CacheService.getScriptCache().put('sa_token', token, 3000);
  return token;
}

function obterToken_() {
  return CacheService.getScriptCache().get('sa_token') || gerarToken_();
}

// --- Firestore REST -------------------------------------------------------------

/** Lista todos os documentos de uma colecao (paginado), ja decodificados. */
function listarColecao_(caminho, campos) {
  var token = obterToken_();
  var documentos = [];
  var pagina = '';
  do {
    var url = FIRESTORE_BASE + '/' + caminho + '?pageSize=300';
    campos.forEach(function (campo) { url += '&mask.fieldPaths=' + encodeURIComponent(campo); });
    if (pagina) url += '&pageToken=' + encodeURIComponent(pagina);
    var resposta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (resposta.getResponseCode() !== 200) {
      throw new Error('Firestore ' + caminho + ': HTTP ' + resposta.getResponseCode());
    }
    var corpo = JSON.parse(resposta.getContentText());
    (corpo.documents || []).forEach(function (doc) { documentos.push(decodificarDocumento(doc)); });
    pagina = corpo.nextPageToken || '';
  } while (pagina);
  return documentos;
}

/** Le leads e depoimentos pendentes dos whitelabels necessarios para os destinatarios. */
function coletarDados_(destinatarios) {
  var global = destinatarios.some(function (d) { return d.tipo === 'GLOBAL'; });
  var mapaNomes = {};
  var ids = [];

  if (global) {
    listarColecao_('whitelabels', ['name']).forEach(function (wl) {
      ids.push(wl.id);
      mapaNomes[wl.id] = wl.name;
    });
  } else {
    destinatarios.forEach(function (d) {
      if (ids.indexOf(d.whitelabelId) === -1) ids.push(d.whitelabelId);
    });
    // Nomes dos whitelabels pedidos (uma leitura da colecao pequena).
    listarColecao_('whitelabels', ['name']).forEach(function (wl) { mapaNomes[wl.id] = wl.name; });
  }

  return ids.map(function (id) {
    var leads = listarColecao_('whitelabels/' + id + '/leads', CAMPOS_LEAD);
    var pendentes = listarColecao_('whitelabels/' + id + '/depoimentosPendentes', ['status'])
      .filter(function (doc) { return doc.status === 'PENDENTE'; }).length;
    return { whitelabelId: id, nome: mapaNomes[id] || id, leads: leads, depoimentosPendentes: pendentes };
  });
}

// --- Envio -----------------------------------------------------------------------

function lerConfig_() {
  var bruto = PropertiesService.getScriptProperties().getProperty('CONFIG');
  if (!bruto) throw new Error('Propriedade CONFIG nao configurada.');
  var config = JSON.parse(bruto);
  if (!config.destinatarios || config.destinatarios.length === 0) {
    throw new Error('CONFIG sem destinatarios.');
  }
  return config;
}

/**
 * Funcao do gatilho diario. `opcoes.forcar = true` ignora a trava "ja enviei hoje"
 * (use em testes). O gatilho chama sem argumentos uteis (recebe um objeto de evento).
 */
function enviarRelatorio(opcoes) {
  var forcar = Boolean(opcoes && opcoes.forcar === true);
  var config = lerConfig_();
  var propriedades = PropertiesService.getScriptProperties();
  var agora = new Date();
  var hoje = diaBrasilia(agora);

  var pendentes = config.destinatarios.filter(function (d) {
    return forcar || propriedades.getProperty('ultimoEnvio:' + d.email) !== hoje;
  });
  if (pendentes.length === 0) {
    Logger.log('Nada a enviar: todos ja receberam hoje (' + hoje + ').');
    return;
  }

  var dados = coletarDados_(pendentes);
  var erros = [];

  pendentes.forEach(function (destinatario) {
    try {
      // Um destinatario por vez: falha em um nao impede os outros.
      var email = montarEmails([destinatario], dados, { agora: agora, backofficeUrl: config.backofficeUrl })[0];
      MailApp.sendEmail({
        to: email.email,
        subject: email.assunto,
        htmlBody: email.html,
        body: email.texto,
        name: 'Relatório diário',
      });
      propriedades.setProperty('ultimoEnvio:' + destinatario.email, hoje);
      Logger.log('Enviado para ' + destinatario.email + ': ' + email.assunto);
    } catch (erro) {
      erros.push(destinatario.email + ': ' + erro.message);
    }
  });

  // Relanca no fim para o Google avisar a dona do script por e-mail.
  if (erros.length > 0) throw new Error('Falha ao enviar relatorio: ' + erros.join(' | '));
}

/** Monta os e-mails e registra no log (assunto e tamanho), SEM enviar nada. */
function testarSemEnviar() {
  var config = lerConfig_();
  var dados = coletarDados_(config.destinatarios);
  var emails = montarEmails(config.destinatarios, dados, { agora: new Date(), backofficeUrl: config.backofficeUrl });
  emails.forEach(function (email) {
    Logger.log(email.email + ' | ' + email.assunto + ' | html ' + email.html.length + ' caracteres');
  });
  dados.forEach(function (item) {
    Logger.log('whitelabel ' + item.whitelabelId + ': ' + item.leads.length + ' leads, ' + item.depoimentosPendentes + ' depoimentos pendentes');
  });
}

/** Rode uma vez: cria o gatilho diario (~20:00) e remove duplicatas. */
function criarGatilhoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    if (gatilho.getHandlerFunction() === 'enviarRelatorio') ScriptApp.deleteTrigger(gatilho);
  });
  ScriptApp.newTrigger('enviarRelatorio').timeBased().atHour(20).nearMinute(0).everyDays(1).create();
  Logger.log('Gatilho diario criado para ~20:00 (America/Sao_Paulo).');
}
```

- [ ] **Step 3: Verificar a sintaxe**

Run:

```bash
cd C:/trabalho/codigo-fonte/clinic-dfu && node -e "const fs=require('fs'); for (const f of ['tools/relatorio-diario/Code.gs','tools/relatorio-diario/Relatorio.js']) { new Function(fs.readFileSync(f,'utf8')); console.log('sintaxe ok:', f); } JSON.parse(fs.readFileSync('tools/relatorio-diario/appsscript.json','utf8')); console.log('manifesto ok');"
```

Expected: `sintaxe ok: ...Code.gs`, `sintaxe ok: ...Relatorio.js`, `manifesto ok` (sem exceção).

- [ ] **Step 4: Conferir que nenhum segredo entrou no código**

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && grep -rniE "private_key|BEGIN PRIVATE|client_email\"|@gmail.com" tools/relatorio-diario/Code.gs tools/relatorio-diario/Relatorio.js`
Expected: nenhuma saída (nenhuma chave nem e-mail fixo no código; os e-mails só existem na configuração das Propriedades do Script e nos testes).

- [ ] **Step 5: Commit**

```bash
cd C:/trabalho/codigo-fonte/clinic-dfu && git add tools/relatorio-diario/Code.gs tools/relatorio-diario/appsscript.json && git commit -m "$(cat <<'EOF'
Adiciona Code.gs do relatorio diario (Firestore REST, envio e gatilho)

Autenticacao por conta de servico somente leitura (JWT RS256), leitura
paginada de leads e depoimentos pendentes, envio por destinatario com
falhas isoladas, trava de um envio por dia, modo de teste sem envio e
gatilho diario das 20:00. Segredos so nas Propriedades do Script.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: README com o passo a passo

**Files:**
- Create: `tools/relatorio-diario/README.md`

- [ ] **Step 1: Criar o README**

````markdown
# Relatório diário por e-mail

Todo dia às ~20:00 (Brasília), um Google Apps Script envia um relatório visual de solicitações e lista de espera:

- `raiza.fisio@gmail.com`: só o whitelabel `raiza-fisio`.
- `smdb.ti@gmail.com` (admin global): todos os whitelabels + total consolidado.

Spec: [docs/superpowers/specs/2026-10-04-relatorio-diario-design.md](../../docs/superpowers/specs/2026-10-04-relatorio-diario-design.md).

## Como funciona

`Relatorio.js` (regra pura, testada em `npm run test:relatorio`) + `Code.gs` (Firestore REST, envio, gatilho) rodam
dentro de um projeto do Apps Script da conta `smdb.ti@gmail.com`. O Firestore é lido por uma **conta de serviço
somente leitura**. O e-mail não leva telefone, endereço nem sobrenome.

## Configuração (uma vez, ~15 minutos)

### 1. Conta de serviço somente leitura (console do Google Cloud, conta `smdb.ti@gmail.com`)

1. Abra <https://console.cloud.google.com/iam-admin/serviceaccounts?project=clinic-dfu>.
2. **Criar conta de serviço**: nome `relatorio-leitura`. Em "Conceder acesso", escolha o papel **Leitor do Cloud Datastore**
   (`Cloud Datastore Viewer`). Concluir.
3. Abra a conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON**. O navegador baixa um `.json`.

> Essa chave dá **leitura** ao Firestore. Trate como senha: não coloque no repositório, em chat ou e-mail.
> Se vazar: apague a chave na mesma aba e gere outra.

### 2. Projeto no Apps Script (conta `smdb.ti@gmail.com`)

1. Abra <https://script.google.com> → **Novo projeto** → nome `Relatorio diario`.
2. **Configurações do projeto** (engrenagem) → marque **Mostrar arquivo de manifesto "appsscript.json" no editor**.
3. No editor, cole o conteúdo de `appsscript.json` deste repositório no arquivo de manifesto.
4. Renomeie o arquivo padrão para `Code.gs` e cole o conteúdo de `Code.gs`.
5. Crie um segundo arquivo (**+ → Script**) chamado `Relatorio` e cole o conteúdo de `Relatorio.js`.
6. Salve (Ctrl+S).

### 3. Propriedades do Script

**Configurações do projeto → Propriedades do script → Editar propriedades do script**, adicione:

| Propriedade | Valor |
| :--- | :--- |
| `SA_KEY` | O conteúdo **inteiro** do `.json` baixado no passo 1 |
| `CONFIG` | O JSON abaixo |

```json
{
  "backofficeUrl": "https://clinic-dfu.web.app",
  "destinatarios": [
    { "email": "raiza.fisio@gmail.com", "tipo": "TENANT", "whitelabelId": "raiza-fisio" },
    { "email": "smdb.ti@gmail.com", "tipo": "GLOBAL" }
  ]
}
```

Depois de colar `SA_KEY`, **apague o arquivo `.json` baixado** do computador.

### 4. Testar

1. No editor, escolha a função `testarSemEnviar` → **Executar**. Autorize os escopos quando pedir.
   Em **Execuções/Registros**, confira uma linha por destinatário (assunto) e a contagem de leads de cada whitelabel.
2. Escolha `enviarRelatorio` e execute **uma vez** para validar. Para forçar o envio no mesmo dia,
   rode no editor `enviarRelatorio({forcar: true})` (crie uma função auxiliar `function enviarAgoraForcando(){ enviarRelatorio({forcar:true}); }`
   se preferir um botão). Confira os dois e-mails no Gmail (celular e computador).

### 5. Ativar o envio diário

1. Execute `criarGatilhoDiario` uma vez (ele remove gatilhos duplicados).
2. No menu **Gatilhos** (relógio), abra o gatilho de `enviarRelatorio` → **Notificações de falha** → **Notificar imediatamente**.

## Operação

- **Horário:** o gatilho dispara dentro de ~15 minutos de 20:00.
- **Não duplica:** cada destinatário recebe no máximo um e-mail por dia; `enviarRelatorio({forcar: true})` ignora a trava.
- **Falha:** se um envio falhar, o Google avisa por e-mail a conta dona do script. Um destinatário com erro não impede os outros.
- **Trocar ou incluir destinatário:** edite a propriedade `CONFIG` (não precisa mexer no código).
- **Trocar a chave:** gere uma nova no console, cole em `SA_KEY` e apague a antiga.
- **Atualizar o código:** edite os arquivos neste repositório e cole de novo no Apps Script (`Code.gs` e `Relatorio`).

## Desenvolvimento

```bash
npm run test:relatorio                       # testa a regra pura (inclui paridade com ordenarFila)
npx tsx scripts/preview-relatorio.ts         # gera tools/relatorio-diario/preview/*.html com dados fictícios
```
````

- [ ] **Step 2: Conferir o README contra o código**

Conferir à mão: os nomes `testarSemEnviar`, `enviarRelatorio`, `criarGatilhoDiario`, `SA_KEY`, `CONFIG` e os campos do JSON de configuração batem com `Code.gs`. (Já bate: foram copiados da Tarefa 3.)

- [ ] **Step 3: Commit**

```bash
cd C:/trabalho/codigo-fonte/clinic-dfu && git add tools/relatorio-diario/README.md && git commit -m "$(cat <<'EOF'
Documenta a configuracao do relatorio diario

Passo a passo da conta de servico somente leitura, do projeto no Apps
Script, das propriedades, dos testes e da ativacao do gatilho.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verificação final, push e ativação (PUBLICAÇÃO + USUÁRIO)

**Files:** nenhum arquivo novo.

- [ ] **Step 1: Verificação completa**

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && npm run lint && npm run test:local && npm run test:fila && npm run test:relatorio`
Expected: `tsc` limpo e as três suítes com `OK`.

Run: `cd C:/trabalho/codigo-fonte/clinic-dfu && git status --short && git log --oneline origin/main..HEAD`
Expected: só `?? .claude-sessions/` e `?? .claude/` fora do controle de versão; commits da feature à frente do `origin/main`; **nenhum** `.json` de chave nem `preview/` listado.

- [ ] **Step 2: (PUBLICAÇÃO) Push**

Confirmar com o usuário e então: `cd C:/trabalho/codigo-fonte/clinic-dfu && git push`
Expected: `main -> main`. (Não há deploy de hosting nem de regras: esta feature não toca o app web.)

- [ ] **Step 3: (USUÁRIO) Configuração no Google Cloud e no Apps Script**

Seguir `tools/relatorio-diario/README.md`, seções 1 a 3. A chave JSON nunca passa por chat.

- [ ] **Step 4: (USUÁRIO) Testar sem enviar e enviar**

`testarSemEnviar` → conferir no log: um assunto por destinatário (`Relatório diário — DD/MM — Lista de espera: N`) e a contagem de leads de `raiza-fisio` (confere com o backoffice). Depois enviar com `forcar` e conferir os dois e-mails: a gestora vê só `raiza-fisio`; o admin vê todos e o total consolidado (se houver mais de um whitelabel).

- [ ] **Step 5: (USUÁRIO) Ativar o gatilho**

`criarGatilhoDiario` + notificação de falha imediata. Conferir no dia seguinte, perto das 20:00, que chegaram os dois e-mails e que um segundo disparo no mesmo dia não duplica.

---

## Self-Review

- **Cobertura do spec:** objetivo, escopo por destinatário e `CONFIG` (T3, T4); arquitetura Apps Script + REST (T3); acesso por conta de serviço somente leitura e chave só nas Propriedades (T3, T4, constraints); conteúdo do relatório: cartões por status, novas 24 h, barras de 7 dias, fila com 5 primeiros só com primeiro nome, depoimentos pendentes, link do backoffice, arquivados fora e `Arquivadas: N` (T1, T2); regras de negócio: fila e paridade, fuso UTC-3, dia, primeiro nome, dados incompletos (T1, T2); envio: um e-mail por destinatário com falhas isoladas, idempotência, `testarSemEnviar`, gatilho `atHour(20).nearMinute(0)` (T3); entregáveis (T1-T4); testes e verificação ao vivo (T1, T2, T5); fora de escopo respeitado.
- **Placeholders:** nenhum "TBD"; todo código dos passos está completo. O Step 2/3 da Tarefa 1 corrige explicitamente uma asserção contraditória que foi escrita no rascunho do teste, para o executor não copiar o erro.
- **Consistência de nomes/tipos:** `agregar`/`somar` devolvem o mesmo `Resumo`; `montarEmails` usa `agregar`/`somar`/`diaBrasilia`; `Code.gs` usa `decodificarDocumento`, `montarEmails`, `diaBrasilia` (globais do `Relatorio.js` no Apps Script); `dados[].depoimentosPendentes` é número em testes e em `Code.gs`; `contexto.{agora, backofficeUrl, offsetMin}` igual no teste e no `Code.gs`.
- **Review Focus:** 1 → T1 (virada 23:30 BRT); 2 → T2 (isolamento); 3 → T2 (escape, sem telefone/sobrenome); 4 → T1/T2 (dados estranhos); 5 → T2 (vazio, GLOBAL único, whitelabel inexistente) e T5 (idempotência e isolamento de falha, manual).
