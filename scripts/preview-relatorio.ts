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
