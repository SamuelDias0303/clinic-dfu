/**
 * Exporta as colecoes do Firestore para JSON local.
 *
 * Rode ANTES de qualquer migracao. O export nativo do Firestore
 * (`gcloud firestore export`) exige um bucket do Cloud Storage, que este
 * projeto ainda nao provisionou — por isso o backup e feito pelo Admin SDK.
 *
 * PRE-REQUISITOS: os mesmos de `grant-admin.ts`. Ver docs/ACESSO_ADMIN_GLOBAL.md.
 *
 * USO
 *
 *   npm.cmd run backup
 *
 * Gera `backups/firestore-<timestamp>/<colecao>.json`, preservando o id de cada
 * documento. A pasta `backups/` esta no .gitignore: e dado clinico e nao pode
 * ser versionado.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

/** Colecoes de raiz. Subcolecoes de whitelabel sao percorridas em seguida. */
const ROOT_COLLECTIONS = [
  'patients', 'therapists', 'appointments', 'evolutions', 'anamneses',
  'clients', 'users', 'invites', 'whitelabels',
];

const TENANT_SUBCOLLECTIONS = [
  'members', 'patients', 'therapists', 'appointments', 'evolutions', 'anamneses', 'auditLogs',
  'leads', 'siteContent',
];

async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Chave de servico nao encontrada em ${KEY_PATH}`);
    process.exit(1);
  }

  let admin: typeof import('firebase-admin');
  try {
    admin = await import('firebase-admin');
  } catch {
    console.error('firebase-admin nao instalado. Rode: npm i -D firebase-admin');
    process.exit(1);
  }

  const credentials = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore(app);

  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = resolve(process.cwd(), 'backups', `firestore-${carimbo}`);
  mkdirSync(destino, { recursive: true });

  let total = 0;

  const dump = async (caminho: string, arquivo: string) => {
    const snapshot = await db.collection(caminho).get();
    if (snapshot.empty) return;
    const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    writeFileSync(resolve(destino, `${arquivo}.json`), JSON.stringify(docs, null, 2), 'utf8');
    console.log(`  ${caminho.padEnd(52)} ${String(docs.length).padStart(4)} doc(s)`);
    total += docs.length;
  };

  console.log(`\nExportando para ${destino}\n`);

  for (const colecao of ROOT_COLLECTIONS) {
    await dump(colecao, colecao);
  }

  const whitelabels = await db.collection('whitelabels').get();
  for (const wl of whitelabels.docs) {
    for (const sub of TENANT_SUBCOLLECTIONS) {
      await dump(`whitelabels/${wl.id}/${sub}`, `whitelabels__${wl.id}__${sub}`);
    }
  }

  console.log(`\n${total} documento(s) exportado(s).\n`);
  console.log('Guarde esta pasta fora do repositorio antes de rodar a migracao.\n');
}

main().catch((error) => {
  console.error('Falhou:', error instanceof Error ? error.message : error);
  process.exit(1);
});
