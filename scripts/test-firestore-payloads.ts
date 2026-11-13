import assert from 'node:assert/strict';
import { toFirestoreData } from '../src/lib/firestoreData';
import { packageProgress } from '../src/lib/packageProgress';
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

console.log('OK: payloads do Firestore sanitizados sem campos undefined.');
console.log('OK: progresso de pacote conta so sessoes concluidas.');
