# Pacientes compartilhados entre whitelabels e pacotes por terapeuta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O gestor compartilha pacientes entre whitelabels liberados pelo admin; os dois lados veem o paciente, agendam, registram evolução num prontuário único; pacote passa a ser de um terapeuta.

**Architecture:** Paciente e prontuário (`evolutions`, `anamneses`) ficam no whitelabel de origem; o paciente leva `sharedWith` (até 3 ids). O destino lê e grava lá por regras que checam posições fixas de `sharedWith`. Agendamentos e pacotes ficam no whitelabel de quem atende; o agendamento tem a tag `sharedToWhitelabels` para aparecer, só leitura, na agenda de outro whitelabel. O admin libera destinos em `whitelabelLinks/{origem}`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind v4, Firebase (Firestore rules, cópias-índice `sharedPatients` e `sharedAppointments` no destino), tsx para testes, `@firebase/rules-unit-testing` para regras.

**Spec:** `docs/superpowers/specs/2026-11-17-pacientes-compartilhados-design.md`

## Global Constraints

- Máximo de 3 whitelabels em `sharedWith` e em `sharedToWhitelabels`.
- `sharedWith` só muda por gestor da origem ou admin global, e só com ids presentes em `whitelabelLinks/{origem}.targetIds`.
- `sharedToWhitelabels` do agendamento só com ids contidos em `sharedWith` do paciente (validado pelas regras e pela interface).
- Bloco compartilhado na agenda do destino é somente leitura e não entra em conflito de horário, Meu dia, evolução pendente, contagem de pacote nem Painel.
- Botão "Compartilhar" não aparece sem destino liberado.
- Tag do agendamento começa desligada.
- Pacote sem `therapistId` (antigo) serve a qualquer terapeuta do whitelabel.
- Texto da interface em português do Brasil com acentos; `REPCAO` continua com esse nome (é recepção).
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Push só com o OK do usuário.
- Verificação padrão: `npm run lint`, `npm run build`, `npm run test:local`, `npm run test:rules`.

## Review Focus

- Gestor de um whitelabel tenta gravar `sharedWith` com id não liberado pelo admin: regra nega.
- Terapeuta ou recepção tenta alterar `sharedWith`: regra nega.
- Whitelabel não listado em `sharedWith` tenta ler paciente, evolução ou anamnese: regra nega.
- A coleção raiz legada `/patients` continua negada (cenário no teste de regras).
- Remover um whitelabel de `sharedWith` ou de `whitelabelLinks` com agendamentos e pacotes já criados no destino: nada quebra, o paciente só some da lista do destino e os blocos compartilhados somem da agenda.

---

### Task 1: Tipos e funções puras

**Files:**
- Modify: `src/types.ts` (Patient, Appointment, Package; novo `WhitelabelLinks`)
- Create: `src/lib/sharing.ts`
- Test: `scripts/test-firestore-payloads.ts`

**Interfaces:**
- Produces (tipos): `Patient.sharedWith?: string[]`; `Appointment.patientWhitelabelId?: string`; `Appointment.sharedToWhitelabels?: string[]`; `Package.therapistId?: string`, `Package.therapistName?: string`, `Package.patientWhitelabelId?: string`; `interface WhitelabelLinks { targetIds: string[]; targets: { id: string; name: string; slug: string }[] }`.
- Produces (`sharing.ts`):
  - `MAX_SHARED_WHITELABELS = 3`
  - `isForeignPatient(patient: Pick<Patient,'whitelabelId'>, activeWhitelabelId: string): boolean` — `true` quando `patient.whitelabelId` existe e difere do ativo.
  - `patientOwnerWhitelabel(patient, activeWhitelabelId): string` — `patient.whitelabelId ?? activeWhitelabelId`.
  - `isExternalAppointment(a: Pick<Appointment,'whitelabelId'>, activeWhitelabelId: string): boolean`
  - `splitAppointments<T extends Pick<Appointment,'whitelabelId'>>(list: T[], activeWhitelabelId: string): { own: T[]; external: T[] }`
  - `packagesForTherapist<T extends Pick<Package,'therapistId'>>(packages: T[], therapistId: string): T[]` — pacotes do terapeuta mais os sem `therapistId`.
  - `allowedShareTargets(links: WhitelabelLinks | null, patient: Pick<Patient,'sharedWith'>): { id; name; slug }[]` — destinos liberados (`links.targets`).
  - `clampShareTargets(requested: string[], allowedIds: string[]): string[]` — mantém só ids permitidos, sem repetir, no máximo `MAX_SHARED_WHITELABELS`.

