import assert from 'node:assert/strict';
import {
  calcularAjustes,
  formatarEndereco,
  montarAntecedentesPessoais,
  montarRascunhoPaciente,
} from '../src/lib/conversaoLead';
import type { Anamnese, Lead, Patient } from '../src/types';

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

// --- calcularAjustes (completar pacientes ja convertidos) --------------------
const convertido = (id: string, patientId: string, extra: Partial<Lead> = {}): Lead =>
  lead({
    id, status: 'CONVERTIDO', convertedPatientId: patientId,
    endereco: { logradouro: 'Rua X', numero: '123', bairro: 'Centro', cidade: 'Brasilia', estado: 'DF' },
    ...extra,
  });
const paciente = (id: string, extra: Partial<Patient> = {}): Patient => ({
  id, name: 'Sofia', cpf: '', birthDate: '', phone: '+5561999998888', email: '', healthPlan: '',
  address: '', status: 'Ativo', ...extra,
});
const anamnese = (patientId: string, personalHistory: string, id = `an-${patientId}`): Anamnese => ({
  id, patientId, mainComplaint: 'queixa existente', hda: 'hda existente', personalHistory, familyHistory: 'fam',
});
const TEXTO = 'Preocupações informadas no site: A cabecinha está achatada?\nGestação e parto (relato do responsável): Gestação tranquila, parto normal.';

// tudo vazio, sem anamnese: preenche mae, endereco e cria a anamnese
{
  const r = calcularAjustes([convertido('l1', 'p1')], [paciente('p1')], []);
  assert.equal(r.ignorados.length, 0);
  assert.deepEqual(r.ajustes, [{
    leadId: 'l1', patientId: 'p1', pacienteNome: 'Sofia', responsavel: 'Ana Souza',
    motherName: 'Ana Souza',
    address: 'Rua X, 123 · Centro · Brasilia/DF',
    antecedentes: { acao: 'CRIAR', texto: TEXTO },
    avisos: [],
  }]);
}

// NUNCA sobrescreve: mae e endereco ja preenchidos ficam como estao
{
  const r = calcularAjustes(
    [convertido('l1', 'p1')],
    [paciente('p1', { motherName: 'Maria da Silva', address: 'Av. Y, 5' })],
    []
  );
  assert.equal(r.ajustes.length, 1);
  assert.equal(r.ajustes[0].motherName, undefined);
  assert.equal(r.ajustes[0].address, undefined);
  assert.equal(r.ajustes[0].antecedentes?.acao, 'CRIAR');
}

// anamnese existente com o campo vazio (ou so espacos): PREENCHER so esse campo
for (const vazioOuEspacos of ['', '   \n ']) {
  const r = calcularAjustes([convertido('l1', 'p1')], [paciente('p1', { motherName: 'M', address: 'A' })], [anamnese('p1', vazioOuEspacos)]);
  assert.deepEqual(r.ajustes[0].antecedentes, { acao: 'PREENCHER', texto: TEXTO, anamneseId: 'an-p1' });
}

// anamnese com antecedentes ja escritos: nao toca; aviso se ainda houver outro ajuste
{
  const r = calcularAjustes([convertido('l1', 'p1')], [paciente('p1')], [anamnese('p1', 'texto da terapeuta')]);
  assert.equal(r.ajustes[0].antecedentes, undefined);
  assert.deepEqual(r.ajustes[0].avisos, ['Antecedentes pessoais já preenchidos: mantidos como estão.']);
  assert.equal(r.ajustes[0].motherName, 'Ana Souza');
}

// nada a completar: tudo ja preenchido -> ignorado (e rodar de novo e idempotente)
{
  const r = calcularAjustes(
    [convertido('l1', 'p1')],
    [paciente('p1', { motherName: 'Ana Souza', address: 'Rua X, 123 · Centro · Brasilia/DF' })],
    [anamnese('p1', TEXTO)]
  );
  assert.deepEqual(r.ajustes, []);
  assert.deepEqual(r.ignorados, [{ leadId: 'l1', responsavel: 'Ana Souza', motivo: 'NADA_A_COMPLETAR' }]);
}

// paciente que nao existe mais
{
  const r = calcularAjustes([convertido('l1', 'sumiu')], [paciente('p1')], []);
  assert.deepEqual(r.ajustes, []);
  assert.deepEqual(r.ignorados, [{ leadId: 'l1', responsavel: 'Ana Souza', motivo: 'PACIENTE_AUSENTE' }]);
}

// so conta quem esta CONVERTIDO e tem convertedPatientId; arquivado ainda conta
{
  const r = calcularAjustes(
    [
      lead({ id: 'a', status: 'NOVO', convertedPatientId: 'p1' }),
      lead({ id: 'b', status: 'CONVERTIDO' }),                          // sem convertedPatientId
      convertido('c', 'p1', { arquivado: true }),
    ],
    [paciente('p1')],
    []
  );
  assert.deepEqual(r.ajustes.map((a) => a.leadId), ['c']);
  assert.equal(r.ignorados.length, 0);
}

// lead sem endereco e sem relato: so mae e preocupacoes (sem "undefined")
{
  const r = calcularAjustes([convertido('l1', 'p1', { endereco: undefined, observacoes: '', responsavel: '  Ana   Souza ' })], [paciente('p1')], []);
  assert.equal(r.ajustes[0].address, undefined);
  assert.equal(r.ajustes[0].motherName, 'Ana Souza');
  assert.equal(r.ajustes[0].antecedentes?.texto, 'Preocupações informadas no site: A cabecinha está achatada?');
}

// dois leads apontando para o mesmo paciente: cada campo e preenchido uma vez so
{
  const r = calcularAjustes(
    [convertido('l1', 'p1'), convertido('l2', 'p1', { responsavel: 'Outra Pessoa' })],
    [paciente('p1')],
    []
  );
  assert.equal(r.ajustes.length, 1);
  assert.equal(r.ajustes[0].leadId, 'l1');
  assert.equal(r.ajustes[0].motherName, 'Ana Souza');
  assert.deepEqual(r.ignorados, [{ leadId: 'l2', responsavel: 'Outra Pessoa', motivo: 'NADA_A_COMPLETAR' }]);
}

// ordem dos ajustes segue a ordem dos leads
{
  const r = calcularAjustes([convertido('l1', 'p1'), convertido('l2', 'p2')], [paciente('p2'), paciente('p1')], []);
  assert.deepEqual(r.ajustes.map((a) => a.patientId), ['p1', 'p2']);
}

console.log('OK: conversao de lead em paciente.');
