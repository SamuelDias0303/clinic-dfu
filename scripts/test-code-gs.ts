import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Testa a "cola" do Code.gs (token, leitura paginada, envio, idempotencia,
 * isolamento de falhas, gatilho) carregando Relatorio.js + Code.gs num contexto
 * `vm` com um Apps Script simulado. Nao fala com a rede nem com o Google.
 */
const require = createRequire(import.meta.url);
const R = require('../tools/relatorio-diario/Relatorio.js');
const pasta = resolve(process.cwd(), 'tools', 'relatorio-diario');
const codigo = readFileSync(resolve(pasta, 'Relatorio.js'), 'utf8') + '\n' + readFileSync(resolve(pasta, 'Code.gs'), 'utf8');

const DOC = 'projects/clinic-dfu/databases/(default)/documents';
const leadDoc = (wl: string, id: string, f: Record<string, unknown>) => ({
  name: `${DOC}/whitelabels/${wl}/leads/${id}`,
  fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [
    k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) },
  ])),
});
const wlDoc = (id: string, name: string) => ({ name: `${DOC}/whitelabels/${id}`, fields: { name: { stringValue: name } } });

// Firestore ficticio. Leads da raiza-fisio vem em 2 paginas (testa nextPageToken).
const FIRESTORE: Record<string, { pagina1: unknown[]; pagina2?: unknown[] }> = {
  whitelabels: { pagina1: [wlDoc('raiza-fisio', 'Raiza Freitas'), wlDoc('clinica-beta', 'Clinica Beta')] },
  'whitelabels/raiza-fisio/leads': {
    pagina1: [leadDoc('raiza-fisio', 'r1', { status: 'LISTA_ESPERA', responsavel: 'Ana Souza', createdAt: '2026-10-01T10:00:00Z' })],
    pagina2: [leadDoc('raiza-fisio', 'r2', { status: 'LISTA_ESPERA', responsavel: 'Bruna Lima', createdAt: '2026-10-02T10:00:00Z' })],
  },
  'whitelabels/raiza-fisio/depoimentosPendentes': {
    pagina1: [{ name: `${DOC}/whitelabels/raiza-fisio/depoimentosPendentes/d1`, fields: { status: { stringValue: 'PENDENTE' } } }],
  },
  'whitelabels/clinica-beta/leads': {
    pagina1: [leadDoc('clinica-beta', 'b1', { status: 'LISTA_ESPERA', responsavel: 'Zelia Pereira', createdAt: '2026-10-03T10:00:00Z' })],
  },
  'whitelabels/clinica-beta/depoimentosPendentes': { pagina1: [] },
};

const CONFIG_COMPLETA = {
  backofficeUrl: 'https://clinic-dfu.web.app',
  destinatarios: [
    { email: 'raiza.fisio@gmail.com', tipo: 'TENANT', whitelabelId: 'raiza-fisio' },
    { email: 'smdb.ti@gmail.com', tipo: 'GLOBAL' },
  ],
};

interface Opcoes { config?: unknown; falhaEnvioPara?: string; statusToken?: number }

function criarAmbiente(opcoes: Opcoes = {}) {
  const props = new Map<string, string>([
    ['SA_KEY', JSON.stringify({ client_email: 'sa@clinic-dfu.iam.gserviceaccount.com', private_key: 'CHAVE-SECRETA-NAO-VAZAR' })],
    ['CONFIG', JSON.stringify(opcoes.config ?? CONFIG_COMPLETA)],
  ]);
  const cache = new Map<string, string>();
  const enviados: { to: string; subject: string; htmlBody: string; body: string }[] = [];
  const urls: string[] = [];
  const pedidosToken: string[] = [];
  const gatilhos = { removidos: 0, criados: [] as string[][], existentes: [] as { getHandlerFunction: () => string }[] };

  const resposta = (codigoHttp: number, corpo: unknown) => ({
    getResponseCode: () => codigoHttp,
    getContentText: () => JSON.stringify(corpo),
  });

  const contexto: Record<string, unknown> = {
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (props.has(k) ? props.get(k) : null),
        setProperty: (k: string, v: string) => { props.set(k, v); },
      }),
    },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => { cache.set(k, v); } }) },
    Utilities: {
      base64EncodeWebSafe: (v: string | number[]) => Buffer.from(v as never).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: () => [1, 2, 3],
    },
    UrlFetchApp: {
      fetch: (url: string, init: { headers?: { Authorization?: string } } = {}) => {
        if (url.startsWith('https://oauth2.googleapis.com/token')) {
          pedidosToken.push(url);
          return resposta(opcoes.statusToken ?? 200, opcoes.statusToken && opcoes.statusToken !== 200 ? { error: 'x' } : { access_token: 'tok' });
        }
        urls.push(url);
        assert.equal(init.headers?.Authorization, 'Bearer tok');
        const [caminho, consulta] = url.split('/documents/')[1].split('?');
        const dados = FIRESTORE[caminho];
        if (!dados) return resposta(404, {});
        const params = new URLSearchParams(consulta);
        if (!params.get('pageToken')) {
          return resposta(200, { documents: dados.pagina1, ...(dados.pagina2 ? { nextPageToken: 'p2' } : {}) });
        }
        return resposta(200, { documents: dados.pagina2 ?? [] });
      },
    },
    MailApp: {
      sendEmail: (mensagem: { to: string; subject: string; htmlBody: string; body: string }) => {
        if (opcoes.falhaEnvioPara && mensagem.to === opcoes.falhaEnvioPara) throw new Error('cota excedida');
        enviados.push(mensagem);
      },
    },
    ScriptApp: {
      getProjectTriggers: () => gatilhos.existentes,
      deleteTrigger: () => { gatilhos.removidos++; },
      newTrigger: (funcao: string) => {
        const chamadas = [funcao];
        const cadeia: Record<string, (...a: unknown[]) => unknown> = {
          timeBased: () => { chamadas.push('timeBased'); return cadeia; },
          atHour: (h) => { chamadas.push(`atHour:${h}`); return cadeia; },
          nearMinute: (m) => { chamadas.push(`nearMinute:${m}`); return cadeia; },
          everyDays: (d) => { chamadas.push(`everyDays:${d}`); return cadeia; },
          create: () => { gatilhos.criados.push(chamadas); return undefined; },
        };
        return cadeia;
      },
    },
  };
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  return { ctx: contexto as Record<string, (...a: unknown[]) => unknown>, props, enviados, urls, pedidosToken, gatilhos };
}