- [ ] **Step 1: Write the failing tests** em `scripts/test-firestore-payloads.ts`, no estilo dos asserts existentes: `isForeignPatient` com e sem `whitelabelId`; `splitAppointments` separando por `whitelabelId`; `packagesForTherapist` mantendo o pacote do terapeuta e o sem `therapistId` e removendo o de outro terapeuta; `clampShareTargets(['a','b','a','x','c','d'], ['a','b','c','d'])` devolve `['a','b','c']`; `clampShareTargets([], …)` devolve `[]`.
- [ ] **Step 2: Run** `npm run test:local`. Expected: FAIL com módulo `../src/lib/sharing` inexistente.
- [ ] **Step 3: Implement** tipos e `src/lib/sharing.ts` com as assinaturas acima.
- [ ] **Step 4: Run** `npm run test:local && npm run lint`. Expected: PASS, tsc sem erro.
- [ ] **Step 5: Commit** `git add src/types.ts src/lib/sharing.ts scripts/test-firestore-payloads.ts` — "Tipos e funcoes de compartilhamento de pacientes".

---

### Task 2: Regras, índices e testes de regras

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`, `package.json`
- Create: `scripts/test-firestore-rules.ts`

**Interfaces:**
- Consumes: campos da Task 1.
- Produces (regras, em `firestore.rules`):
  - `function linkedTargets(whitelabelId)` — lê `/databases/$(database)/documents/whitelabelLinks/$(whitelabelId)`; devolve `targetIds`, ou lista vazia se o documento não existe.
  - `function sharedPosActive(list, i)` — `list.size() > i && isActiveMember(list[i])`.
  - `function sharedWithMe(list)` — `list is list && (sharedPosActive(list,0) || sharedPosActive(list,1) || sharedPosActive(list,2))`.
  - `function validSharedWith(whitelabelId, list)` — lista de strings, tamanho ≤ 3, `list.hasOnly(linkedTargets(whitelabelId))`.
  - `match /whitelabelLinks/{whitelabelId}`: leitura admin global ou membro ativo de `whitelabelId`; escrita só admin global.
  - `patients`: leitura também quando `sharedWithMe(resource.data.sharedWith)`; criação e atualização só aceitam `sharedWith` ausente/igual ao existente ou, se mudou, só por gestor/admin com `validSharedWith`. Atualização por membro do destino: negada.
  - `evolutions` e `anamneses`: leitura/criação/atualização/exclusão (evolução) também quando `sharedWithMe(get(.../patients/$(patientId)).data.sharedWith)` e o usuário é gestor ou terapeuta do whitelabel que o liga (checado com `isGestor/isTerapeuta` dos 3 candidatos de `sharedWith`; função `sharedRoleMe(list, roles)`).
  - `appointments`: leitura também quando `sharedWithMe(resource.data.sharedToWhitelabels)`; escrita de `sharedToWhitelabels` exige lista de strings, tamanho ≤ 3, e `sharedToWhitelabels.hasOnly(get(.../whitelabels/$(patientWhitelabelId)/patients/$(patientId)).data.sharedWith)` (só quando `sharedToWhitelabels` não está vazia).
  - Cópias-índice (decisão após teste no emulador: consulta entre whitelabels não é provável pelas regras): `whitelabels/{destino}/sharedPatients/{origem}__{pacienteId}` (leitura de membro ativo do destino; gravação só por gestor da origem quando `destino in getAfter(paciente).sharedWith`) e `whitelabels/{destino}/sharedAppointments/{origem}__{agendamentoId}` (gravação por gestor, recepção ou terapeuta da origem quando `destino in getAfter(agendamento).sharedToWhitelabels`). A leitura direta de agendamento por outro whitelabel não existe.
- Produces (script): `npm run test:rules` = `firebase emulators:exec --only firestore "tsx scripts/test-firestore-rules.ts"`.

- [ ] **Step 1: Instalar** `@firebase/rules-unit-testing` como devDependency e adicionar o script `test:rules` ao `package.json`.
- [ ] **Step 2: Write the failing tests** em `scripts/test-firestore-rules.ts` usando `initializeTestEnvironment` com o conteúdo de `firestore.rules`. Cenários (cada um um `assertSucceeds`/`assertFails` com nome claro): (a) gestor da origem grava `sharedWith:['B']` com `whitelabelLinks/A.targetIds=['B']` → sucesso; (b) mesmo com `targetIds=[]` → falha; (c) terapeuta/recepção da origem altera `sharedWith` → falha; (d) membro de B lê paciente de A com `sharedWith:['B']` → sucesso; membro de C → falha; (e) membro de B (gestor e terapeuta) lê e grava evolução do paciente compartilhado → sucesso; membro de C → falha; recepção de B lê evolução → falha; (f) a tag só passa com whitelabels de `sharedWith`; (g) cópias-índice gravadas só por quem pode, lidas só por membros do destino, e a raiz legada `/patients/x` continua negada; (h) `sharedWith` com 4 ids → falha; (i) gestor de B tenta alterar o cadastro do paciente de A → falha; (j) criar pacote com `therapistId` continua aceito; (k) agendamento com `sharedToWhitelabels:['C']` para paciente cujo `sharedWith` é `['B']` → falha.
- [ ] **Step 3: Run** `npm run test:rules`. Expected: FAIL nos cenários de compartilhamento (regras ainda não existem).
- [ ] **Step 4: Implement** as regras (sem índices novos). Atualizar `isValidPackageCreate` só se o cenário (j) falhar.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: todos os cenários PASS.
- [ ] **Step 6: Dry-run** `firebase deploy --only firestore:rules,firestore:indexes --project clinic-dfu --dry-run`. Expected: compila sem erro.
- [ ] **Step 7: Commit** — "Regras de compartilhamento de pacientes entre whitelabels".

---

### Task 3: Serviços

**Files:**
- Modify: `src/lib/tenantPaths.ts`, `src/services/patientService.ts`, `src/services/appointmentService.ts`, `src/services/packageService.ts`
- Create: `src/services/whitelabelLinksService.ts`

**Interfaces:**
- Consumes: tipos da Task 1; regras da Task 2.
- Produces:
  - `ROOT_COLLECTIONS.whitelabelLinks = 'whitelabelLinks'`.
  - `whitelabelLinksService.subscribe(whitelabelId, cb: (links: WhitelabelLinks | null) => void): Unsubscribe`
  - `whitelabelLinksService.save(whitelabelId, targets: { id; name; slug }[]): Promise<void>` — grava `targetIds` e `targets`.
  - `patientService.setSharedWith(patientIds: string[], sharedWith: string[], whitelabelId, actor: { uid: string; email: string }): Promise<void>` — atualiza `sharedWith` de cada paciente e cria um `auditLogs` com ação `PACIENTE_COMPARTILHADO`, paciente, origem e destinos.
  - `patientService.subscribeToSharedPatients(whitelabelId, cb: (patients: Patient[]) => void): Unsubscribe` — lê `sharedPatients` do whitelabel; devolve `Patient` com `id = patientId` e `whitelabelId = ownerWhitelabelId`.
  - `patientService.syncSharedCopies(patient: Patient, whitelabelId): Promise<void>` — mantém as cópias em dia (usado em `setSharedWith` e em `updatePatient` quando o paciente tem `sharedWith`); remove cópia de destino que saiu da lista.
  - `appointmentService.subscribeToSharedAppointments(whitelabelId, cb: (appointments: Appointment[]) => void): Unsubscribe` — lê `sharedAppointments`; devolve `Appointment` com `id = appointmentId` e `whitelabelId = sourceWhitelabelId`.
  - `appointmentService.syncSharedCopies(appointment: Appointment & { id: string }, whitelabelId): Promise<void>` — grava/atualiza a cópia em cada destino da tag e remove de quem saiu; `createAppointment`, `updateAppointment`, `deleteAppointment` e `deleteRecurrence` chamam essa sincronização.
  - `packageService.createPackage(data: { patientId; totalSessions; createdBy; therapistId?; therapistName?; patientWhitelabelId? }, whitelabelId)`.
- `checkConflict` não muda: só consulta a coleção do whitelabel ativo, então os blocos compartilhados nunca geram conflito.

- [ ] **Step 1: Write the failing test** para um montador puro `buildSharedWithAudit(patientId, origem, destinos, actor)` em `src/lib/sharing.ts` (campos exatos do log) em `scripts/test-firestore-payloads.ts`; run `npm run test:local`; Expected: FAIL.
- [ ] **Step 2: Implement** `buildSharedWithAudit` e os serviços acima; novas funções seguem o padrão de `console.error` + `callback([])` dos serviços atuais.
- [ ] **Step 3: Run** `npm run test:local && npm run lint`. Expected: PASS.
- [ ] **Step 4: Commit** — "Servicos de compartilhamento de pacientes e vinculos".

---

### Task 4: Admin libera destinos

**Files:**
- Create: `src/components/WhitelabelLinksModal.tsx`
- Modify: `src/views/BackofficeView.tsx`

**Interfaces:**
- Consumes: `whitelabelLinksService`, `whitelabelService.subscribeToWhitelabels`.
- Produces: `WhitelabelLinksModal({ isOpen, onClose, whitelabel }: { isOpen: boolean; onClose: () => void; whitelabel?: Whitelabel })` — lista de caixas de seleção dos outros whitelabels (sem o próprio e sem o legado), salvando via `whitelabelLinksService.save`.

- [ ] **Step 1: Implement** o modal no padrão visual de `WhitelabelMembersModal` (azul `primary`, `rounded-xl`). Botão "Compartilhamento" no cartão do whitelabel, visível só para `ADMIN_GLOBAL`. Aviso fixo no modal: "Remover um destino não desfaz compartilhamentos já feitos; o gestor precisa descompartilhar."
- [ ] **Step 2: Verify** `npm run lint && npm run build`. Expected: sem erro.
- [ ] **Step 3: Commit** — "Admin libera destinos de compartilhamento por whitelabel".

---

### Task 5: Pacientes — compartilhar, listar e abrir

**Files:**
- Create: `src/components/SharePatientsModal.tsx`
- Modify: `src/views/PatientListView.tsx`, `src/views/ClinicalRecordView.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `sharing.ts`, `patientService.setSharedWith/subscribeToSharedPatients`, `whitelabelLinksService.subscribe`.
- Produces: `SharePatientsModal({ isOpen, onClose, patients, targets, onConfirm }: { …; onConfirm: (patientIds: string[], targetIds: string[]) => Promise<void> })` — seleção de pacientes e de destinos, até 3 destinos, resumo antes de confirmar.

