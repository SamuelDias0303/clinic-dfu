import assert from 'node:assert/strict';
import { toFirestoreData } from '../src/lib/firestoreData';
import { evolutionCandidates, formatAge, isUnassigned, needsEvolution, upperFirst } from '../src/lib/clinicalHelpers';
import { packageOverview, packageProgress } from '../src/lib/packageProgress';
import { LEGACY_WHITELABEL_ID, withTenantField } from '../src/services/serviceScope';
import { allowedShareTargets, stripForeignEditFields, canEditSharedPatient, canWriteClinical, levelOf, normalizeAccess, patientLevel, visibleExternalAppointments, buildAppointmentCopy, buildPatientCopy, buildSharedWithAudit, clampShareTargets, copyTargetsDiff, isForeignPatient, packagesForTherapist, patientOwnerWhitelabel, sharedCopyId, splitAppointments } from '../src/lib/sharing';

const cleaned = toFirestoreData({
  name: 'Clinica Teste',
  domain: undefined,
  contactEmail: '',
  branding: {
    primaryColor: '#0066ff',
    logoUrl: undefined,
  },
  settings: {
    appointmentTypes: ['Consulta', undefined, 'Retorno'],
  },
});

assert.deepEqual(cleaned, {
  name: 'Clinica Teste',
  contactEmail: '',
  branding: {
    primaryColor: '#0066ff',
  },
  settings: {
    appointmentTypes: ['Consulta', 'Retorno'],
  },
});

const customObject = new Date('2026-05-22T12:00:00.000Z');
assert.equal(toFirestoreData({ customObject }).customObject, customObject);

assert.deepEqual(withTenantField({
  name: 'Paciente sem tenant real',
  notes: undefined,
}, LEGACY_WHITELABEL_ID), {
  name: 'Paciente sem tenant real',
});

assert.deepEqual(withTenantField({
  name: 'Paciente com tenant',
  notes: undefined,
}, 'tenant-a'), {
  name: 'Paciente com tenant',
  whitelabelId: 'tenant-a',
});

assert.deepEqual(withTenantField({
  name: 'Paciente sem whitelabel resolvida',
  notes: undefined,
}, undefined), {
  name: 'Paciente sem whitelabel resolvida',
});

// Pacote: so CONCLUÍDO conta como sessão usada.
const mix = packageProgress({ totalSessions: 10, status: 'ATIVO' }, [
  { status: 'CONCLUÍDO' }, { status: 'CONCLUÍDO' }, { status: 'CONCLUÍDO' },
  { status: 'CANCELADO' }, { status: 'CANCELADO' }, { status: 'AGUARDANDO' },
]);
assert.deepEqual(mix, { used: 3, total: 10, remaining: 7, complete: false, open: true, ending: false });

// Aviso de fim de pacote: aberto e restando 1 ou 2 sessões.
const ending = (used: number, status: 'ATIVO' | 'ENCERRADO' = 'ATIVO') =>
  packageProgress({ totalSessions: 10, status }, Array.from({ length: used }, () => ({ status: 'CONCLUÍDO' as const }))).ending;
assert.equal(ending(7), false);
assert.equal(ending(8), true);
assert.equal(ending(9), true);
assert.equal(ending(10), false);
assert.equal(ending(9, 'ENCERRADO'), false);

const done = packageProgress({ totalSessions: 2, status: 'ATIVO' }, [
  { status: 'CONCLUÍDO' }, { status: 'CONCLUÍDO' },
]);
assert.equal(done.complete, true);
assert.equal(done.open, false);

// Passou do total: saldo nunca fica negativo.
const over = packageProgress({ totalSessions: 2, status: 'ATIVO' }, [
  { status: 'CONCLUÍDO' }, { status: 'CONCLUÍDO' }, { status: 'CONCLUÍDO' },
]);
assert.equal(over.used, 3);
assert.equal(over.remaining, 0);

// Pacote encerrado manualmente não é aberto, mesmo com saldo.
assert.equal(packageProgress({ totalSessions: 10, status: 'ENCERRADO' }, [{ status: 'CONCLUÍDO' }]).open, false);

// Reabrir uma sessão concluída devolve o saldo (contagem é derivada).
assert.equal(packageProgress({ totalSessions: 3, status: 'ATIVO' }, [{ status: 'EM ANDAMENTO' }]).used, 0);

