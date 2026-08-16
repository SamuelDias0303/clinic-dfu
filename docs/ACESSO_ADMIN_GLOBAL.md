# Acesso ADMIN_GLOBAL

> Nunca guarde e-mail e senha neste arquivo — ele e versionado. Credencial vai
> em gerenciador de senhas. Se precisar registrar quem tem acesso, use
> `npm.cmd run admin:grant -- --list`, que mostra os admins sem expor segredo.

## O problema das duas fontes de verdade

O papel `ADMIN_GLOBAL` e resolvido de formas diferentes na UI e nas regras.

**`AuthContext.buildUser` (src/contexts/AuthContext.tsx)** aceita quatro fontes, em ordem:

1. Custom claims (`claims.roles`, `claims.admin === true`)
2. `users/{uid}.roles`
3. Papeis vindos das memberships
4. Fallback: se nao houver papel nenhum, e-mail contendo `admin` recebe `ADMIN_GLOBAL`

**`firestore.rules`** aceita apenas a primeira:

```
function isAdminGlobal() {
  return signedIn() && (
    request.auth.token.admin == true
    || tokenRoles().hasAny(['ADMIN_GLOBAL'])
  );
}
```

Consequencia pratica: uma conta pode ver o Backoffice inteiro e mesmo assim receber `permission-denied` em
toda leitura e escrita. Foi assim que `admin@clinicdfu.local` funcionou ate agora — pelo fallback de e-mail,
sem claim nenhuma.

Isso vira bloqueio real no momento em que `firestore.rules` for publicado: `allow create` em
`whitelabels/{whitelabelId}` exige `isAdminGlobal()`, entao sem claims **ninguem consegue criar whitelabel**.

`GESTOR`, `REPCAO` e `TERAPEUTA` nao sao afetados — as regras leem esses papeis dos documentos de membership.

## Como conceder acesso de verdade

Custom claim so pode ser gravada pelo Admin SDK. O console do Firebase permite trocar e-mail e senha de um
usuario, mas **nao** definir claims.

### Preparacao (uma vez)

```bash
npm i -D firebase-admin
```

No console: **Configuracoes do projeto → Contas de servico → Gerar nova chave privada**. Salve como
`service-account.json` na raiz do repositorio.

Esse arquivo da acesso administrativo total ao projeto — ja esta no `.gitignore`, e nunca deve ser
commitado, enviado por chat ou colocado em variavel de ambiente compartilhada.

### Comandos

Ver quem realmente tem `ADMIN_GLOBAL` hoje:

```bash
npm run admin:grant -- --list
```

Criar ou corrigir a conta de admin:

```bash
npm.cmd run admin:grant -- --email voce@dominioreal.com
```

A senha e pedida de forma oculta, com confirmacao. **Nao** use `--password` no dia a dia: o valor fica no
historico do PowerShell, na lista de processos e em qualquer mensagem de erro que ecoe a linha de comando.

No PowerShell use `npm.cmd`, nao `npm`. O `npm` resolve para `npm.ps1`, que a politica de execucao padrao do
Windows bloqueia (`UnauthorizedAccess`). O `.cmd` roda sem depender dessa politica e sem exigir alteracao de
configuracao de seguranca da maquina.

Se o prompt oculto nao aparecer (stdin sem TTY atras do `npm run`), chame o script direto:

```bash
npx.cmd tsx scripts/grant-admin.ts --email voce@dominioreal.com
```

Se o e-mail existir, a senha e atualizada; se nao, a conta e criada. Nos dois casos as claims
`{ admin: true, roles: ['ADMIN_GLOBAL'] }` sao gravadas e os refresh tokens sao invalidados — sem isso a
mudanca so valeria depois de ~1h.

Remover o acesso de alguem:

```bash
npm run admin:grant -- --email antigo@exemplo.com --revoke
```

Depois de rodar, **faca logout e login novamente**: as claims entram no token novo.

### Sobre `admin@clinicdfu.local`

Use um e-mail real. O dominio `.local` nao existe, entao nao recebe link de recuperacao de senha — foi
exatamente o que travou o acesso. Depois de criar a conta nova e confirmar que funciona, desative a antiga
no console (Authentication → usuario → Desativar conta), em vez de apagar, para nao perder o historico de
`createdBy` de documentos antigos.

## Pendencias de seguranca identificadas

Duas brechas de escalacao de privilegio na resolucao de papeis. Nenhuma das duas da acesso a dado clinico
enquanto as regras dependerem de claims, mas ambas expoem a interface do Backoffice a quem nao deveria — e
viram falha real se algum dia alguma regra passar a confiar em `users/{uid}.roles`.

**1. Escrita do proprio perfil — CORRIGIDO nas regras, falta auditar o passado.**

A regra agora impede que a pessoa grave `roles` ou `provisioningMode` arbitrarios no proprio documento. Mas
documento gravado antes disso continua valendo, porque o `AuthContext` le o campo normalmente. Para conferir:

```bash
npm.cmd run admin:audit            # somente leitura
npm.cmd run admin:audit -- --strip # remove `roles` dos perfis suspeitos
```

**Excecao legitima.** O `personalWorkspaceService` (linha 112) grava `users/{uid}` em nome do proprio
usuario, com `roles: ['TERAPEUTA']` e `provisioningMode: 'PERSONAL_WORKSPACE'`, ao provisionar o workspace
individual. Bloquear esses valores quebraria o cadastro de contas novas.

Por isso a regra restringe **valor**, nao apenas chave — mesmo padrao ja usado em
`whitelabels/individual_{uid}`. `TERAPEUTA` e o papel que a conta receberia de qualquer forma, entao
permitir esse valor exato nao abre escalacao; gravar `ADMIN_GLOBAL` continua recusado.

A auditoria segue a mesma logica: perfil com `roles: ['TERAPEUTA']` + `provisioningMode` e marcado como `ok`.
Suspeito e so quem concede `ADMIN_GLOBAL`/`GESTOR` sem custom claim correspondente. `--strip` remove apenas
o campo `roles` desses, e nunca `provisioningMode`.

Redacao anterior da regra, para referencia:

```
match /users/{userId} {
  allow create, update: if isAdminGlobal() || isOwnMemberDoc(userId);
}
```

`isOwnMemberDoc` e apenas `request.auth.uid == userId`. Como o `AuthContext` le `profile.roles`, qualquer
usuario autenticado podia gravar `roles: ['ADMIN_GLOBAL']` no proprio documento e a UI aceitava. O mesmo
valia para `provisioningMode`, que empurra a conta para o fallback `legacy-default`.

A correcao usa `diff(resource.data).affectedKeys().hasAny(['roles', 'provisioningMode'])` — que cobre
adicionar, alterar e remover o campo. Comparar `request.resource.data.roles == resource.data.roles` falharia
quando o campo ainda nao existisse, que e o caso da maioria dos documentos hoje.

Nota para quem for auditar `users/{uid}` no futuro: o codigo escreve essa colecao por
`ROOT_COLLECTIONS.users`, nao pela string literal `'users'`. Buscar so por `'users'` no `src/` faz parecer
que a colecao e somente leitura — foi exatamente esse engano que quase deixou o provisionamento quebrado.

**2. Fallback por e-mail.** Qualquer conta nova cujo e-mail contenha `admin` e que ainda nao tenha papel
recebe `ADMIN_GLOBAL` na UI. Com cadastro aberto, basta registrar `admin@qualquercoisa.com`.

Correcao sugerida: remover o fallback assim que existir pelo menos um admin com claim — o
`npm run admin:grant -- --list` confirma quando isso for verdade.
