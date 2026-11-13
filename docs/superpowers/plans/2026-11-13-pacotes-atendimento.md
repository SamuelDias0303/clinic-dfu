# Pacotes de atendimento e revisão de texto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir pacotes de sessões por paciente com contagem das sessões concluídas, e corrigir a ortografia (acentos e til) de todo texto visível do backoffice.

**Architecture:** Pacote guarda só o total; "usadas" é calculado pelos agendamentos `CONCLUÍDO` com o mesmo `packageId` (helper puro, testável). Coleção nova `whitelabels/{id}/packages` com regras próprias. Revisão de texto manual, antes dos pacotes, em commit separado.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind v4, Firebase (Firestore), `tsx` para o teste local.

**Spec:** `docs/superpowers/specs/2026-11-13-pacotes-atendimento-design.md`

## Global Constraints

- Pacote sem valor, preço, pagamento, validade ou nome. Campos: `patientId`, `totalSessions` (inteiro 1..200), `status` (`'ATIVO' | 'ENCERRADO'`), `createdBy` (email), `createdAt`, `whitelabelId`.
- Só `CONCLUÍDO` conta como sessão usada; `CANCELADO`, `EM ANDAMENTO` e `AGUARDANDO` não.
- Pacote completo (usadas >= total) é derivado na tela; nunca se grava `ENCERRADO` automaticamente.
- Agendar além do total só avisa; nunca bloqueia.
- Sem tela nova no menu. Pacote aparece no prontuário e no formulário de agendamento.
- Revisão de texto: só o que o usuário vê. NÃO alterar valores gravados ou comparados nas regras (`'Ativo'`/`'Inativo'`, papéis como `REPCAO`, status de lead, `preocupacoes`, `Outro motivo`, `bebeIdadeFaixa`, `papel`, especialidades), chaves de Firestore/`localStorage`, `console.*`, nomes de código, `docs/*.md`, landing page.
- Verificação final de cada tarefa: `npm run lint` e `npm run build` limpos (AGENTS.md).
- Commits em português, como no histórico; terminam com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Trabalhar em `C:\trabalho\codigo-fonte\clinic-dfu`, branch `main`.

## Review Focus

- Terapeuta consulta agendamentos: a regra só libera leitura dos próprios (`therapistId`); consulta por `patientId` sem filtro de terapeuta seria negada. Esperado: a contagem do terapeuta usa só os agendamentos dele e nada quebra com `permission-denied`.
- Série recorrente maior que o saldo (até 12 ocorrências para 10 sessões). Esperado: aviso, sem bloqueio.
- Trocar o paciente no formulário com um pacote selecionado. Esperado: o pacote é limpo.
- Reabrir ou cancelar uma sessão `CONCLUÍDO`. Esperado: a contagem diminui sozinha.
- Trocar texto de valor gravado por "texto corrigido" (ex.: `Ativo`, `REPCAO`). Esperado: continua exatamente igual.

---

### Task 1: Revisão de ortografia do backoffice

**Files:**
- Modify (candidatos, confirmar por varredura): `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/views/{LoginView,PasswordRecoveryView,ProfileSelectionView,InviteAcceptanceView,BackofficeView,CaptacaoView,ClinicalRecordView,PatientListView,AgendaView,DashboardView,TherapistListView,AiResourcesView,WhitelabelSelectionView}.tsx`, `src/components/*.tsx`, `src/services/*.ts` (mensagens de erro exibidas via `alert`/`error.message`).

**Interfaces:**
- Consumes: nada.
- Produces: nada além de textos corrigidos; nenhum nome de código muda.

- [ ] **Step 1: Levantar candidatos.** Rodar `grep -rnE "[A-Za-z]+(cao|coes|sao|ao|ario|encia|avel|ico|ica)\b" src --include=*.tsx --include=*.ts` e listar, por arquivo, cada texto visível sem acento (JSX, `label`, `placeholder`, `title`, `alert(`, `confirm(`, `new Error(` mostrado ao usuário, textos de `Sidebar`/`TopBar`).
- [ ] **Step 2: Corrigir arquivo a arquivo, à mão**, aplicando acentos e til ("Gestão", "Captação", "Mãe", "Localização", "Avaliação", "Configurações", "Não", "Sessão", "Descrição", "Endereço", "Informação", "Usuário"). Para cada hit, antes de trocar, checar se o texto é valor gravado/comparado (ver Global Constraints); se for, deixar como está.
- [ ] **Step 3: Guarda contra regressão de dados.** Conferir com `git diff -U0` que nenhuma linha alterada contém `REPCAO`, `'Ativo'`, `'Inativo'`, `Outro motivo`, `status ===`/`status:` com valor de enum, nem chave de `localStorage`/Firestore.
- [ ] **Step 4: Verificar.** `npm run lint` e `npm run build` limpos; `git diff --stat` só mostra `.tsx`/`.ts` de `src`.
- [ ] **Step 5: Commit** `Corrige acentuacao e ortografia dos textos do backoffice`.