// Visão geral para o painel: uma linha por pacote não encerrado, com terapeuta do paciente.
const overviewPatients = [
  { id: 'p1', name: 'Ana', therapistId: 't1', therapistName: 'Dra. Raiza' },
  { id: 'p2', name: 'Bia', therapistId: 't2', therapistName: 'Dra. Rafaela' },
  { id: 'p3', name: 'Caio' },
];
const overviewPackages = [
  { id: 'k1', patientId: 'p1', totalSessions: 4, status: 'ATIVO' as const, createdBy: 'x' },
  { id: 'k2', patientId: 'p2', totalSessions: 2, status: 'ATIVO' as const, createdBy: 'x' },
  { id: 'k3', patientId: 'p1', totalSessions: 5, status: 'ENCERRADO' as const, createdBy: 'x' },
  { id: 'k4', patientId: 'fora', totalSessions: 5, status: 'ATIVO' as const, createdBy: 'x' },
  { id: 'k5', patientId: 'p3', totalSessions: 3, status: 'ATIVO' as const, createdBy: 'x' },
];
const overviewAppointments = [
  { status: 'CONCLUÍDO' as const, packageId: 'k1' },
  { status: 'CONCLUÍDO' as const, packageId: 'k2' },
  { status: 'CONCLUÍDO' as const, packageId: 'k2' },
  { status: 'CANCELADO' as const, packageId: 'k1' },
  { status: 'CONCLUÍDO' as const },
];
const rows = packageOverview(overviewPackages, overviewPatients, overviewAppointments);
// k3 encerrado e k4 sem paciente visível ficam de fora; abertos por saldo (empate: nome do paciente), completo (k2) no fim.
assert.deepEqual(rows.map((row) => row.packageId), ['k1', 'k5', 'k2']);
assert.deepEqual(
  rows.map((row) => [row.used, row.total, row.remaining, row.complete]),
  [[1, 4, 3, false], [0, 3, 3, false], [2, 2, 0, true]],
);
assert.equal(rows.find((row) => row.packageId === 'k1')?.therapistName, 'Dra. Raiza');
// k1 (1 de 4, restam 3) não está no fim; k5 (0 de 3) também não; k2 está completo.
assert.deepEqual(rows.map((row) => row.ending), [false, false, false]);
assert.equal(rows.find((row) => row.packageId === 'k5')?.therapistName, 'Sem terapeuta');

// Evolução pendente: sessão concluída sem evolução vinculada nem texto no agendamento.
assert.equal(needsEvolution({ status: 'CONCLUÍDO' }), true);
assert.equal(needsEvolution({ status: 'CONCLUÍDO', evolutionId: '' }), true);
assert.equal(needsEvolution({ status: 'CONCLUÍDO', evolutionId: 'e1' }), false);
assert.equal(needsEvolution({ status: 'CONCLUÍDO', clinicalEvolution: 'Boa sessão' }), false);
assert.equal(needsEvolution({ status: 'CONCLUÍDO', clinicalEvolution: '   ' }), true);
assert.equal(needsEvolution({ status: 'AGUARDANDO' }), false);
assert.equal(needsEvolution({ status: 'CANCELADO' }), false);

// Idade do bebê a partir de DD/MM/AAAA (ou AAAA-MM-DD), relativa a uma data fixa.
const hoje = new Date(2026, 10, 13);
assert.equal(formatAge('03/10/2024', hoje), '2 anos e 1 mês');
assert.equal(formatAge('13/12/2024', hoje), '1 ano e 11 meses');
assert.equal(formatAge('13/11/2025', hoje), '1 ano');
assert.equal(formatAge('13/06/2026', hoje), '5 meses');
assert.equal(formatAge('13/10/2026', hoje), '1 mês');
assert.equal(formatAge('30/10/2026', hoje), '14 dias');
assert.equal(formatAge('12/11/2026', hoje), '1 dia');
assert.equal(formatAge('2026-06-13', hoje), '5 meses');
assert.equal(formatAge('', hoje), '');
assert.equal(formatAge('abc', hoje), '');
assert.equal(formatAge('31/02/2025', hoje), '');
assert.equal(formatAge('01/01/2030', hoje), '');

console.log('OK: payloads do Firestore sanitizados sem campos undefined.');
console.log('OK: progresso de pacote conta so sessoes concluidas.');
// Datas por extenso: só a primeira letra maiúscula ("Novembro de 2026", não "Novembro De 2026").
assert.equal(upperFirst('sexta-feira, 13 de novembro'), 'Sexta-feira, 13 de novembro');
assert.equal(upperFirst('novembro de 2026'), 'Novembro de 2026');
assert.equal(upperFirst(''), '');

// Paciente sem terapeuta: vazio, ausente ou o valor padrão 'platform' (gestor sem escolher).
assert.equal(isUnassigned({}), true);
assert.equal(isUnassigned({ therapistId: '' }), true);
assert.equal(isUnassigned({ therapistId: 'platform' }), true);
assert.equal(isUnassigned({ therapistId: 'raiza@clinica.com' }), false);

