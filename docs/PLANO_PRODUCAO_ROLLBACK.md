# Plano De Implementacao Em Producao E Rollback

## Objetivo

Publicar com seguranca as mudancas recentes de autenticacao, whitelabel, convites, membros e modalidades terapeuticas, preservando uma rota clara de retorno ao estado atual caso algum fluxo critico falhe em producao.

Para uma execucao operacional passo a passo, seguir tambem `docs/GUIA_DEPLOY_FIREBASE_HOSTING.md`.

## Escopo Do Deploy

- Frontend React/Vite.
- Regras e indices do Firestore.
- Fluxos de login, recuperacao de senha, convite, aceite de convite, selecao de perfil/whitelabel e gestao de membros.
- Configuracao de modalidades terapeuticas por whitelabel, incluindo edicao por gestor.

## Premissas

- O deploy deve partir de uma revisao git identificavel e imutavel.
- O estado atual aprovado deve ser marcado antes de publicar qualquer alteracao em producao.
- Firestore continua usando `clients` como colecao legada para o cadastro de whitelabel no back-office.
- Dados clinicos sensiveis devem permanecer acessiveis apenas por escopo de whitelabel.
- Nao bloquear colecoes globais antigas antes de validar acesso legado e migracao.

## Preparacao Antes Do Deploy

1. Criar uma referencia de rollback no Git:
   - `git status`
   - confirmar que nao ha alteracoes inesperadas.
   - criar tag, por exemplo `prod-baseline-YYYYMMDD-HHMM`.
   - registrar o hash do commit atual no ticket de deploy.

2. Guardar artefatos de rollback:
   - salvar o hash do commit/tag usado em producao antes do deploy.
   - baixar ou registrar a versao atual de `firestore.rules`.
   - baixar ou registrar a versao atual de `firestore.indexes.json`.
   - registrar variaveis de ambiente usadas pelo frontend em producao.

3. Executar validacoes locais:
   - `npm run lint`
   - `npm run test:local`
   - `npm run build`

4. Validar Firebase em ambiente seguro:
   - iniciar Emulator quando possivel.
   - testar criacao de whitelabel.
   - testar criacao de modalidades.
   - testar convite pendente.
   - testar aceite de convite.
   - testar gestor editando modalidades e membro terapeuta.

## Ordem Recomendada De Publicacao

1. Publicar primeiro o frontend em ambiente de preview/staging.
2. Executar smoke test contra staging.
3. Publicar `firestore.rules` e `firestore.indexes.json`.
4. Publicar frontend de producao.
5. Executar smoke test de producao imediatamente.

Se a hospedagem do frontend permitir deploy atomico ou alias, usar um alias de preview antes de apontar trafego para producao.

## Smoke Test Obrigatorio Em Producao

Executar com uma whitelabel de teste ou conta controlada:

1. Login por e-mail/senha.
2. Recuperacao de senha ate o envio do e-mail, sem revelar se a conta existe.
3. Admin global abre Backoffice.
4. Admin global edita whitelabel e salva modalidades com virgula e espaco.
5. Admin global abre `Gerenciar membros`.
6. Admin global gera convite para `TERAPEUTA` com modalidade.
7. Copiar link de convite pendente.
8. Aceitar convite com conta de teste.
9. Conta convidada entra e visualiza somente a whitelabel correta.
10. Gestor abre `Gerenciar membros`.
11. Gestor adiciona nova modalidade.
12. Gestor edita um terapeuta e seleciona a nova modalidade.
13. Tela `Terapeutas` nao exibe botao `Novo Terapeuta`.
14. Usuario sem membership nao recebe acesso indevido a gestao.

## Monitoramento Pos-Deploy

Durante os primeiros 30 a 60 minutos:

- Monitorar erros de permissao do Firestore.
- Monitorar falhas em convites e aceite de convite.
- Validar se documentos pendentes em `members/{email}` aparecem corretamente.
- Validar se documentos definitivos em `members/{uid}` substituem pendentes apos aceite.
- Conferir se gestores conseguem ler `clients/{whitelabelId}` apenas da propria whitelabel.
- Conferir se nao ha aumento anormal de erros no login ou na troca de perfil.

## Criterios Para Rollback

Acionar rollback se ocorrer qualquer item abaixo:

- Usuarios autenticados nao conseguem entrar.
- Gestores perdem acesso ao ambiente ativo.
- Convites deixam de ser aceitos.
- Dados de outra whitelabel aparecem para usuario sem permissao.
- Regras do Firestore bloqueiam fluxos clinicos essenciais.
- Criacao/edicao de pacientes, agenda ou prontuario falha de forma generalizada.
- Gestor consegue alterar campos da whitelabel alem de `settings.therapistSpecialties`.

## Rollback Do Frontend

1. Reapontar o deploy para a tag/hash anterior registrado como baseline.
2. Reexecutar build do baseline:
   - `npm ci`
   - `npm run build`
3. Publicar novamente o artefato anterior pela plataforma de hospedagem.
4. Confirmar que o bundle antigo esta ativo com um hard refresh em producao.
5. Executar smoke test minimo:
   - login.
   - dashboard.
   - pacientes.
   - agenda.
   - terapeutas.

## Rollback Do Firestore

1. Restaurar `firestore.rules` para a versao baseline.
2. Restaurar `firestore.indexes.json` para a versao baseline, se tiver sido alterado.
3. Publicar:
   - `npm run firebase:deploy:firestore`
4. Validar no console do Firebase se a publicacao concluiu.
5. Reexecutar smoke test minimo com usuario admin, gestor e terapeuta.

## Rollback De Dados

As mudancas recentes adicionam campos novos e devem ser compativeis com ausencia deles:

- `settings.therapistSpecialties`
- `members/{id}.therapistSpecialty`
- `invites/{token}.therapistSpecialty`

Em rollback normal, nao apagar esses campos automaticamente. Eles podem permanecer sem quebrar a versao anterior se a UI antiga os ignorar.

Apagar ou editar dados manualmente apenas se:

- um campo novo estiver bloqueando regra antiga;
- um convite especifico ficar inconsistente;
- houver duplicidade indevida em `members/{email}` e `members/{uid}`.

Antes de qualquer ajuste manual em producao, exportar os documentos afetados ou registrar print/JSON no ticket de incidente.

## Plano De Comunicacao

Antes do deploy:

- Avisar janela de manutencao curta para operadores internos.
- Informar que convites e gestao de membros ficarao em validacao.

Durante o deploy:

- Manter uma pessoa validando UI e outra observando Firebase/logs.

Depois do deploy:

- Confirmar conclusao e listar fluxos testados.
- Registrar hash/tag publicado.
- Registrar se houve ou nao rollback.

## Checklist Final

- [ ] Hash/tag baseline registrado.
- [ ] `firestore.rules` baseline salvo.
- [ ] `firestore.indexes.json` baseline salvo.
- [ ] Variaveis de ambiente conferidas.
- [ ] `npm run lint` concluido.
- [ ] `npm run test:local` concluido.
- [ ] `npm run build` concluido.
- [ ] Preview/staging validado.
- [ ] Firestore publicado.
- [ ] Frontend publicado.
- [ ] Smoke test de producao concluido.
- [ ] Monitoramento inicial concluido.
- [ ] Plano de rollback mantido acessivel durante a janela.
