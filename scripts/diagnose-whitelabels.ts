/**
 * Diagnostico somente-leitura: compara o que existe em `clients` (colecao
 * lida hoje pelo whitelabelService) contra `whitelabels` (colecao usada pelo
 * resto do app: scopedCollection, migrate-to-whitelabels.ts, firestore.rules).
 *
 * Nao escreve nada. Uso: npx tsx scripts/diagnose-whitelabels.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  console.log('=== colecao "clients" (lida hoje pelo whitelabelService) ===');
  const clients = await db.collection('clients').get();
  clients.docs.forEach((d) => console.log(` - ${d.id}:`, JSON.stringify(d.data()).slice(0, 200)));
  console.log(`total: ${clients.size}\n`);

  console.log('=== colecao "whitelabels" (usada por scopedCollection / rules) ===');
  const whitelabels = await db.collection('whitelabels').get();
  whitelabels.docs.forEach((d) => console.log(` - ${d.id}:`, JSON.stringify(d.data()).slice(0, 200)));
  console.log(`total: ${whitelabels.size}\n`);

  console.log('=== membros de cada whitelabel em "whitelabels/{id}/members" ===');
  for (const doc of whitelabels.docs) {
    const members = await db.collection(`whitelabels/${doc.id}/members`).get();
    console.log(` - ${doc.id}: ${members.size} membro(s)`);
    members.docs.forEach((m) => console.log(`     ${m.id} -> ${JSON.stringify(m.data())}`));
  }

  process.exit(0);
}

main();
