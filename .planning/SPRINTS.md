# Sprints De Implementacao

## Sprint 1: Fundacao De Whitelabel

Status: concluida em 22/05/2026.

### Objetivo

Criar a base de dominio para whitelabel sem alterar ainda todos os fluxos clinicos.

### Entregas

- Adicionar tipos `Whitelabel`, `WhitelabelStatus`, `WhitelabelMembership` e `TenantUser`.
- Criar helpers de permissao para `ADMIN_GLOBAL`, `GESTOR`, `REPCAO` e `TERAPEUTA`.
- Criar helpers de caminho para colecoes por whitelabel.
- Definir camada inicial de compatibilidade entre `clients` e `whitelabels`.
- Documentar a estrutura alvo do Firestore.

### Aceite

- Concluido: o codigo compila com os novos tipos.
- Concluido: nenhuma tela existente perdeu acesso por regressao nesta fatia.
- Concluido: o modelo de tenant ficou documentado em `docs/WHITELABEL_MODEL.md`.
- Concluido: `npm run lint` e `npm run build` passam.

## Sprint 2: Autenticacao, Perfil E Selecao De Whitelabel

Status: concluida em 22/05/2026 com fallback legado ate a migracao de dados.

### Objetivo

Substituir inferencia de papel por e-mail por um modelo explicito de perfil, papeis e whitelabel ativo.

### Entregas

- Atualizar `AuthContext` ou criar `TenantContext` para carregar perfil e associacoes.
- Persistir a escolha de papel e whitelabel ativo por usuario.
- Adicionar tela/estado de selecao de whitelabel quando houver mais de uma associacao.
- Ajustar navegacao para considerar papel e whitelabel ativo.
- Tratar estados de sem associacao, permissao negada e whitelabel suspenso.

### Aceite

- Concluido: usuario com um whitelabel ativo entra direto no produto.
- Concluido: usuario com multiplos whitelabels ativos escolhe o contexto antes de acessar dados.
- Concluido: `ADMIN_GLOBAL` continua acessando backoffice global.
- Concluido: o app consulta perfil, custom claims e memberships antes do fallback por e-mail legado.

## Sprint 3: Regras Do Firestore E Migracao

Status: concluida em 22/05/2026. Regras validadas com `firebase deploy --only firestore:rules,firestore:indexes --project clinic-dfu --dry-run`.

### Objetivo

Fazer o isolamento de dados existir no backend, nao apenas na interface.

### Entregas

- Adicionar `firestore.rules` ao repositorio.
- Criar regras para whitelabels, membros, pacientes, terapeutas, agendamentos, evolucoes e anamneses.
- Criar checklist ou script de migracao para um whitelabel padrao.
- Criar matriz de teste de seguranca para leitura/escrita permitida e negada.
- Definir indices necessarios para as consultas por whitelabel.

### Aceite

- Concluido: regras negam dados clinicos para usuario sem associacao.
- Concluido: regras bloqueiam leitura/escrita entre whitelabels diferentes.
- Concluido: `ADMIN_GLOBAL` tem operacoes globais previstas e compatibilidade temporaria com `clients`.
- Concluido: a migracao dos dados atuais tem caminho documentado e repetivel.

## Sprint 4: Services Com Escopo Por Whitelabel

Status: concluida em 22/05/2026 com fallback local `legacy-default` para colecoes globais ate a migracao.

### Objetivo

Refatorar os services para que todo acesso a dados operacionais receba contexto de whitelabel.

### Entregas

- Atualizar `patientService` para usar caminho/consulta por whitelabel.
- Atualizar `therapistService` para usar caminho/consulta por whitelabel.
- Atualizar `appointmentService` para conflitos, recorrencias e subscriptions por whitelabel.
- Atualizar `clinicalRecordService` para evolucoes e anamneses por whitelabel.
- Centralizar tratamento de erro e ordenacao comum onde fizer sentido.

### Aceite