---

### Task 2: Modelo de dados e regras do Firestore

**Files:**
- Modify: `src/types.ts` (tipo `Package`, campo `packageId?: string` em `Appointment`), `src/lib/tenantPaths.ts` (`packages: 'packages'` em `TENANT_COLLECTIONS`), `firestore.rules` (bloco `match /packages/{packageId}` dentro de `whitelabels/{whitelabelId}`).
- Test: conferido pelo compilador de regras no deploy e por `npm run lint`.

**Interfaces:**
- Produces: `export interface Package { id?: string; whitelabelId?: string; patientId: string; totalSessions: number; status: 'ATIVO' | 'ENCERRADO'; createdBy: string; createdAt?: any; }`; `COLLECTIONS.packages`.

- [ ] **Step 1: Tipos e constante** nos dois arquivos acima.
- [ ] **Step 2: Regras.** `read`: `isAdminGlobal() || isActiveMember(whitelabelId)` junto com `existingTenantFieldIsValid`. `create`: `isAdminGlobal() || (tenantFieldIsValid(whitelabelId) && (isGestor || isRecepcao || isTerapeuta))` e `totalSessions` inteiro entre 1 e 200 e `status == 'ATIVO'`. `update`: mesmos papéis, só `status` e `updatedAt` podem mudar (`diff(...).affectedKeys().hasOnly(['status','updatedAt'])`). `delete`: `isAdminGlobal() || isGestor(whitelabelId)`.
- [ ] **Step 3: Verificar.** `npm run lint`; `firebase deploy --only firestore:rules --project clinic-dfu` compila ("compiled successfully").
- [ ] **Step 4: Confirmar com o usuário antes do deploy** (publica em produção) e então publicar.
- [ ] **Step 5: Commit** `Adiciona colecao de pacotes de atendimento e regras do Firestore`.

---

### Task 3: Helper de progresso do pacote (com teste)

**Files:**
- Create: `src/lib/packageProgress.ts`
- Modify: `scripts/test-firestore-payloads.ts` (acrescentar asserts; roda com `npm run test:local`)

**Interfaces:**
- Consumes: `Package`, `Appointment` de `src/types.ts`.
- Produces: `export function packageProgress(pkg: Pick<Package, 'totalSessions' | 'status'>, appointments: Pick<Appointment, 'status'>[]): { used: number; total: number; remaining: number; complete: boolean; open: boolean }` — `used` = quantidade com `status === 'CONCLUÍDO'`; `remaining = Math.max(total - used, 0)`; `complete = used >= total`; `open = status === 'ATIVO' && !complete`.

- [ ] **Step 1: Escrever os asserts que falham** (importam `packageProgress`): 10 total e 3 `CONCLUÍDO` + 2 `CANCELADO` + 1 `AGUARDANDO` → `used 3, remaining 7, open true`; 10 `CONCLUÍDO` em total 10 → `complete true, open false`; 12 `CONCLUÍDO` em total 10 → `remaining 0, complete true`; `status 'ENCERRADO'` com 2 usadas → `open false`.
- [ ] **Step 2: Rodar** `npm run test:local`; esperado: falha (módulo inexistente).
- [ ] **Step 3: Implementar** `packageProgress` conforme a assinatura.
- [ ] **Step 4: Rodar** `npm run test:local`; esperado: passa.
- [ ] **Step 5: Commit** `Adiciona calculo de progresso do pacote com teste`.

---

### Task 4: Serviço de pacotes

**Files:**
- Create: `src/services/packageService.ts`

