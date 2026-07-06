# Roteiro

## Fase 0: Confirmacao Da Arquitetura

- Confirmar se terapeutas podem pertencer a multiplos whitelabels.
- Confirmar estrategia de migracao dos dados globais atuais.
- Escolher o modelo do Firestore:
  - Recomendado: `whitelabels/{whitelabelId}/{patients|therapists|appointments|evolutions|anamneses}` para dados pertencentes ao tenant.
  - Alternativa: manter colecoes globais com campo obrigatorio `whitelabelId` e regras rigidas durante a migracao.
- Definir o modelo de associacao, por exemplo `users/{uid}` somado a `whitelabels/{whitelabelId}/members/{uid}`.

## Fase 1: Base De Tenant E Autenticacao

- Adicionar tipos de primeira classe para `Whitelabel`, `WhitelabelMembership` e estado de usuario com escopo por tenant.
- Substituir inferencia de papel por e-mail por carregamento de perfil/associacoes no Firestore.
- Adicionar selecao de whitelabel ativo para usuarios com multiplas associacoes.
- Criar helpers compartilhados para caminhos de colecoes com escopo por whitelabel.
- Criar helpers de permissao usados pela navegacao e pelas telas.
- Criar tela publica dedicada para recuperacao de senha por e-mail via Firebase Auth, com mensagem segura sem enumeracao de contas.

## Fase 2: Regras De Seguranca E Migracao

- Adicionar regras do Firestore ao controle de versao.
- Separar acesso de admin global e acesso de membro de tenant.
- Adicionar regras para pacientes, terapeutas, agendamentos, evolucoes e anamneses.
- Criar script unico de migracao ou checklist manual para mover dados globais para um whitelabel padrao.
- Verificar leituras/escritas negadas entre whitelabels por testes com emulator ou matriz manual documentada.

## Fase 3: Refatoracao Dos Services

- Atualizar `patientService`, `therapistService`, `appointmentService` e `clinicalRecordService` para exigir contexto de whitelabel.
- Aplicar escopo por whitelabel em conflitos de agenda, exclusao de recorrencia, listas de terapeutas, listas de pacientes e consultas de prontuario.
- Manter APIs dos services estreitas, recebendo dados de dominio em vez de nomes brutos de colecoes.
- Padronizar comportamento de carregamento e erro em subscriptions em tempo real.

## Fase 4: Interface Administrativa De Whitelabel

- Expandir `BackofficeView` para virar uma area de administracao de whitelabels.
- Implementar fluxos de criar, editar, suspender e arquivar whitelabels.
- Adicionar tela ou modal de detalhes para configuracoes, dominios, branding, plano e flags de funcionalidade.
- Adicionar gerenciamento de membros para associar usuarios/terapeutas a papeis.
- Adicionar configuracao de modalidades terapeuticas por whitelabel e permitir aplicar modalidade no convite ou na edicao do membro.
- Adicionar ferramentas de associacao ou transferencia de pacientes com confirmacao explicita ao mover dados entre whitelabels.

## Fase 5: Telas Do Produto Com Escopo Por Whitelabel

- Exibir o whitelabel ativo no shell do app para usuarios de tenant.
- Aplicar escopo por whitelabel no painel, agenda, pacientes, terapeutas e prontuario.
- Adicionar estados para nenhum whitelabel ativo, whitelabel suspenso e permissao negada.
- Manter a UI densa, clinica e operacional conforme `DESIGN.md`.

## Fase 6: Qualidade, Otimizacao E Hardening

- Corrigir codificacao dos textos em portugues nos arquivos tocados.
- Remover imports nao utilizados e duplicacoes de ordenacao/subscription.
- Adicionar testes para helpers de permissao, helpers de caminho por tenant e comportamentos criticos dos services.
- Adicionar verificacoes com Firebase Emulator ou uma checklist repetivel de seguranca.
- Sanitizar payloads do Firestore para evitar campos `undefined` em cadastros com campos opcionais.
- Documentar modo local com Firebase Emulator para testes de back-office sem escrita no projeto real.
- Executar `npm run lint`.
- Executar `npm run test:local`.
- Executar `npm run build`.

## Fase 7: Sprint UX/UI Responsiva

- Remover tendencias estaticas do dashboard e substituir por subtextos derivados de dados reais.
- Nomear capacidade diaria/semanal usada em metricas de agenda.
- Revisar responsividade de shell, topbar, cards de estatistica, tabelas e agenda.
- Garantir que botoes e acoes principais nao dependam apenas de hover em dispositivos touch.
- Executar `npm run lint`.
- Executar `npm run build`.

## Melhorias Candidatas Para Depois

- Permitir multiplas modalidades por terapeuta se o modelo clinico exigir atuação interdisciplinar.
- Adicionar trilha de auditoria para acoes de admin global e gestao de tenant.
- Usar exclusao logica/arquivamento em entidades clinicas em vez de exclusao direta.
- Adicionar paginacao ou consultas por intervalo de data para tenants com muitos dados.
- Adicionar feature flags por whitelabel para tipos de agendamento, branding e modulos.
- Adicionar observabilidade para erros de permissao e falhas de subscription no Firestore.