// Evolução já existente que pode ser vinculada a uma sessão: sem vínculo e não usada por
// outro agendamento, da mais próxima da data da sessão para a mais distante.
const candidates = evolutionCandidates([
  { id: 'e1', date: '11/03/2026' },
  { id: 'e2', date: '10/03/2026' },
  { id: 'e3', date: '01/03/2026', appointmentId: 'outra' },
  { id: 'e4', date: '20/03/2026' },
  { id: 'e5', date: '05/03/2026' },
], '2026-03-10', new Set(['e4']));
assert.deepEqual(candidates.map((item) => item.id), ['e2', 'e1', 'e5']);

console.log('OK: evolucao pendente e idade do bebe.');

// Compartilhamento entre whitelabels.
assert.equal(isForeignPatient({}, 'A'), false);
assert.equal(isForeignPatient({ whitelabelId: 'A' }, 'A'), false);
assert.equal(isForeignPatient({ whitelabelId: 'B' }, 'A'), true);
assert.equal(patientOwnerWhitelabel({ whitelabelId: 'B' }, 'A'), 'B');
assert.equal(patientOwnerWhitelabel({}, 'A'), 'A');

const split = splitAppointments([
  { id: '1', whitelabelId: 'A' },
  { id: '2', whitelabelId: 'B' },
  { id: '3' },
], 'A');
assert.deepEqual(split.own.map((item) => item.id), ['1', '3']);
assert.deepEqual(split.external.map((item) => item.id), ['2']);

const pkgs = [
  { id: 'p1', therapistId: 'ana@x.com' },
  { id: 'p2', therapistId: 'bia@x.com' },
  { id: 'p3' },
];
assert.deepEqual(packagesForTherapist(pkgs, 'ana@x.com').map((item) => item.id), ['p1', 'p3']);

