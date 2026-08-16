# Estado

## Foco Atual

Sprint 22 em andamento: fluxo de back-office para gerenciar membros, convites e modalidades terapeuticas configuradas por whitelabel, removendo criacao direta de terapeutas fora da gestao de membros.

Sprint 23 entregue em codigo: modulo `Captacao`, que recebe solicitacoes vindas de site publico e gerencia o conteudo da landing page do whitelabel. Detalhes em `docs/MODULO_CAPTACAO.md`. As regras do Firestore e do Storage NAO foram publicadas — ver Proximas Validacoes.

## Leitura Atual Da Arquitetura

- `AuthContext` consulta custom claims, `users/{uid}` e memberships antes do fallback local por e-mail contendo `admin`.
- Os services operacionais aceitam `whitelabelId` e resolvem caminhos tenant-aware, mantendo fallback `legacy-default` para teste local antes da migracao.
- `BackofficeView` possui gestao de whitelabels, status e membros.
- `firestore.rules`, `firestore.indexes.json` e `firebase.json` existem no repositorio e foram validados em dry-run.
- A documentacao operacional principal esta em `docs/GUIA_OPERACIONAL.md`.
- Escritas para Firestore passam a limpar campos `undefined` antes de chamar `addDoc`, `setDoc` ou `updateDoc`.
- O app pode apontar para Firebase Emulator quando `VITE_USE_FIREBASE_EMULATOR=true`.
- Convites de usuario sao criados em `invites/{token}` e aceitos por link publico com criacao de conta Firebase Auth.
- O fallback legado agora exige `legacy-default` explicito; `whitelabelId` ausente nao deve consultar colecoes globais antigas.
- `GESTOR` acessa gestao limitada para convidar `REPCAO` e `TERAPEUTA` no whitelabel ativo.
- Convites criam membro pendente em `members/{email}` com `inviteUrl`; no aceite, o membro definitivo e criado em `members/{uid}` e o pendente e removido.
- Usuarios sem membership ativa nao recebem mais papeis `GESTOR`/`TERAPEUTA` automaticamente.
- Usuarios antigos sem membership real recebem membership virtual `legacy-default` para continuar acessando dados globais antigos.
- Usuarios sem convite/membership real recebem apenas o papel `TERAPEUTA`; `GESTOR` depende de convite ou membership explicita.
- Contas novas sem convite criadas apos a data de corte recebem `whitelabels/individual_{uid}` com membership `TERAPEUTA`.
- Workspaces individuais nao liberam `Gestao`, convites ou equipe.
- A criacao de novos terapeutas deve acontecer pelo fluxo de convites em `Gerenciar membros`, nao mais pelo botao direto em `Terapeutas`.
- Whitelabels podem definir uma lista de modalidades/especialidades terapeuticas em `settings.therapistSpecialties`.
- `ADMIN_GLOBAL` pode assumir `legacy-default` pelo Backoffice para gerenciar dados antigos globais.
- Cadastro de paciente possui campos opcionais para nome do pai, nome da mae e link de localizacao da casa.
- Anamnese do prontuario possui campo de diagnostico sem quebrar anamneses antigas.
- Login por e-mail/senha possui recuperacao de senha com envio de link pelo Firebase Auth.
- A recuperacao de senha deve usar resposta generica para nao revelar se um e-mail existe na base de autenticacao.
- Login com Google deve tratar conflito de credencial sem criar conta duplicada nem substituir o cadastro original.
- O bloco `Ou continue com` / `Entrar com Google` aparece somente no modo de login, nao no modo de criacao de conta.

## Decisoes Para Seguir

- Whitelabel sera tratado como tenant de primeira classe, nao apenas como metadado visual ou cadastro de cliente.
- O isolamento sera aplicado nas regras/caminhos do Firestore e refletido nas APIs dos services.
- `ADMIN_GLOBAL` continua sendo o operador com visao entre whitelabels.
- `GESTOR`, `REPCAO` e `TERAPEUTA` passam a depender de associacao explicita a um ou mais whitelabels.
- A recomendacao inicial e usar subcolecoes por whitelabel para dados sensiveis, salvo se a migracao exigir uma etapa temporaria com campo `whitelabelId`.
- A interface deve continuar calma, clinica, densa e operacional conforme `DESIGN.md`.
- Metricas exibidas no painel devem vir dos dados carregados ou deixar claro que sao capacidade/estado atual; nao usar tendencias percentuais fixas como se fossem analiticas.
- Modais devem usar superficie, overlay, scroll interno e estados dark/light consistentes; inputs nao devem alternar visual escuro dentro de modal claro.

## Perguntas Em Aberto

- Um usuario comum pertence a exatamente um whitelabel ou um terapeuta pode atuar em varios whitelabels?
- Cada whitelabel tera apenas branding proprio ou tambem configuracoes de negocio, como unidades, tipos de agendamento, planos e listas de status?
- Modalidade do terapeuta sera um campo unico por membro neste momento ou futuramente podera aceitar multiplas modalidades por terapeuta?
- O provisionamento de usuarios sera feito somente dentro do app ou havera processo externo com Firebase Admin SDK?
- Os dados globais atuais serao migrados para um whitelabel padrao ou a nova estrutura pode comecar limpa?

