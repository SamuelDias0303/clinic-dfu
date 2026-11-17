import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

// Rodar com: npm run test:rules (sobe o emulador do Firestore).
const PROJECT = 'demo-clinic-rules';

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });

  // A = origem, B = destino liberado, C = whitelabel sem vínculo.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const member = (wl: string, uid: string, roles: string[]) =>
      setDoc(doc(db, `whitelabels/${wl}/members/${uid}`), { userId: uid, email: `${uid}@x.com`, status: 'ATIVO', roles });
    await member('A', 'gestorA', ['GESTOR']);
    await member('A', 'recepA', ['REPCAO']);
    await member('A', 'terapA', ['TERAPEUTA']);
    await member('B', 'gestorB', ['GESTOR']);
    await member('B', 'recepB', ['REPCAO']);
    await member('B', 'terapB', ['TERAPEUTA']);
    await member('C', 'gestorC', ['GESTOR']);
    await setDoc(doc(db, 'whitelabelLinks/A'), { targetIds: ['B'], targets: [{ id: 'B', name: 'B', slug: 'b' }] });
    await setDoc(doc(db, 'whitelabels/A/patients/p1'), { whitelabelId: 'A', name: 'Paciente 1', sharedWith: ['B'] });
    await setDoc(doc(db, 'whitelabels/A/patients/p2'), { whitelabelId: 'A', name: 'Paciente 2' });
    await setDoc(doc(db, 'whitelabels/A/patients/p4'), { whitelabelId: 'A', name: 'Paciente 4' });
    await setDoc(doc(db, 'whitelabels/A/evolutions/e1'), { whitelabelId: 'A', patientId: 'p1', therapistId: 'terapA', content: 'x' });
    await setDoc(doc(db, 'whitelabels/A/appointments/a1'), {
      whitelabelId: 'A', patientId: 'p1', therapistId: 'terapA', sharedToWhitelabels: ['B'],
    });
    await setDoc(doc(db, 'whitelabels/A/appointments/a2'), { whitelabelId: 'A', patientId: 'p1', therapistId: 'terapA' });
    await setDoc(doc(db, 'patients/legado'), { name: 'Legado', sharedWith: ['B'], whitelabelId: 'A' });
  });

  const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.com` }).firestore();
  let failures = 0;
  const check = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
      console.log(`OK: ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FALHOU: ${name}\n  ${(error as Error).message.split('\n')[0]}`);
    }
  };

  // (a, b) sharedWith só com destinos liberados.
  await check('gestor da origem grava sharedWith liberado', () =>
    assertSucceeds(updateDoc(doc(as('gestorA'), 'whitelabels/A/patients/p2'), { sharedWith: ['B'] })));
  await check('gestor da origem não grava sharedWith não liberado', () =>
    assertFails(updateDoc(doc(as('gestorA'), 'whitelabels/A/patients/p2'), { sharedWith: ['C'] })));
  // (c) outros papéis da origem.
  await check('recepção da origem não altera sharedWith', () =>
    assertFails(updateDoc(doc(as('recepA'), 'whitelabels/A/patients/p4'), { sharedWith: ['B'] })));
  await check('recepção da origem ainda edita o cadastro sem mexer em sharedWith', () =>
    assertSucceeds(updateDoc(doc(as('recepA'), 'whitelabels/A/patients/p1'), { name: 'Paciente Um' })));
  // (h) limite de 3.
  await check('sharedWith com 4 ids falha', () =>
    assertFails(updateDoc(doc(as('gestorA'), 'whitelabels/A/patients/p2'), { sharedWith: ['B', 'B2', 'B3', 'B4'] })));
  // (d) leitura do paciente.
  await check('membro do destino lê paciente compartilhado', () =>
    assertSucceeds(getDoc(doc(as('recepB'), 'whitelabels/A/patients/p1'))));
  await check('whitelabel sem vínculo não lê paciente compartilhado', () =>
    assertFails(getDoc(doc(as('gestorC'), 'whitelabels/A/patients/p1'))));
  await check('destino não lê paciente não compartilhado', () =>
    assertFails(getDoc(doc(as('gestorB'), 'whitelabels/A/patients/p3'))));
  // (i) edição do cadastro pelo destino.
  await check('gestor do destino não altera o cadastro da origem', () =>
    assertFails(updateDoc(doc(as('gestorB'), 'whitelabels/A/patients/p1'), { name: 'Outro' })));
  // (e) prontuário.
  await check('gestor do destino lê evolução do paciente compartilhado', () =>
    assertSucceeds(getDocs(query(collection(as('gestorB'), 'whitelabels/A/evolutions'), where('patientId', '==', 'p1')))));
  await check('terapeuta do destino grava evolução do paciente compartilhado', () =>
    assertSucceeds(setDoc(doc(as('terapB'), 'whitelabels/A/evolutions/e2'), {
      whitelabelId: 'A', patientId: 'p1', therapistId: 'terapB', content: 'y',
    })));
  await check('recepção do destino não lê evolução', () =>
    assertFails(getDocs(query(collection(as('recepB'), 'whitelabels/A/evolutions'), where('patientId', '==', 'p1')))));
  await check('whitelabel sem vínculo não lê evolução', () =>
    assertFails(getDocs(query(collection(as('gestorC'), 'whitelabels/A/evolutions'), where('patientId', '==', 'p1')))));
  // (f) agendamentos com tag.
  await check('agendamento com tag fora do sharedWith do paciente falha', () =>
    assertFails(setDoc(doc(as('gestorA'), 'whitelabels/A/appointments/a3'), {
      whitelabelId: 'A', patientId: 'p1', patientWhitelabelId: 'A', therapistId: 'terapA', sharedToWhitelabels: ['C'],
    })));
  await check('agendamento com tag dentro do sharedWith passa', () =>
    assertSucceeds(setDoc(doc(as('gestorA'), 'whitelabels/A/appointments/a4'), {
      whitelabelId: 'A', patientId: 'p1', patientWhitelabelId: 'A', therapistId: 'terapA', sharedToWhitelabels: ['B'],
    })));
  // (g) cópias-índice no destino.
  await check('destino não lê agendamento de outro whitelabel direto', () =>
    assertFails(getDoc(doc(as('terapB'), 'whitelabels/A/appointments/a2'))));
  await check('gestor da origem grava cópia do paciente no destino liberado', () => {
    const dbA = as('gestorA');
    const batch = writeBatch(dbA);
    batch.update(doc(dbA, 'whitelabels/A/patients/p4'), { sharedWith: ['B'] });
    batch.set(doc(dbA, 'whitelabels/B/sharedPatients/A__p4'), { ownerWhitelabelId: 'A', patientId: 'p4', name: 'Paciente 4' });
    return assertSucceeds(batch.commit());
  });
  await check('gestor da origem não grava cópia em whitelabel fora do sharedWith', () =>
    assertFails(setDoc(doc(as('gestorA'), 'whitelabels/C/sharedPatients/A__p1'), { ownerWhitelabelId: 'A', patientId: 'p1', name: 'x' })));
  await check('recepção da origem não grava cópia do paciente', () =>
    assertFails(setDoc(doc(as('recepA'), 'whitelabels/B/sharedPatients/A__p1'), { ownerWhitelabelId: 'A', patientId: 'p1', name: 'x' })));
  await check('membro do destino lê cópia do paciente; outro whitelabel não', async () => {
    await assertSucceeds(getDoc(doc(as('recepB'), 'whitelabels/B/sharedPatients/A__p4')));
    await assertFails(getDoc(doc(as('gestorC'), 'whitelabels/B/sharedPatients/A__p4')));
  });
  await check('terapeuta da origem grava cópia de agendamento com tag no destino', () =>
    assertSucceeds(setDoc(doc(as('terapA'), 'whitelabels/B/sharedAppointments/A__a1'), {
      sourceWhitelabelId: 'A', appointmentId: 'a1', patientId: 'p1', date: '2026-11-20', time: '09:00',
    })));
  await check('cópia de agendamento sem tag para o destino falha', () =>
    assertFails(setDoc(doc(as('terapA'), 'whitelabels/C/sharedAppointments/A__a1'), {
      sourceWhitelabelId: 'A', appointmentId: 'a1', patientId: 'p1', date: '2026-11-20', time: '09:00',
    })));
  await check('gestor do destino apaga cópia de agendamento na própria agenda', () =>
    assertSucceeds(deleteDoc(doc(as('gestorB'), 'whitelabels/B/sharedAppointments/A__a1'))));
  await check('recepção do destino não apaga cópia de agendamento', async () => {
    await setDoc(doc(as('terapA'), 'whitelabels/B/sharedAppointments/A__a1'), { sourceWhitelabelId: 'A', appointmentId: 'a1', patientId: 'p1', date: '2026-11-20', time: '09:00' });
    await assertFails(deleteDoc(doc(as('recepB'), 'whitelabels/B/sharedAppointments/A__a1')));
  });
  await check('coleção raiz legada de pacientes continua negada', () =>
    assertFails(getDoc(doc(as('gestorB'), 'patients/legado'))));
  // vínculos.
  await check('gestor lê o próprio vínculo e não o de outro', async () => {
    await assertSucceeds(getDoc(doc(as('gestorA'), 'whitelabelLinks/A')));
    await assertFails(getDoc(doc(as('gestorB'), 'whitelabelLinks/A')));
  });
  await check('gestor não grava vínculo', () =>
    assertFails(setDoc(doc(as('gestorA'), 'whitelabelLinks/A'), { targetIds: ['C'], targets: [] })));
  // (j) pacote com terapeuta.
  await check('terapeuta cria pacote com therapistId', () =>
    assertSucceeds(setDoc(doc(as('terapA'), 'whitelabels/A/packages/k1'), {
      whitelabelId: 'A', patientId: 'p1', totalSessions: 10, status: 'ATIVO', createdBy: 'terapA', therapistId: 'terapA',
    })));

  await env.cleanup();
  if (failures > 0) {
    console.error(`${failures} cenário(s) falharam.`);
    process.exit(1);
  }
  console.log('OK: regras de compartilhamento.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