assert.deepEqual(clampShareTargets(['a', 'b', 'a', 'x', 'c', 'd'], ['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
assert.deepEqual(clampShareTargets([], ['a']), []);

assert.deepEqual(allowedShareTargets(null), []);
assert.deepEqual(
  allowedShareTargets({ targetIds: ['b'], targets: [{ id: 'b', name: 'B', slug: 'b' }] }).map((item) => item.id),
  ['b'],
);

console.log('OK: compartilhamento entre whitelabels.');

// Cópias-índice no destino.
assert.equal(sharedCopyId('A', 'p1'), 'A__p1');

const patientCopy = buildPatientCopy({ id: 'p1', whitelabelId: 'A', name: 'Bebê', cpf: '', birthDate: '2026-01-01', phone: '', email: '', healthPlan: '', address: '', status: 'Ativo', sharedWith: ['B'] }, 'A');
assert.equal(patientCopy.ownerWhitelabelId, 'A');
assert.equal(patientCopy.patientId, 'p1');
assert.equal(patientCopy.name, 'Bebê');
assert.equal('id' in patientCopy, false);
assert.equal('sharedWith' in patientCopy, false);
assert.equal('whitelabelId' in patientCopy, false);

const appointmentCopy = buildAppointmentCopy({ id: 'a1', whitelabelId: 'A', patientId: 'p1', patientName: 'Bebê', therapistId: 't', therapistName: 'T', date: '2026-11-20', time: '09:00', type: 'Consulta', status: 'AGUARDANDO', sharedToWhitelabels: ['B'], notes: 'privado', clinicalEvolution: 'privado' }, 'A');
assert.equal(appointmentCopy.sourceWhitelabelId, 'A');
assert.equal(appointmentCopy.appointmentId, 'a1');
assert.equal(appointmentCopy.date, '2026-11-20');
assert.equal('id' in appointmentCopy, false);
assert.equal('whitelabelId' in appointmentCopy, false);
// Notas e evolução clínica do agendamento não vão para a cópia: o destino só precisa do bloco de horário.
assert.equal('notes' in appointmentCopy, false);
assert.equal('clinicalEvolution' in appointmentCopy, false);

assert.deepEqual(copyTargetsDiff(['B'], ['B', 'C']), { add: ['C'], remove: [] });
assert.deepEqual(copyTargetsDiff(['B', 'C'], ['C']), { add: [], remove: ['B'] });
assert.deepEqual(copyTargetsDiff(undefined, ['B']), { add: ['B'], remove: [] });

assert.deepEqual(buildSharedWithAudit('p1', 'A', ['B'], { uid: 'u1', email: 'g@x.com' }), {
  action: 'PACIENTE_COMPARTILHADO',
  patientId: 'p1',
  ownerWhitelabelId: 'A',
  targets: ['B'],
  actorUid: 'u1',
  actorEmail: 'g@x.com',
});

console.log('OK: copias-indice de compartilhamento.');

// Pacote por terapeuta: a linha usa o terapeuta do pacote; pacote antigo cai no terapeuta do paciente.
const byTherapist = packageOverview(
  [
    { id: 'm1', patientId: 'pp', totalSessions: 5, status: 'ATIVO', createdBy: 'x', therapistId: 'ana@x.com', therapistName: 'Ana' },
    { id: 'm2', patientId: 'pp', totalSessions: 5, status: 'ATIVO', createdBy: 'x', therapistId: 'bia@x.com', therapistName: 'Bia' },
    { id: 'm3', patientId: 'pp', totalSessions: 5, status: 'ATIVO', createdBy: 'x' },
  ],
  [{ id: 'pp', name: 'Bebê', therapistId: 'raiza@x.com', therapistName: 'Raiza' }],
  [],
);
assert.deepEqual(
  byTherapist.map((row) => [row.packageId, row.therapistId, row.therapistName]),
  [['m1', 'ana@x.com', 'Ana'], ['m2', 'bia@x.com', 'Bia'], ['m3', 'raiza@x.com', 'Raiza']],
);

console.log('OK: pacote por terapeuta.');

// "Meu dia" do destino: terapeuta vê só os compartilhados com o e-mail dele; os outros papéis veem todos.
const sharedToday = [
  { id: 'x1', therapistId: 'ana@x.com' },
  { id: 'x2', therapistId: 'bia@x.com' },
];
assert.deepEqual(visibleExternalAppointments(sharedToday, 'TERAPEUTA', 'ana@x.com').map((item) => item.id), ['x1']);
assert.deepEqual(visibleExternalAppointments(sharedToday, 'GESTOR', 'ana@x.com').map((item) => item.id), ['x1', 'x2']);
assert.deepEqual(visibleExternalAppointments(sharedToday, 'REPCAO', 'ana@x.com').map((item) => item.id), ['x1', 'x2']);

// A cópia leva evolutionId para o "Meu dia" saber que a evolução já foi registrada.
assert.equal(
  buildAppointmentCopy({ id: 'a2', patientId: 'p1', patientName: 'B', therapistId: 't', therapistName: 'T', date: '2026-11-20', time: '09:00', type: 'Consulta', status: 'AGUARDANDO', evolutionId: 'e9' }, 'A').evolutionId,
  'e9',
);
console.log('OK: meu dia compartilhado.');

// Níveis de acesso do compartilhamento.
assert.equal(levelOf(undefined, 'B'), 'PADRAO');
assert.equal(levelOf({ B: 'LEITURA' }, 'B'), 'LEITURA');
assert.equal(levelOf({ B: 'LEITURA' }, 'C'), 'PADRAO');
assert.equal(canWriteClinical('LEITURA'), false);
assert.equal(canWriteClinical('PADRAO'), true);
assert.equal(canWriteClinical('EDICAO'), true);
assert.equal(canEditSharedPatient('PADRAO'), false);
assert.equal(canEditSharedPatient('EDICAO'), true);
// Paciente do próprio whitelabel nunca é limitado; o compartilhado usa o nível da cópia (sem nível = padrão).
assert.equal(patientLevel({ whitelabelId: 'A' }, 'A'), 'EDICAO');
assert.equal(patientLevel({ whitelabelId: 'B', accessLevel: 'LEITURA' }, 'A'), 'LEITURA');
assert.equal(patientLevel({ whitelabelId: 'B' }, 'A'), 'PADRAO');
// Só chaves que ainda estão em sharedWith e níveis válidos sobrevivem.
assert.deepEqual(
  normalizeAccess(['B', 'C'], { B: 'LEITURA', X: 'EDICAO', C: 'NADA' as never }),
  { B: 'LEITURA' },
);
assert.deepEqual(normalizeAccess([], { B: 'LEITURA' }), {});
// A cópia do destino leva o nível e não leva o mapa do original.
const leveled = buildPatientCopy({ id: 'p9', name: 'X', cpf: '', birthDate: '', phone: '', email: '', healthPlan: '', address: '', status: 'Ativo', sharedWith: ['B'], sharedAccess: { B: 'LEITURA' } }, 'A', 'LEITURA');
assert.equal(leveled.accessLevel, 'LEITURA');
assert.equal('sharedAccess' in leveled, false);

console.log('OK: niveis de acesso do compartilhamento.');

// Edição do cadastro pelo destino (nível EDICAO): só campos do cadastro seguem; compartilhamento, nível, terapeuta e sistema ficam de fora.
assert.deepEqual(
  stripForeignEditFields({ id: 'p', name: 'N', phone: '1', whitelabelId: 'A', sharedWith: ['B'], sharedAccess: { B: 'EDICAO' }, accessLevel: 'EDICAO', therapistId: 't', therapistName: 'T', createdAt: 1, ownerWhitelabelId: 'A', patientId: 'p' } as never),
  { name: 'N', phone: '1' },
);
console.log('OK: edicao pelo destino.');