- Concluido: services sensiveis aceitam `whitelabelId` e usam caminhos por tenant quando o whitelabel e real.
- Concluido: conflitos de agenda sao calculados dentro do escopo resolvido pelo service.
- Concluido: prontuarios sao lidos e gravados dentro do escopo resolvido pelo service.
- Concluido: `legacy-default` preserva compatibilidade local com colecoes globais ate a migracao.
- Concluido: `npm run lint` e `npm run build` passam.

## Sprint 5: Backoffice De Whitelabel

Status: concluida em 22/05/2026 com gestao de whitelabels e membros em ambiente local/desenvolvimento.

### Objetivo

Transformar o backoffice global em uma area real de administracao de whitelabels.

### Entregas

- Implementar criacao e edicao de whitelabel.
- Implementar suspensao/reativacao e arquivamento seguro.
- Adicionar detalhe de whitelabel com dados principais, dominio, plano, branding e status.
- Adicionar associacao de membros/terapeutas com papeis.
- Adicionar indicadores compactos de usuarios, terapeutas, pacientes e status.

### Aceite

- Concluido: `ADMIN_GLOBAL` possui tela operacional para gerenciar whitelabels.
- Concluido: a UI segue `DESIGN.md`, com tabela compacta e acoes objetivas.
- Concluido: suspender, reativar e arquivar exigem confirmacao.
- Concluido: estados de carregamento e vazio ficam visiveis.
- Concluido: membros podem ser associados ao caminho alvo `whitelabels/{whitelabelId}/members`.

## Sprint 6: Telas Clinicas Tenant-Aware

Status: concluida em 22/05/2026 com guard central de whitelabel ativo e direcionamento de admin global ao Backoffice.

### Objetivo

Aplicar o whitelabel ativo aos fluxos diarios do produto.

### Entregas

- Ajustar painel para dados do whitelabel ativo.
- Ajustar agenda para dados do whitelabel ativo e papel ativo.
- Ajustar pacientes para cadastro/lista/exclusao por whitelabel.
- Ajustar terapeutas para gestao por whitelabel.
- Ajustar prontuario para evolucoes e anamneses por whitelabel.
- Exibir contexto do whitelabel ativo no topo ou shell do app.

### Aceite

- Concluido: telas clinicas exigem whitelabel ativo para papeis de tenant.
- Concluido: trocar whitelabel troca o contexto usado pelos services tenant-aware.
- Concluido: terapeuta continua usando filtro por terapeuta dentro do whitelabel ativo.
- Concluido: admin global e direcionado ao Backoffice e nao abre telas clinicas por acidente.
- Concluido: estados de contexto ausente ficam explicitos.

## Sprint 7: Qualidade, Otimizacao E Hardening

Status: concluida em 22/05/2026 com documentacao operacional, checklist local e validacao de build.

### Objetivo

Fechar a entrega com limpeza tecnica, testes e verificacao de seguranca.

### Entregas

- Corrigir textos em portugues com problemas de codificacao nos arquivos tocados.
- Remover imports mortos e duplicacoes simples.
- Adicionar testes de helpers de permissao e caminhos por whitelabel.
- Executar matriz de seguranca entre whitelabels.
- Revisar consultas que precisam de indices ou paginacao.
- Avaliar code splitting para reduzir o aviso de chunk grande do build.

### Aceite

- Concluido: `npm run lint` passa.
- Concluido: `npm run build` passa.
- Concluido: checklist de seguranca fica documentada em `docs/WHITELABEL_SECURITY_MATRIX.md`.
- Concluido: guia operacional passo a passo fica documentado em `docs/GUIA_OPERACIONAL.md`.
- Concluido: nao ha deploy real; validacao permanece local antes de producao.

## Sprint 8: Testes Locais Do Backoffice E Emulator

Status: concluida em 22/05/2026 com correcao do erro de `undefined`, teste automatizado local e documentacao do fluxo seguro com Firebase Emulator.

### Objetivo

Corrigir a falha de criacao de whitelabel e preparar um caminho repetivel para testar fluxos de back-office sem afetar o Firebase real.

### Entregas

