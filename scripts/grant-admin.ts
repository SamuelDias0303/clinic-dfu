/**
 * Cria ou corrige uma conta ADMIN_GLOBAL com custom claims.
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * `firestore.rules` so reconhece ADMIN_GLOBAL por custom claim:
 *
 *     request.auth.token.admin == true || tokenRoles().hasAny(['ADMIN_GLOBAL'])
 *
 * O `AuthContext` e mais permissivo (aceita `users/{uid}.roles` e o fallback de
 * e-mail contendo "admin"), entao e possivel a UI mostrar o Backoffice enquanto
 * o Firestore recusa toda leitura e escrita. Custom claim so pode ser gravada
 * pelo Admin SDK — o console do Firebase nao faz isso.
 *
 * PRE-REQUISITOS
 *
 *   1. npm i -D firebase-admin
 *   2. Console do Firebase > Configuracoes do projeto > Contas de servico >
 *      "Gerar nova chave privada". Salve como `service-account.json` na raiz.
 *      O arquivo ja esta no .gitignore — ele da acesso total ao projeto e
 *      nunca deve ser commitado nem compartilhado.
 *
 * USO
 *
 *   npm run admin:grant -- --email raiza@exemplo.com
 *   npm run admin:grant -- --email raiza@exemplo.com --revoke
 *   npm run admin:grant -- --list
 *
 * A senha e pedida de forma oculta no terminal. NAO passe `--password` na linha
 * de comando: o valor fica no historico do shell, na lista de processos e em
 * mensagens de erro. A flag existe apenas para automacao nao interativa, e
 * avisa quando usada.
 *
 * Se o e-mail ja existir, a senha e atualizada. Se nao existir, a conta e
 * criada. Em ambos os casos as claims sao gravadas.
 *
 * Prefira um e-mail REAL: `admin@clinicdfu.local` nao recebe link de
 * recuperacao de senha, que foi exatamente o problema que gerou este script.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

/** Le a senha sem eco no terminal, para nao vazar em historico nem em log. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('Terminal nao interativo. Rode direto no PowerShell ou use --password.'));
      return;
    }

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on('data', onData);
  });
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
  const auth = admin.auth(app);

  if (hasFlag('list')) {
    const { users } = await auth.listUsers(1000);
    const admins = users.filter(
      (user) =>
        user.customClaims?.admin === true ||
        (user.customClaims?.roles as string[] | undefined)?.includes('ADMIN_GLOBAL')
    );

    console.log(`\n${users.length} conta(s) no projeto, ${admins.length} com ADMIN_GLOBAL real:\n`);
    for (const user of admins) {
      console.log(`  ${user.email ?? '(sem e-mail)'}  uid=${user.uid}`);
    }
    if (admins.length === 0) {
      console.log('  (nenhuma — apos publicar as regras, ninguem conseguira operar o Backoffice)');
    }
    console.log('');
    process.exit(0);
  }

  const email = arg('email');
  if (!email) {
    console.error('Informe --email. Use --list para ver quem ja tem ADMIN_GLOBAL.');
    process.exit(1);
  }

  const revoke = hasFlag('revoke');
  let password = arg('password');

  if (password) {
    console.warn(
      '\nAVISO: senha passada por argumento fica no historico do shell, na lista\n' +
      'de processos e em mensagens de erro. Prefira omitir --password e digitar\n' +
      'quando for solicitado.\n'
    );
  }

  if (!revoke && !password) {
    password = await promptHidden(`Senha para ${email}: `);
    const confirmacao = await promptHidden('Confirme a senha: ');

    if (password !== confirmacao) {
      console.error('As senhas nao conferem.');
      process.exit(1);
    }
    if (password.length < 6) {
      console.error('O Firebase exige no minimo 6 caracteres.');
      process.exit(1);
    }
  }

  let user = await auth.getUserByEmail(email).catch(() => null);

  if (!user) {
    if (revoke) {
      console.error(`Usuario ${email} nao existe.`);
      process.exit(1);
    }
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log(`Conta criada: ${email}`);
  } else if (password) {
    await auth.updateUser(user.uid, { password });
    console.log(`Senha atualizada: ${email}`);
  }

  const claims = revoke ? null : { admin: true, roles: ['ADMIN_GLOBAL'] };
  await auth.setCustomUserClaims(user.uid, claims);

  // Invalida os refresh tokens: sessoes abertas precisam relogar para o token
  // novo carregar as claims. Sem isso, a mudanca so valeria apos ~1h.
  await auth.revokeRefreshTokens(user.uid);

  console.log(revoke ? `ADMIN_GLOBAL removido de ${email}` : `ADMIN_GLOBAL concedido a ${email}`);
  console.log(`uid: ${user.uid}`);
  console.log('\nFaca logout e login novamente para o token carregar as claims.');
}

main().catch((error) => {
  console.error('Falhou:', error instanceof Error ? error.message : error);
  process.exit(1);
});
