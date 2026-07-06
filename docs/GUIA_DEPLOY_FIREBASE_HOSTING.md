# Guia Passo A Passo Para Publicar Em Producao

Este guia assume que o projeto local atualizado sera a fonte oficial do app e que a publicacao sera feita com Firebase Hosting + Firestore Rules/Indexes.

## Visao Geral

Voce vai fazer quatro coisas:

1. Colocar o codigo em um repositorio GitHub.
2. Preparar o projeto Firebase para receber o site.
3. Publicar primeiro em um canal de preview.
4. Publicar em producao com plano de rollback.

## Parte 1: Preparacao Unica

### 1. Criar ou confirmar o projeto Firebase

1. Acesse o Firebase Console.
2. Abra o projeto Firebase que ja esta sendo usado pelo app.
3. Confirme que ele possui:
   - Authentication habilitado.
   - Firestore Database habilitado.
   - Web App cadastrada.
4. Copie as configuracoes do Web App se precisar conferir o `.env`.

### 2. Conferir variaveis do frontend

1. No projeto local, abra `.env.example`.
2. Crie ou confira o arquivo `.env`.
3. Garanta que as variaveis `VITE_...` apontam para o projeto Firebase correto.
4. Nao envie `.env` para o GitHub.

### 3. Instalar Firebase CLI

No terminal:

```powershell
npm install -g firebase-tools
```

Depois:

```powershell
firebase --version
```

Se aparecer uma versao, esta instalado.

### 4. Fazer login no Firebase CLI

```powershell
firebase login
```

O navegador vai abrir. Entre com a mesma conta Google que tem acesso ao projeto Firebase.

### 5. Associar o projeto local ao Firebase

Na pasta do projeto:

```powershell
firebase use --add
```

Escolha o projeto Firebase correto e de um alias, por exemplo:

```text
production
```

Depois confira:

```powershell
firebase projects:list
firebase use
```

## Parte 2: Configurar Firebase Hosting

O `firebase.json` atual ja possui Firestore, mas ainda precisa da secao de Hosting.

### 1. Inicializar Hosting

Na pasta do projeto:

```powershell
firebase init hosting
```

Responda assim:

- Public directory: `dist`
- Configure as a single-page app: `Yes`
- Set up automatic builds and deploys with GitHub: `No` inicialmente
- Overwrite `dist/index.html`: `No`

### 2. Conferir `firebase.json`

Depois do init, o arquivo deve conter algo parecido com:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

Se ja existir a parte de `emulators`, mantenha.

## Parte 3: Colocar O Codigo No GitHub

### 1. Conferir estado do Git

```powershell
git status
```

Se o Git reclamar de `dubious ownership`, rode uma vez:

```powershell
git config --global --add safe.directory C:/trabalho/codigo-fonte/clinic-dfu
```

Depois rode novamente:

```powershell
git status
```

### 2. Criar repositorio no GitHub

1. Acesse GitHub.
2. Crie um novo repositorio.
3. Nao adicione README, `.gitignore` ou license pelo GitHub se o projeto ja tem esses arquivos localmente.
4. Copie a URL do repositorio.

### 3. Conectar local com GitHub

Se ainda nao existir remoto:

```powershell
git remote add origin URL_DO_REPOSITORIO
```

Confira:

```powershell
git remote -v
```

### 4. Criar commit de baseline local

```powershell
git add .
git commit -m "Prepare whitelabel member management for production"
```

### 5. Enviar para GitHub

```powershell
git branch -M main
git push -u origin main
```

## Parte 4: Criar Ponto De Rollback

Antes de publicar, crie uma tag do estado aprovado.

### 1. Confirmar que esta tudo commitado

```powershell
git status
```

O ideal e aparecer que nao ha alteracoes pendentes.

### 2. Criar tag

Use data e hora. Exemplo:

```powershell
git tag prod-baseline-20260522-1800
```

### 3. Enviar tag para GitHub

```powershell
git push origin prod-baseline-20260522-1800
```

### 4. Registrar informacoes

Anote em algum lugar:

- Nome da tag.
- Hash do commit:

```powershell
git rev-parse HEAD
```

- Projeto Firebase usado.
- Data/hora do deploy.

## Parte 5: Validacao Local Antes Do Deploy

Execute exatamente nesta ordem:

```powershell
npm install
npm run lint
npm run test:local
npm run build
```

Se qualquer comando falhar, pare e corrija antes de publicar.

## Parte 6: Deploy Em Preview

Preview permite testar sem afetar a URL principal.