- Sanitizar payloads enviados ao Firestore para remover campos `undefined`.
- Aplicar a sanitizacao na criacao/edicao de whitelabel e no helper comum de services tenant-aware.
- Adicionar teste local para payloads criticos do Firestore.
- Habilitar configuracao opcional de Auth e Firestore Emulator por variaveis `VITE_*`.
- Adicionar scripts `firebase:emulators:start` e `dev:emulator` para reduzir erro operacional.
- Documentar passo a passo para teste local com Firebase Emulator.

### Aceite

- Concluido: criar whitelabel com Dominio, E-mail e Telefone vazios nao envia `undefined` ao Firestore.
- Concluido: services com `withTenantField` limpam `undefined` antes da escrita.
- Concluido: `npm run test:local` passa.
- Concluido: `npm run lint` passa.
- Concluido: `npm run build` passa.
- Concluido: nenhum deploy real foi executado.

## Sprint 9: Convite De Usuario Para Whitelabel

Status: concluida em 22/05/2026 com emissao de convite, ativacao por link e documentacao do fluxo.

### Objetivo

Permitir que o administrador convide um gestor, recepcao ou terapeuta sem criar senha manualmente no Firebase Console.

### Entregas

- Criar service de convites com token em `invites/{token}`.
- Ajustar modal de membros para gerar convite e copiar link.
- Criar tela publica de aceite de convite.
- Criar conta Firebase Auth com e-mail e senha durante o aceite.
- Ativar membro no whitelabel apos o aceite.
- Documentar fluxo operacional do convite.

### Aceite

- Concluido: admin gera convite pelo Backoffice.
- Concluido: convidado define senha pelo link.
- Concluido: aceite cria associacao ativa no whitelabel.
- Concluido: documentacao explica usuario novo e usuario que ja tem conta.
- Concluido: nenhum deploy real foi executado.

## Sprint 10: Isolamento De Dados E Convites Pelo Gestor

Status: concluida em 22/05/2026 com fallback legado restrito e gestao de convites liberada para gestores.

### Objetivo

Garantir que usuarios convidados vejam apenas dados da whitelabel ativa e permitir que gestores convidem terapeutas e recepcionistas.

### Entregas

- Restringir fallback legado para uso explicito de `legacy-default`.
- Bloquear acesso acidental a colecoes globais quando `whitelabelId` estiver ausente.
- Exibir `Gestao` para usuarios com papel `GESTOR`.
- Limitar a gestao do `GESTOR` ao whitelabel ativo.
- Permitir que `GESTOR` convide apenas `REPCAO` e `TERAPEUTA`.
- Reforcar regras do Firestore para impedir escalada de papel por convite ou membro.

### Aceite

- Concluido: paciente, terapeuta e agendamento usam somente o escopo da whitelabel ativa.
- Concluido: `GESTOR` nao visualiza lista global de whitelabels.
- Concluido: `GESTOR` nao cria, edita, suspende ou arquiva whitelabel.
- Concluido: `GESTOR` gera convite para `REPCAO` e `TERAPEUTA`.
- Concluido: regras compilam em dry-run sem deploy real.

## Sprint 11: Correcao Do Aceite De Convite

Status: concluida em 22/05/2026 com convite sem duplicacao, validacao do link e remocao do fallback indevido de papeis.

### Objetivo

Corrigir o fluxo de ativacao por link para criar apenas um membro definitivo e impedir que usuarios convidados caiam no modelo legado.

### Entregas

- Parar de criar membro pendente em `members/{email}` ao gerar convite.
- Criar o membro apenas no aceite, usando `members/{uid}`.
- Remover membro pendente antigo por e-mail durante o aceite, quando existir.
- Validar token, status, e-mail e senha na tela de ativacao.
- Ignorar memberships pendentes no login.
- Remover fallback automatico de `GESTOR` e `TERAPEUTA` para usuarios sem membership.

### Aceite

- Concluido: convite gera link, nao membro duplicado.
- Concluido: gestor convidado entra apenas como `GESTOR`.
- Concluido: usuario sem membership ativa nao acessa dados legados.
- Concluido: `npm run lint`, `npm run test:local` e `npm run build` passam.
- Concluido: regras compilam em dry-run sem deploy real.

