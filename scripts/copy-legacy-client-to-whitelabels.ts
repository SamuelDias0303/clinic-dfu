/**
 * Copia (nao move) os documentos da colecao legada `clients` para
 * `whitelabels`, preservando o id do documento.
 *
 * Parte da correcao do bug em que `whitelabelService` lia apenas `clients`
 * enquanto o resto do app (scopedCollection, migrate-to-whitelabels.ts,
 * firestore.rules) usa `whitelabels`. Sem esta copia, o whitelabel
 * "teste whitelabel" desapareceria da tela Admin Global ao trocar a colecao
 * de leitura do service.
 *
 * Dry-run por padrao. Uso:
 *   npx tsx scripts/copy-legacy-client-to-whitelabels.ts
 *   npx tsx scripts/copy-legacy-client-to-whitelabels.ts --apply
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

async function main() {
  const apply = process.argv.includes('--apply');

  if (!existsSync(KEY_PATH)) {
    console.error(`Chave de servico nao encontrada em ${KEY_PATH}`);
    process.exit(1);
  }

  const admin = await import('firebase-admin');
  const credentials = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore(app);

  const clients = await db.collection('clients').get();
  console.log(`${apply ? '*** MODO APPLY ***' : 'Dry-run: nada sera escrito.'}\n`);
  console.log(`${clients.size} documento(s) em "clients"`);

  for (const clientDoc of clients.docs) {
    const destino = await db.collection('whitelabels').doc(clientDoc.id).get();
    if (destino.exists) {
      console.log(` - ${clientDoc.id}: ja existe em "whitelabels", pulando.`);
      continue;
    }

    console.log(` - ${clientDoc.id}: copiar para whitelabels/${clientDoc.id}`);
    if (apply) {
      await db.collection('whitelabels').doc(clientDoc.id).set({
        ...clientDoc.data(),
        workspaceType: 'CLINICA',
      }, { merge: true });
    }
  }

  console.log('\nConcluido. A colecao "clients" nao foi alterada.');
  process.exit(0);
}

main();
