import assert from 'node:assert/strict';
import { toFirestoreData } from '../src/lib/firestoreData';
import { formatAge, needsEvolution } from '../src/lib/clinicalHelpers';
import { packageOverview, packageProgress } from '../src/lib/packageProgress';
import { LEGACY_WHITELABEL_ID, withTenantField } from '../src/services/serviceScope';

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
assert.deepEqual(mix, { used: 3, total: 10, remaining: 7, complete: false, open: true });

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
console.log('OK: evolucao pendente e idade do bebe.');
