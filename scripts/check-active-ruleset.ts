/**
 * Consulta a Firebase Rules API para ver o ruleset REALMENTE publicado em
 * producao (Firestore), sem depender do que esta no repo.
 *
 * Contexto: numa sessao anterior, o ruleset ativo era o modo de teste aberto
 * (allow read,write ate uma data), enquanto o firestore.rules do repo nunca
 * tinha sido publicado. So confiar no arquivo local teria sido um erro.
 *
 * Uso: npx tsx scripts/check-active-ruleset.ts
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

  const { GoogleAuth } = await import('google-auth-library');
  const credentials = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const projectId = credentials.project_id;

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  const releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const release = await releaseRes.json();

  if (!releaseRes.ok) {
    console.error('Erro ao consultar release:', release);
    process.exit(1);
  }

  const rulesetName: string = release.rulesetName;
  console.log(`Release ativo: ${release.name}`);
  console.log(`Ruleset: ${rulesetName}`);
  console.log(`Criado em: ${release.updateTime}\n`);

  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ruleset = await rulesetRes.json();

  const content: string = ruleset.source?.files?.[0]?.content ?? '';
  console.log('=== Conteudo do ruleset ATIVO em producao ===\n');
  console.log(content);

  const localContent = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  console.log('\n=== Ativo == arquivo local do repo? ===');
  console.log(content.trim() === localContent.trim() ? 'SIM, identicos.' : 'NAO — diferem.');

  process.exit(0);
}

main();