- [ ] **Step 1: Implement** em `PatientListView`: botão "Compartilhar" só para gestor/admin **e** com `links.targets.length > 0`; lista mescla `own` com `subscribeToSharedPatients` (sem duplicar por `id`+`whitelabelId`); badge "Compartilhado com N" na origem e "Compartilhado" no destino; paciente de outro whitelabel sem editar, excluir nem atribuir terapeuta; descompartilhar a partir do mesmo modal (desmarcar destino).
- [ ] **Step 2: Implement** `ClinicalRecordView`: `ownerWl = patientOwnerWhitelabel(patient, activeWl)` usado em `subscribeToEvolutions`, `subscribeToAnamnese`, `createEvolution`, `updateEvolution`, `deleteEvolution` e `saveAnamnese`; agendamentos, pacotes e vínculo de evolução ao agendamento continuam no whitelabel ativo. Mostrar o selo da origem no cabeçalho.
- [ ] **Step 3: Implement** em `App.tsx` o repasse do paciente de outro whitelabel (já carrega `whitelabelId`).
- [ ] **Step 4: Verify** `npm run lint && npm run build`. Expected: sem erro.
- [ ] **Step 5: Commit** — "Compartilhar pacientes entre whitelabels e abrir prontuario da origem".

---

### Task 6: Agenda — tag de visibilidade e blocos externos

