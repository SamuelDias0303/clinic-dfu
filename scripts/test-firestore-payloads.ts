import assert from 'node:assert/strict';
import { toFirestoreData } from '../src/lib/firestoreData';
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

console.log('OK: payloads do Firestore sanitizados sem campos undefined.');