## Sprint 12: Convite Pendente E Redirecionamento Pos-Aceite

Status: concluida em 22/05/2026 com registro pendente copiavel e tela de sucesso antes do login.

### Objetivo

Manter o convite visivel para copia posterior e impedir que o usuario recem-ativado caia em estado nao vinculado por sessao ainda nao recarregada.

### Entregas

- Criar `members/{email}` com status `PENDENTE` e `inviteUrl` ao gerar convite.
- Exibir membros pendentes na gestao de membros.
- Permitir copiar novamente o link salvo no membro pendente.
- Ao aceitar, criar `members/{uid}`, remover o pendente e marcar o convite como `ACEITO`.
- Exibir sucesso e redirecionar para login apos sair da sessao recem-criada.

### Aceite

- Concluido: convite pendente aparece na lista com link copiavel.
- Concluido: aceite mostra sucesso antes de ir ao login.
- Concluido: login apos aceite carrega membership ativo por UID.
- Concluido: lista nao mostra duplicidade quando existe membro ativo.
- Concluido: `npm run lint`, `npm run test:local`, `npm run build` e dry-run de regras passam.

## Sprint 13: Compatibilidade De Usuarios Antigos

Status: concluida em 22/05/2026 com fallback legado restaurado sem misturar com whitelabels reais.

### Objetivo

Permitir que usuarios antigos continuem acessando dados do modelo legado ate a migracao, sem interferir nos usuarios vinculados a whitelabels reais.

### Entregas

- Criar membership virtual `legacy-default` para usuarios sem membership real.
- Preservar acesso antigo a pacientes, terapeutas e agendamentos globais.
- Manter usuarios com membership real isolados na whitelabel ativa.
- Documentar regra de convivencia entre legado e whitelabel.

### Aceite

- Concluido: usuario antigo sem membership nao cai em `Acesso nao vinculado`.
- Concluido: usuario convidado com membership real nao usa `legacy-default`.
- Concluido: `npm run lint`, `npm run test:local` e `npm run build` passam.

## Sprint 14: Fallback De Cadastro Proprio Como Terapeuta

Status: concluida em 22/05/2026 com fallback sem escolha de perfil gestor.

### Objetivo

Garantir que usuarios cadastrados sem convite ou via Google entrem diretamente como `TERAPEUTA`.

### Entregas

- Remover `GESTOR` do fallback de usuarios sem membership real.
- Manter `ADMIN_GLOBAL` apenas para fallback local por e-mail contendo `admin`.
- Preservar convites e memberships reais como fonte de papel.

### Aceite

- Concluido: usuario sem convite entra como `TERAPEUTA`.
- Concluido: usuario sem convite nao ve selecao entre `GESTOR` e `TERAPEUTA`.
- Concluido: gestor continua dependendo de convite/membership.
- Concluido: `npm run lint`, `npm run test:local` e `npm run build` passam.

## Sprint 15: Workspace Individual Para Terapeuta Autonomo

Status: concluida em 22/05/2026 com provisionamento automatico para novas contas sem convite.

### Objetivo

Criar um ambiente individual isolado para terapeutas que se cadastram sozinhos ou entram com Google sem convite.

### Entregas

- Detectar conta nova sem membership real.
- Criar whitelabel `individual_{uid}` com `workspaceType: INDIVIDUAL` e `plan: Individual`.
- Criar membership `TERAPEUTA` para o proprio usuario.
- Criar registro de terapeuta dentro da whitelabel individual.
- Criar/atualizar `users/{uid}` com `provisioningMode: PERSONAL_WORKSPACE`.
- Manter contas antigas sem membership no `legacy-default`.
- Ajustar regras do Firestore para permitir somente o proprio workspace individual.

### Aceite

- Concluido: nova conta sem convite nao usa mais `legacy-default`.
- Concluido: nova conta sem convite acessa apenas dados em `whitelabels/individual_{uid}/...`.
- Concluido: nova conta sem convite tem apenas papel `TERAPEUTA`.
- Concluido: workspace individual nao libera gestao de clinica/equipe.
- Concluido: contas antigas sem membership continuam no legado.
- Concluido: `npm run lint`, `npm run test:local`, `npm run build` e dry-run de regras passam.