**Interfaces:**
- Consumes: `COLLECTIONS.packages`, `COLLECTIONS.appointments`, `scopedCollection`, `scopedDoc`, `withTenantField` (de `serviceScope`).
- Produces (exatos):
  - `packageService.createPackage(data: { patientId: string; totalSessions: number; createdBy: string }, whitelabelId?: string | null): Promise<string>` (grava `status: 'ATIVO'`, `createdAt: serverTimestamp()`).
  - `packageService.closePackage(id: string, whitelabelId?: string | null): Promise<void>` (`status: 'ENCERRADO'`, `updatedAt: serverTimestamp()`).
  - `packageService.subscribeToPatientPackages(patientId: string, callback: (packages: Package[]) => void, whitelabelId?: string | null): () => void`.
  - `packageService.subscribeToPatientAppointments(patientId: string, callback: (appointments: Appointment[]) => void, therapistId?: string, whitelabelId?: string | null): () => void` — filtra por `patientId` e, se `therapistId` vier, também por `therapistId`; devolve só os que têm `packageId`. Em erro, `console.error` e `callback([])`, como `subscribeToAppointments`.

- [ ] **Step 1: Implementar** seguindo `patientService.ts` e `appointmentService.ts` (mesmo estilo de `onSnapshot` e tratamento de erro). Dois filtros de igualdade, sem índice composto.
- [ ] **Step 2: Verificar** `npm run lint`.
- [ ] **Step 3: Commit** `Adiciona servico de pacotes de atendimento`.

---

### Task 5: Cartão de pacotes no prontuário

**Files:**
- Create: `src/components/PatientPackagesCard.tsx`
- Modify: `src/views/ClinicalRecordView.tsx` (renderizar o cartão entre o cartão do paciente e a seção "Evoluções")

**Interfaces:**
- Consumes: `packageService.*`, `packageProgress`, `useAuth()` (`user.activeWhitelabelId`, `user.activeRole`, `user.email`).
- Produces: `export default function PatientPackagesCard({ patientId }: { patientId: string })`.

- [ ] **Step 1: Componente.** Assina pacotes e agendamentos do paciente (passando `user.email` como `therapistId` quando `activeRole === 'TERAPEUTA'`). Lista cada pacote com barra e texto "X de N sessões" (`packageProgress`), rótulo "Concluído" quando `complete` e "Encerrado" quando `ENCERRADO`; botão "Encerrar" só em pacote aberto. Botão "Novo pacote" abre campo numérico (1 a 200); validar inteiro antes de chamar `createPackage`, com `alert` de erro no padrão do arquivo. Estilo igual aos cartões do `ClinicalRecordView` (classes Tailwind existentes), textos já acentuados.
- [ ] **Step 2: Montar em `ClinicalRecordView`** passando `patient.id`.
- [ ] **Step 3: Verificar** `npm run lint` e `npm run build`.
- [ ] **Step 4: Commit** `Mostra e cria pacotes de atendimento no prontuario`.

---

### Task 6: Seleção de pacote no agendamento e verificação final

**Files:**
- Modify: `src/components/AppointmentFormModal.tsx`

**Interfaces:**
- Consumes: `packageService.subscribeToPatientPackages`, `packageService.subscribeToPatientAppointments`, `packageProgress`, `Appointment.packageId`.
- Produces: `formData.packageId` enviado em `onSubmit` (a série recorrente herda o campo).

- [ ] **Step 1: Select "Pacote (opcional)"** abaixo do paciente. Lista só pacotes do paciente escolhido com `open` verdadeiro, com rótulo "X de N sessões". Ao trocar o paciente, limpar `packageId`. Ao editar agendamento que já tem `packageId` de pacote completo/encerrado, manter o valor atual visível.
- [ ] **Step 2: Aviso, sem bloqueio**, quando o pacote selecionado tem `remaining` menor que o número de ocorrências (série recorrente) ou já está completo.
- [ ] **Step 3: Verificar** `npm run lint`, `npm run build`, `npm run test:local`.
- [ ] **Step 4: Conferência manual** no navegador (login real do usuário): criar pacote de 3 sessões; agendar 2 vinculadas; concluir 1 e ver "1 de 3"; reabrir e ver "0 de 3"; como terapeuta, repetir sem erro de permissão; revisar telas por texto sem acento.
- [ ] **Step 5: Commit** `Permite vincular agendamento a pacote de atendimento`, depois `git push` (se o usuário pedir).