const hoje = R.diaBrasilia(new Date());

// 1) Envio normal: um e-mail por destinatario, cada um com o seu escopo
{
  const a = criarAmbiente();
  a.ctx.enviarRelatorio();
  assert.deepEqual(a.enviados.map((e) => e.to).sort(), ['raiza.fisio@gmail.com', 'smdb.ti@gmail.com']);

  const gestora = a.enviados.find((e) => e.to === 'raiza.fisio@gmail.com')!;
  const admin = a.enviados.find((e) => e.to === 'smdb.ti@gmail.com')!;
  assert.ok(gestora.htmlBody.includes('Raiza Freitas'));
  assert.ok(!gestora.htmlBody.includes('Clinica Beta'));
  assert.ok(!gestora.htmlBody.includes('Zelia'));
  assert.ok(admin.htmlBody.includes('Clinica Beta'));
  // as duas paginas de leads da raiza entraram (fila de 2) e a de Beta (1): admin = 3, gestora = 2
  assert.ok(gestora.subject.endsWith('Lista de espera: 2'));
  assert.ok(admin.subject.endsWith('Lista de espera: 3'));
  // trava de um envio por dia gravada para os dois
  assert.equal(a.props.get('ultimoEnvio:raiza.fisio@gmail.com'), hoje);
  assert.equal(a.props.get('ultimoEnvio:smdb.ti@gmail.com'), hoje);
  // token pedido uma vez so (cache) e Firestore lido com mascara de campos, sem dados sensiveis
  assert.equal(a.pedidosToken.length, 1);
  assert.ok(a.urls.every((u) => !/whatsapp|endereco|observacoes/i.test(u)));
  assert.ok(a.urls.filter((u) => u.includes('/leads?')).every((u) => u.includes('mask.fieldPaths=status')));

  // 2) Segunda execucao no mesmo dia nao reenvia nem le o banco
  const leituras = a.urls.length;
  a.ctx.enviarRelatorio();
  assert.equal(a.enviados.length, 2);
  assert.equal(a.urls.length, leituras);

  // 3) forcar ignora a trava
  a.ctx.enviarRelatorio({ forcar: true });
  assert.equal(a.enviados.length, 4);
}

// 4) Falha em um destinatario nao impede o outro; relanca no fim; so o que falhou e reenviado depois
{
  const a = criarAmbiente({ falhaEnvioPara: 'smdb.ti@gmail.com' });
  assert.throws(() => a.ctx.enviarRelatorio(), /smdb\.ti@gmail\.com: cota excedida/);
  assert.deepEqual(a.enviados.map((e) => e.to), ['raiza.fisio@gmail.com']);
  assert.equal(a.props.get('ultimoEnvio:raiza.fisio@gmail.com'), hoje);
  assert.equal(a.props.get('ultimoEnvio:smdb.ti@gmail.com'), undefined);
}

// 5) Falha ao obter token: erro com codigo HTTP e sem vazar a chave
{
  const a = criarAmbiente({ statusToken: 401 });
  assert.throws(() => a.ctx.enviarRelatorio(), (erro: Error) => {
    assert.match(erro.message, /HTTP 401/);
    assert.ok(!erro.message.includes('CHAVE-SECRETA-NAO-VAZAR'));
    return true;
  });
  assert.equal(a.enviados.length, 0);
}

// 6) So destinatario TENANT: nao le leads de outros whitelabels
{
  const a = criarAmbiente({
    config: { backofficeUrl: 'https://clinic-dfu.web.app', destinatarios: [CONFIG_COMPLETA.destinatarios[0]] },
  });
  a.ctx.enviarRelatorio();
  assert.equal(a.enviados.length, 1);
  assert.ok(a.urls.every((u) => !u.includes('clinica-beta/')));
}

// 7) testarSemEnviar nao envia nada
{
  const a = criarAmbiente();
  a.ctx.testarSemEnviar();
  assert.equal(a.enviados.length, 0);
}

// 8) criarGatilhoDiario: remove duplicatas do mesmo handler e cria 1 gatilho ~20:00
{
  const a = criarAmbiente();
  a.gatilhos.existentes.push(
    { getHandlerFunction: () => 'enviarRelatorio' },
    { getHandlerFunction: () => 'outraCoisa' }
  );
  a.ctx.criarGatilhoDiario();
  assert.equal(a.gatilhos.removidos, 1);
  assert.deepEqual(a.gatilhos.criados, [['enviarRelatorio', 'timeBased', 'atHour:20', 'nearMinute:0', 'everyDays:1']]);
}

// 9) Configuracao ausente ou vazia falha com mensagem clara
{
  const a = criarAmbiente({ config: { backofficeUrl: 'x', destinatarios: [] } });
  assert.throws(() => a.ctx.enviarRelatorio(), /sem destinatarios/);
}

console.log('OK: Code.gs (cola do Apps Script simulada).');