**Files:**
- Modify: `src/components/AppointmentFormModal.tsx`, `src/views/AgendaView.tsx`, `src/components/DayAppointmentsList.tsx`, `src/views/DashboardView.tsx`

**Interfaces:**
- Consumes: `sharing.ts`, `appointmentService.subscribeToSharedAppointments`, `patientService.subscribeToSharedPatients`.
- Produces: no formulário, quando o paciente é compartilhado, grupo de caixas "Mostrar na agenda de:" (padrão todas desmarcadas) gravando `sharedToWhitelabels` e `patientWhitelabelId`; o seletor de pacientes inclui os compartilhados.

- [ ] **Step 1: Implement** o grupo de caixas e a gravação dos dois campos; para paciente próprio, `sharedToWhitelabels` não é gravado.
- [ ] **Step 2: Implement** `AgendaView` e `DayAppointmentsList`: unir `own` com `external` (via `subscribeToSharedAppointments` + `splitAppointments`) só para exibição; bloco externo com selo do whitelabel de origem, cor neutra, sem clique para editar ou excluir, sem botão de evolução.
- [ ] **Step 3: Implement** `DashboardView` e `MyDayCard`: usar apenas `own`; Painel, evolução pendente, "Meu dia" e pacotes nunca recebem `external`.
- [ ] **Step 4: Verify** `npm run lint && npm run build && npm run test:local`. Expected: PASS.
- [ ] **Step 5: Commit** — "Tag de visibilidade em agendamentos de pacientes compartilhados".

