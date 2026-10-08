import assert from 'node:assert/strict';
import {
  formatarEndereco,
  montarAntecedentesPessoais,
  montarRascunhoPaciente,
} from '../src/lib/conversaoLead';
import type { Lead } from '../src/types';

const lead = (extra: Partial<Lead> = {}): Lead => ({
  origem: 'landing-raiza',
  responsavel: 'Ana Souza',
  whatsapp: '+5561999998888',
  bebeIdadeFaixa: '3-6m',
  preocupacoes: ['A cabecinha está achatada?'],
  observacoes: 'Gestação tranquila, parto normal.',
  consentimento: true,
  consentimentoTexto: 'x',
  status: 'NOVO',
  ...extra,
});

// --- formatarEndereco (movido do LeadDetailModal) ---------------------------
assert.equal(formatarEndereco(undefined), '');
assert.equal(formatarEndereco({}), '');
assert.equal(
  formatarEndereco({
    logradouro: 'Rua X', numero: '123', complemento: 'Apto 4', bairro: 'Centro',
    cidade: 'Brasilia', estado: 'DF', cep: '70000-000',
  }),
  'Rua X, 123 - Apto 4 · Centro · Brasilia/DF · CEP 70000-000'
);
// parcial: so o que veio, sem "undefined" nem separadores soltos
assert.equal(formatarEndereco({ cidade: 'Brasilia', estado: 'DF' }), 'Brasilia/DF');
assert.equal(formatarEndereco({ logradouro: 'Rua X' }), 'Rua X');
assert.equal(formatarEndereco({ cep: '70000-000' }), 'CEP 70000-000');
assert.equal(formatarEndereco({ numero: '123' }), '123');

// --- montarAntecedentesPessoais ---------------------------------------------
assert.equal(
  montarAntecedentesPessoais(lead()),
  'Preocupações informadas no site: A cabecinha está achatada?\n' +
  'Gestação e parto (relato do responsável): Gestação tranquila, parto normal.'
);
// varias preocupacoes, separadas por "; "
assert.equal(
  montarAntecedentesPessoais(lead({ preocupacoes: ['A', 'B'], observacoes: 'ok' })),
  'Preocupações informadas no site: A; B\nGestação e parto (relato do responsável): ok'
);
// "Outro motivo" troca pelo texto que a pessoa escreveu
assert.equal(
  montarAntecedentesPessoais(lead({ preocupacoes: ['A', 'Outro motivo'], outroMotivo: 'dorme pouco', observacoes: 'ok' })),
  'Preocupações informadas no site: A; Outro motivo: dorme pouco\nGestação e parto (relato do responsável): ok'
);
// "Outro motivo" sem texto (dado antigo/estranho) fica como esta, sem "undefined"
assert.equal(
  montarAntecedentesPessoais(lead({ preocupacoes: ['Outro motivo'], observacoes: 'ok' })),
  'Preocupações informadas no site: Outro motivo\nGestação e parto (relato do responsável): ok'
);
// espacos extras e quebra de linha no relato sao preservados so nas bordas
assert.equal(
  montarAntecedentesPessoais(lead({ preocupacoes: [], observacoes: '  Parto cesareano.\nSem intercorrencias.  ' })),
  'Gestação e parto (relato do responsável): Parto cesareano.\nSem intercorrencias.'
);
// sem preocupacoes e sem relato: vazio (nao cria anamnese a toa)
assert.equal(montarAntecedentesPessoais(lead({ preocupacoes: [], observacoes: '   ' })), '');
assert.equal(
  montarAntecedentesPessoais(lead({ preocupacoes: ['A'], observacoes: '' })),
  'Preocupações informadas no site: A'
);

// --- montarRascunhoPaciente --------------------------------------------------
const rascunho = montarRascunhoPaciente(lead({
  bebeNome: 'Sofia',
  endereco: { logradouro: 'Rua X', numero: '123', bairro: 'Centro', cidade: 'Brasilia', estado: 'DF' },
}));
assert.equal(rascunho.name, 'Sofia');
assert.equal(rascunho.motherName, 'Ana Souza');             // responsavel -> nome da mae
assert.equal(rascunho.address, 'Rua X, 123 · Centro · Brasilia/DF');
assert.equal(rascunho.phone, '+5561999998888');
assert.equal(rascunho.status, 'Ativo');
assert.equal(rascunho.cpf, '');
assert.equal(rascunho.birthDate, '');                       // nao presume dado que o formulario nao coletou
assert.equal(rascunho.fatherName, undefined);               // nao adivinha se e mae ou pai

// responsavel com espacos extras; sem bebe e sem endereco
const semDados = montarRascunhoPaciente(lead({ responsavel: '  Ana   Souza ', bebeNome: '  ', endereco: undefined }));
assert.equal(semDados.motherName, 'Ana Souza');
assert.equal(semDados.name, 'Bebe de Ana Souza');           // sem nome do bebe: mantem o padrao anterior, ja normalizado
assert.equal(semDados.address, '');

console.log('OK: conversao de lead em paciente.');