### 1. Gerar build

```powershell
npm run build
```

### 2. Publicar canal de preview

```powershell
firebase hosting:channel:deploy preprod
```

O Firebase vai retornar uma URL temporaria.

### 3. Testar a URL de preview

Na URL de preview, validar:

- Login.
- Recuperacao de senha.
- Admin global abre Backoffice.
- Admin global edita modalidades da whitelabel.
- Admin global abre `Gerenciar membros`.
- Admin global cria convite.
- Convite aparece como pendente.
- Link do convite pode ser copiado.
- Gestor abre `Gerenciar membros`.
- Gestor adiciona modalidade.
- Gestor edita modalidade de terapeuta.
- Tela `Terapeutas` nao mostra `Novo Terapeuta`.

Se algo falhar no preview, nao publique producao.

## Parte 7: Deploy Das Regras Do Firestore

Depois que o preview estiver validado:

```powershell
npm run firebase:deploy:firestore
```

Esse comando publica:

- `firestore.rules`
- `firestore.indexes.json`

Depois, faca um teste rapido com usuarios reais/controlados:

- admin global;
- gestor;
- terapeuta.

## Parte 8: Deploy Do Frontend Em Producao

Depois do Firestore validado:

```powershell
npm run build
firebase deploy --only hosting
```

Ao final, o Firebase vai mostrar a URL publicada.

## Parte 9: Smoke Test De Producao

Execute logo depois do deploy:

1. Abra a URL de producao em aba anonima.
2. Faca login com admin global.
3. Abra Backoffice.
4. Edite modalidades de uma whitelabel de teste.
5. Abra `Gerenciar membros`.
6. Crie convite para terapeuta.
7. Copie link do convite.
8. Aceite convite com conta de teste.
9. Confirme que o convidado acessa apenas a whitelabel correta.
10. Entre como gestor.
11. Adicione nova modalidade.
12. Edite membro terapeuta e selecione a nova modalidade.
13. Abra `Terapeutas`.
14. Confirme que nao existe botao `Novo Terapeuta`.
15. Abra agenda, pacientes e prontuario para conferir que continuam acessiveis.

## Parte 10: Monitoramento Inicial

Nos primeiros 30 a 60 minutos:

- Fique com o Firebase Console aberto.
- Observe erros de Firestore Rules.
- Observe relatos de login.
- Teste um convite ate o aceite.
- Confira se nenhum usuario ve dados de outra whitelabel.
- Confira se gestores conseguem editar apenas modalidades, nao outras configuracoes da whitelabel.

## Parte 11: Rollback Do Frontend

Use se o app visual quebrar, mas Firestore continuar aceitavel.

### 1. Voltar para a tag baseline

```powershell
git checkout prod-baseline-20260522-1800
```

Troque o nome pela tag real.

### 2. Reinstalar e rebuildar

```powershell
npm install
npm run build
```

### 3. Republicar frontend antigo

```powershell
firebase deploy --only hosting
```

### 4. Voltar para a branch principal localmente

```powershell
git checkout main
```

## Parte 12: Rollback Das Regras Do Firestore

Use se as regras bloquearem fluxo essencial ou abrirem acesso indevido.

### 1. Voltar temporariamente para a tag baseline

```powershell
git checkout prod-baseline-20260522-1800
```

### 2. Publicar regras antigas

```powershell
npm run firebase:deploy:firestore
```

### 3. Voltar para a branch principal

```powershell
git checkout main
```

## Parte 13: O Que Nao Fazer No Rollback

- Nao apagar campos novos automaticamente.
- Nao apagar `settings.therapistSpecialties`.
- Nao apagar `members/{id}.therapistSpecialty`.
- Nao apagar `invites/{token}.therapistSpecialty`.
- Nao rodar comandos destrutivos no Firestore sem exportar os documentos afetados.

Os campos novos devem ser ignorados por versoes antigas, entao geralmente rollback de codigo e regras basta.

## Parte 14: Checklist Curto Do Dia Do Deploy

- [ ] GitHub atualizado.
- [ ] Tag baseline criada.
- [ ] Hash do commit anotado.
- [ ] `.env` conferido.
- [ ] `npm run lint` passou.
- [ ] `npm run test:local` passou.
- [ ] `npm run build` passou.
- [ ] Preview publicado.
- [ ] Preview testado.
- [ ] Firestore publicado.
- [ ] Frontend producao publicado.
- [ ] Smoke test producao feito.
- [ ] Monitoramento inicial feito.
- [ ] Tag de rollback acessivel.