---

### Task 7: Pacote por terapeuta

**Files:**
- Modify: `src/components/PatientPackagesCard.tsx`, `src/components/AppointmentFormModal.tsx`, `src/components/PackagesOverviewCard.tsx`, `src/lib/packageProgress.ts`
- Test: `scripts/test-firestore-payloads.ts`

**Interfaces:**
- Consumes: `packagesForTherapist` (Task 1), `createPackage` com `therapistId` (Task 3).
- Produces: `packageOverview` passa a preferir `pkg.therapistName`/`pkg.therapistId` ao terapeuta do paciente (fallback para o paciente e depois "Sem terapeuta").

- [ ] **Step 1: Write the failing test** em `scripts/test-firestore-payloads.ts`: dois pacotes do mesmo paciente com terapeutas diferentes geram duas linhas com terapeutas diferentes em `packageOverview`; pacote antigo sem `therapistId` mantém o terapeuta do paciente. Run `npm run test:local`; Expected: FAIL.
- [ ] **Step 2: Implement** `packageOverview` com a preferência acima; run `npm run test:local`; Expected: PASS.
- [ ] **Step 3: Implement** `PatientPackagesCard`: terapeuta cria pacote para si; gestor e recepção escolhem o terapeuta; o cartão mostra o terapeuta do pacote.
- [ ] **Step 4: Implement** `AppointmentFormModal`: opções e vínculo automático usam `packagesForTherapist(patientPackages, formData.therapistId)`; ao trocar o terapeuta, a opção de pacote reavalia e o vínculo automático roda de novo para o novo terapeuta (zerando o guard por paciente).
- [ ] **Step 5: Verify** `npm run lint && npm run build && npm run test:local`. Expected: PASS.
- [ ] **Step 6: Commit** — "Pacote de atendimento passa a ser de um terapeuta".

---

### Task 8: Publicação e documentação

**Files:**
- Modify: `docs/` (nota curta de operação, se existir seção de regras)

- [ ] **Step 1: Run** `npm run lint && npm run build && npm run test:local && npm run test:rules`. Expected: tudo PASS.
- [ ] **Step 2: Pedir OK ao usuário**, depois `firebase deploy --only firestore:rules --project clinic-dfu` (sem índices novos).
- [ ] **Step 3: Push** com OK do usuário.
- [ ] **Step 4: Verificar no navegador** (conta do usuário logada): admin libera `raiza-fisio` ↔ `rafaela-fisio`; gestor compartilha um paciente; o outro lado vê, agenda com a tag ligada e desligada, registra evolução; pacote de dois terapeutas separado.