## Sprint 16: Gestao Do Ambiente Legado No Backoffice

Status: concluida em 22/05/2026 com acesso operacional temporario ao `legacy-default`.

### Objetivo

Permitir que `ADMIN_GLOBAL` gerencie dados antigos do modelo legado sem misturar com whitelabels novas.

### Entregas

- Exibir `Clinic DFU - Legado` como linha virtual no Backoffice.
- Adicionar acao para assumir `legacy-default` como contexto operacional.
- Trocar temporariamente o papel ativo para `GESTOR` mantendo `ADMIN_GLOBAL` disponivel.
- Permitir retorno ao Backoffice global via `Trocar Perfil`.
- Documentar passo a passo de acesso ao ambiente legado.

### Aceite

- Concluido: `ADMIN_GLOBAL` visualiza `Clinic DFU - Legado`.
- Concluido: acao de entrada abre pacientes, terapeutas e agenda antigos.
- Concluido: whitelabels novas e workspaces individuais continuam isolados.
- Concluido: documentacao detalhada criada em `docs/ACESSO_AMBIENTE_LEGADO.md`.

## Sprint 17: Campos Clinicos Do Paciente E Diagnostico Na Anamnese

Status: concluida em 22/05/2026.

### Objetivo

Melhorar o cadastro de paciente e o prontuario para registrar informacoes familiares, localizacao domiciliar e diagnostico clinico.

### Entregas

- Adicionar campos opcionais `fatherName`, `motherName` e `homeLocationUrl` ao paciente.
- Exibir os novos campos no formulario de cadastro/edicao de paciente.
- Validar link de localizacao quando preenchido.
- Exibir dados familiares e link de localizacao no cabecalho do prontuario.
- Adicionar campo `diagnosis` na anamnese.
- Salvar e recarregar anamnese com diagnostico sem quebrar registros antigos.
- Atualizar documentacao operacional.

### Aceite

- Concluido: cadastro de paciente salva normalmente sem preencher campos opcionais.
- Concluido: cadastro de paciente salva pai, mae e link de localizacao quando preenchidos.
- Concluido: prontuario exibe pai, mae e link de localizacao somente quando existirem.
- Concluido: anamnese salva e recarrega diagnostico.
- Concluido: `npm run lint`, `npm run test:local` e `npm run build` passam.

## Sprint 18: Ajustes De Login E Criacao De Conta

Status: concluida em 22/05/2026.

### Objetivo

Tornar o fluxo de entrada mais claro para usuarios que usam e-mail/senha ou Google, sem misturar as acoes de login e criacao de conta.

### Entregas

- Implementar `Esqueceu a senha?` usando recuperacao do Firebase Auth.
- Exigir e-mail preenchido antes de enviar recuperacao de senha.
- Exibir mensagem de sucesso quando o link de recuperacao for enviado.
- Manter o separador `Ou continue com` seguido apenas de `Entrar com Google`.
- Ocultar o bloco de Google quando o usuario estiver no modo `Criar conta`.
- Limpar mensagens de erro/sucesso ao alternar entre login e criacao de conta.

### Aceite

- Concluido: recuperacao de senha usa o e-mail informado e orienta quando ele esta vazio.
- Concluido: tela de login exibe `Ou continue com` e `Entrar com Google`.
- Concluido: tela de criacao de conta nao exibe `Entrar com Google`.
- Concluido: `npm run lint`, `npm run test:local` e `npm run build` passam.

## Ordem Recomendada

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 4
5. Sprint 5
6. Sprint 6
7. Sprint 7
8. Sprint 8
9. Sprint 9
10. Sprint 10
11. Sprint 11
12. Sprint 12
13. Sprint 13
14. Sprint 14
15. Sprint 15
16. Sprint 16
17. Sprint 17
18. Sprint 18

## Primeira Fatia Executavel

Comecar pela Sprint 1 criando tipos, helpers e documentacao do modelo de dados. Essa fatia e pequena o suficiente para validar a direcao sem quebrar as telas existentes.