## Proximas Validacoes

### Sprint 24 — migracao para whitelabels (CONCLUIDA em dados e codigo)

- Dados clinicos migrados das colecoes globais para `whitelabels/raiza-fisio` e `whitelabels/rafaela-fisio` por `npm.cmd run migrate:whitelabels -- --apply`. Praticas separadas, uma whitelabel por profissional.
- Copia, nao movimentacao: as colecoes globais continuam intactas como rede de seguranca. Backup em `backups/firestore-<timestamp>/` (fora do git).
- Dados de teste (`smdb.ti@gmail.com`, `default-therapist`) ficaram de proposito para tras.
- `AuthContext` deixou de usar `users/{uid}.roles`, o fallback de e-mail contendo `admin` e a membership virtual `legacy-default`. Papel agora vem so de custom claims e memberships — as duas fontes que `firestore.rules` reconhece.
- `assumeLegacyManagement` removido: mandava o ADMIN_GLOBAL para as colecoes globais, que as regras bloqueiam.
- PENDENTE: validar login de `raiza.fisio@gmail.com` e `rafaela.rafa.silveira@gmail.com` antes de publicar as regras. `admin@clinicdfu.local` passa a cair em "Acesso nao vinculado" — esperado, conta substituida por `smdb.ti@gmail.com`.
- PENDENTE: referencias penduradas migradas junto — `evolutions/6YpHcNkFg8iQraIfHTie` e `appointments/gPuHlXR4JSm6zfp3NvkT` apontam para o paciente `0rdq45xeNlM82FO1T7yI`, apagado antes da migracao.

### ADMIN_GLOBAL — bloqueador de publicacao das regras

- Nenhuma conta possui custom claim de admin hoje. `firestore.rules` so reconhece `ADMIN_GLOBAL` por claim, entao publicar as regras sem rodar `npm run admin:grant` deixa o projeto sem ninguem capaz de criar whitelabel. Ver `docs/ACESSO_ADMIN_GLOBAL.md`.
- Escalacao de privilegio pendente: `match /users/{userId}` permite que o proprio usuario grave `roles`, e o `AuthContext` confia nesse campo. Restringir `roles` a admin.
- Escalacao de privilegio pendente: fallback de e-mail contendo `admin` concede `ADMIN_GLOBAL` na UI. Remover apos existir admin com claim.

### Sprint 23 — modulo Captacao (bloqueadores antes de publicar)

- `leads` e a PRIMEIRA colecao do sistema a aceitar escrita sem autenticacao. Validar `isValidLeadCreate` no emulador antes de qualquer deploy de regras.
- Testar no emulador: anonimo cria lead valido; anonimo NAO le leads; anonimo nao cria com campo extra, string acima do limite ou `status` diferente de `NOVO`; `GESTOR` de outro whitelabel nao enxerga os leads.
- Firebase Storage NAO esta provisionado no projeto: `firebase deploy --only storage` falha com "Firebase Storage has not been set up". Ativar no console antes de publicar `storage.rules`. Ate la, o upload de imagens do site nao funciona.
- Publicar `storage.rules` junto com `firestore.rules` — o `firebase.json` passou a declarar Storage e um deploy parcial deixaria o bucket sem regra correspondente.
- `firestore.rules` compila sem erro no dry-run do CLI. Isso valida sintaxe, nao comportamento: os casos de `isValidLeadCreate`, `isValidLeadTriage` e `selfProfile*` continuam pendentes de teste no emulador.
- App Check: registrar as DUAS aplicacoes (backoffice e landing page) antes de ligar enforcement. Ligar enforcement sem registrar o backoffice derruba o app em producao.
- Criar o whitelabel da landing page e associar o responsavel como `GESTOR` antes de apontar o site.

- Seguir `docs/PLANO_PRODUCAO_ROLLBACK.md` antes de publicar as alteracoes em producao.
- Revisar visualmente dashboard, agenda e listas em larguras pequenas e grandes.
- Revisar visualmente Backoffice, criacao/edicao de whitelabel, membros e agendamento em mobile.
- Revisar visualmente gerenciamento de membros com convite, edicao de papeis e modalidade terapeutica em mobile.
- Testar localmente criacao/edicao de whitelabel com usuario `ADMIN_GLOBAL`.
- Testar localmente geracao e aceite de convite usando Firebase Emulator.
- Validar que usuario convidado nao visualiza pacientes, terapeutas ou agendamentos das colecoes globais antigas.
- Remover manualmente documentos antigos duplicados em `members/{email}` criados antes desta correcao, se ainda existirem no Firebase usado para testes.
- Criar dados locais em um whitelabel real para validar caminhos `whitelabels/{whitelabelId}/...`.
- Confirmar que conta antiga sem membership acessa somente `legacy-default`, enquanto conta convidada acessa somente whitelabel real.
- Confirmar que conta nova sem convite cria e acessa somente o workspace individual.
- Confirmar que `ADMIN_GLOBAL` acessa e retorna do ambiente legado pelo seletor de perfil.
- Nao publicar regras bloqueando colecoes globais antigas antes da migracao validada.
- Executar `npm run lint`.
- Executar `npm run test:local`.
- Executar `npm run build`.
