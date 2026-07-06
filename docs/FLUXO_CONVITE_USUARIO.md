# Fluxo de convite de usuario

Este fluxo evita criar senha manualmente no Console do Firebase.

## Como o administrador cria o acesso

1. Entrar como `ADMIN_GLOBAL`.
2. Abrir `Backoffice`.
3. Abrir `Membros` na whitelabel desejada.
4. Preencher Nome, E-mail e Papeis.
5. Clicar em `Gerar Convite`.
6. Copiar o link exibido e enviar ao usuario pelo canal operacional da clinica.

Ao gerar o convite, o sistema cria:

- Um documento em `invites/{token}` com os dados do convite.
- Um membro pendente em `whitelabels/{whitelabelId}/members/{email}` com o link salvo para copiar novamente.

## Como o gestor convida recepcao ou terapeuta

1. Entrar como `GESTOR`.
2. Abrir o menu `Gestao`.
3. Abrir `Membros` da whitelabel ativa.
4. Preencher Nome, E-mail e Papeis.
5. Usar apenas `REPCAO` ou `TERAPEUTA`.
6. Clicar em `Gerar Convite`.
7. Copiar e enviar o link.

O gestor nao cria novas whitelabels e nao convida outro `GESTOR`. Essa acao permanece com o `ADMIN_GLOBAL`.

## Como o gestor ou terapeuta ativa a conta

1. Abrir o link recebido.
2. Conferir o e-mail exibido.
3. Informar nome e senha.
4. Clicar em `Ativar conta`.
5. Entrar na aplicacao.

Ao aceitar, o sistema:

- Cria a conta no Firebase Auth com e-mail e senha.
- Cria/atualiza o membro ativo em `whitelabels/{whitelabelId}/members/{uid}`.
- Atualiza o convite para `ACEITO`.
- Remove um membro pendente antigo por e-mail, se existir de uma versao anterior do fluxo.
- Exibe sucesso e envia o usuario para o login.

## Validacoes no aceite do link

Antes de ativar a conta, o app verifica:

- O token existe.
- O convite esta `PENDENTE`.
- O convite possui whitelabel, e-mail e papel.
- A senha tem pelo menos 6 caracteres.
- A confirmacao de senha confere.
- Se houver conta ja logada, o e-mail logado precisa ser igual ao e-mail do convite.

## Usuario ja tem conta

Se o e-mail ja existe no Firebase Auth, o usuario deve entrar normalmente com a conta existente, abrir novamente o link do convite e usar a opcao `Ativar com conta ja logada`.

## Ambiente seguro de teste

Para testar sem tocar no Firebase real, use o modo Emulator:

```powershell
npm run firebase:emulators:start
```

Em outro terminal:

```powershell
npm run dev:emulator
```

Depois valide:

- Criar uma whitelabel.
- Gerar convite de gestor.
- Abrir o link em uma aba anonima ou outro navegador.
- Definir senha.
- Confirmar no Emulator UI que o usuario foi criado no Auth.
- Confirmar no Firestore emulado que o membro ficou ativo.
