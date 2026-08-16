/**
 * Audita `users/{uid}` procurando privilegio gravado antes da correcao das regras.
 *
 * POR QUE
 *
 * Ate a correcao, `match /users/{userId}` permitia que a propria pessoa
 * gravasse qualquer campo no proprio documento, e o `AuthContext` confia em
 * dois deles:
 *
 *   roles            -> entra direto na lista de papeis
 *   provisioningMode -> empurra a conta para o fallback `legacy-default`
 *
 * A regra nova fecha a porta daqui pra frente, mas documento ja gravado
 * continua valendo. Este script mostra o que existe hoje.
 *
 * PRE-REQUISITOS: os mesmos de `grant-admin.ts` (firebase-admin instalado e
 * `service-account.json` na raiz). Ver docs/ACESSO_ADMIN_GLOBAL.md.
 *
 * USO
 *
 *   npm run admin:audit                     # somente leitura
 *   npm run admin:audit -- --strip          # remove `roles` dos perfis suspeitos
 *   npm run admin:audit -- --strip --uid X  # remove de um usuario so
 *
 * CLASSIFICACAO
 *
 * Nem todo campo privilegiado e suspeito. O `personalWorkspaceService` grava
 * legitimamente `roles: ['TERAPEUTA']` + `provisioningMode: 'PERSONAL_WORKSPACE'`
 * ao provisionar o workspace individual. Apagar isso quebraria esses usuarios.
 *
 * Suspeito e apenas perfil que concede papel elevado (ADMIN_GLOBAL ou GESTOR)
 * sem custom claim correspondente.
 *
 * `--strip` remove somente o campo `roles` dos SUSPEITOS. Nunca toca em
 * `provisioningMode` nem em perfis legitimos. Quem precisa de ADMIN_GLOBAL de
 * verdade recebe por custom claim, com `npm run admin:grant`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

const PRIVILEGED = ['roles', 'provisioningMode'] as const;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Chave de servico nao encontrada em ${KEY_PATH}`);
    console.error('Console do Firebase > Configuracoes do projeto > Contas de servico > Gerar nova chave privada.');
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
  const auth = admin.auth(app);

  const strip = process.argv.includes('--strip');
  const somenteUid = arg('uid');

  const snapshot = await db.collection('users').get();

  if (snapshot.empty) {
    console.log('\nNenhum documento em `users`. Nada a auditar.\n');
    process.exit(0);
  }

  const candidatos = snapshot.docs.filter((docSnap) => {
    if (somenteUid && docSnap.id !== somenteUid) return false;
    return PRIVILEGED.some((campo) => docSnap.data()[campo] !== undefined);
  });

  let suspeitos = 0;

  console.log(`\n${snapshot.size} documento(s) em \`users\`, ${candidatos.length} com campo privilegiado.\n`);

  for (const docSnap of candidatos) {
    const data = docSnap.data();
    const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
    const authUser = await auth.getUser(docSnap.id).catch(() => null);
    const claims = authUser?.customClaims ?? {};
    const temClaimAdmin =
      claims.admin === true || (claims.roles as string[] | undefined)?.includes('ADMIN_GLOBAL');

    const papelElevado = roles.some((papel) => papel === 'ADMIN_GLOBAL' || papel === 'GESTOR');
    const bootstrapLegitimo =
      roles.length === 1 &&
      roles[0] === 'TERAPEUTA' &&
      data.provisioningMode === 'PERSONAL_WORKSPACE';

    // Papel elevado sem claim correspondente e o unico caso preocupante.
    const suspeito = papelElevado && !temClaimAdmin;
    if (suspeito) suspeitos += 1;

    const marcador = suspeito ? 'SUSPEITO' : bootstrapLegitimo ? 'ok (workspace individual)' : 'ok';

    console.log(`  [${marcador}] uid ${docSnap.id}  ${authUser?.email ?? '(conta inexistente no Auth)'}`);
    for (const campo of PRIVILEGED) {
      if (data[campo] !== undefined) {
        console.log(`    ${campo}: ${JSON.stringify(data[campo])}`);
      }
    }
    console.log(`    claim ADMIN_GLOBAL real: ${temClaimAdmin ? 'sim' : 'nao'}`);

    if (suspeito && strip) {
      // So `roles`. `provisioningMode` e dado legitimo do provisionamento.
      await docSnap.ref.update({ roles: admin.firestore.FieldValue.delete() });
      console.log('    -> campo `roles` removido');
    }
    console.log('');
  }

  if (suspeitos === 0) {
    console.log('Nenhum perfil concede papel elevado sem claim. Nada a corrigir.\n');
  } else if (!strip) {
    console.log(`${suspeitos} perfil(is) suspeito(s). Rode com --strip para remover o campo \`roles\` deles.\n`);
  } else {
    console.log('Pronto. Quem precisa de ADMIN_GLOBAL deve receber por `npm run admin:grant`.\n');
  }
}

main().catch((error) => {
  console.error('Falhou:', error instanceof Error ? error.message : error);
  process.exit(1);
});
