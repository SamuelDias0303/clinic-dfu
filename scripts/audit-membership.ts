/**
 * Auditoria SOMENTE LEITURA de uma conta especifica: claims, users/{uid},
 * memberships em whitelabels/*, contagem de patients/appointments por tenant.
 *
 * Objetivo: descobrir por que a escrita (salvar paciente / agendar) e negada
 * pelas regras para uma conta que consegue ler.
 *
 * PRE-REQUISITOS: firebase-admin instalado e service-account.json na raiz
 * (mesmos de grant-admin.ts / audit-user-profiles.ts).
 *
 * USO:
 *   npx tsx scripts/audit-membership.ts <email>
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error('uso: npx tsx scripts/audit-membership.ts <email>');
  process.exit(1);
}

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Chave de servico nao encontrada em ${KEY_PATH}`);
    process.exit(1);
  }

  const admin = await import('firebase-admin');
  const credentials = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore(app);
  const auth = admin.auth(app);

  const j = (x: unknown) => JSON.stringify(x, null, 2);

  const user = await auth.getUserByEmail(EMAIL);
  console.log('=== AUTH USER ===');
  console.log('uid:', user.uid);
  console.log('email:', user.email, '| verified:', user.emailVerified, '| disabled:', user.disabled);
  console.log('customClaims:', j(user.customClaims ?? {}));

  console.log(`\n=== users/${user.uid} ===`);
  const uDoc = await db.doc(`users/${user.uid}`).get();
  console.log(uDoc.exists ? j(uDoc.data()) : 'NAO EXISTE');

  console.log('\n=== whitelabels (todas) + membership desta conta ===');
  const wls = await db.collection('whitelabels').get();
  console.log(`total whitelabels: ${wls.size}`);
  for (const wl of wls.docs) {
    const d = wl.data();
    console.log(`\n- ${wl.id}`);
    console.log(`    campos: ${j(d)}`);
    const m = await db.doc(`whitelabels/${wl.id}/members/${user.uid}`).get();
    console.log(`    members/${user.uid}: ${m.exists ? j(m.data()) : 'NAO EXISTE'}`);
    const pc = await db.collection(`whitelabels/${wl.id}/patients`).count().get();
    const ac = await db.collection(`whitelabels/${wl.id}/appointments`).count().get();
    console.log(`    patients=${pc.data().count} appointments=${ac.data().count}`);
  }

  console.log('\n=== collectionGroup(members) para esta conta ===');
  for (const field of ['userId', 'email'] as const) {
    const val = field === 'userId' ? user.uid : EMAIL;
    const snap = await db.collectionGroup('members').where(field, '==', val).get();
    console.log(`por ${field}=${val}: ${snap.size} doc(s)`);
    snap.forEach((s) => console.log(`  ${s.ref.path} -> ${j(s.data())}`));
  }

  console.log('\n=== invites para este email ===');
  const inv = await db.collection('invites').where('email', '==', EMAIL).get();
  console.log(`${inv.size} invite(s)`);
  inv.forEach((s) => console.log(`  ${s.id} -> ${j(s.data())}`));

  console.log('\n=== root /patients (legado; regra bloqueia) ===');
  const rootP = await db.collection('patients').count().get();
  console.log('count:', rootP.data().count);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
