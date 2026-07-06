# Services Com Escopo Por Whitelabel

Este documento registra a entrega da Sprint 4.

## Regra Geral

Services que acessam dados operacionais ou clinicos aceitam `whitelabelId` e resolvem o caminho correto do Firestore.

Quando `whitelabelId` aponta para um whitelabel real:

```text
whitelabels/{whitelabelId}/{collection}
```

Quando `whitelabelId` e `legacy-default` ou esta ausente:

```text
{collection}
```

Esse fallback existe apenas para permitir teste local e continuidade do produto antes da migracao das colecoes globais.

## Helper Central

O arquivo `src/services/serviceScope.ts` centraliza:

- `scopedCollection`
- `scopedDoc`
- `withTenantField`
- `LEGACY_WHITELABEL_ID`

## Services Atualizados

- `patientService`
- `therapistService`
- `appointmentService`
- `clinicalRecordService`

## Fluxos Cobertos

- Listagem, criacao, edicao e exclusao de pacientes.
- Listagem, criacao, edicao e exclusao de terapeutas.
- Listagem, criacao, edicao, exclusao e recorrencia de agendamentos.
- Checagem de conflito de agenda dentro do escopo correto.
- Evolucoes e anamneses dentro do escopo correto.

## Importante

Nao publicar `firestore.rules` em producao enquanto o ambiente real ainda depender das colecoes globais. Primeiro, execute a migracao descrita em `docs/WHITELABEL_MIGRATION.md` e valide a matriz em `docs/WHITELABEL_SECURITY_MATRIX.md`.
## Compatibilidade com usuarios antigos

Usuarios antigos que ainda nao possuem membership em uma whitelabel real recebem uma associacao virtual `legacy-default`.

Essa associacao preserva o acesso as colecoes globais antigas (`patients`, `therapists`, `appointments`, `evolutions`, `anamneses`) ate a migracao oficial dos dados. Usuarios convidados para whitelabels reais nao usam esse fallback e acessam somente o caminho isolado `whitelabels/{whitelabelId}/...`.

Regra operacional:

- Sem membership real: usa `legacy-default` com papel `TERAPEUTA` e dados antigos.
- Com membership real: usa apenas a whitelabel ativa.
- `ADMIN_GLOBAL`: usa Backoffice global e nao opera dados clinicos diretamente.

## Workspace individual

Contas novas criadas sem convite, seja por cadastro direto ou Google, passam a receber uma whitelabel individual automatica.

Essa whitelabel usa:

- `workspaceType: "INDIVIDUAL"`
- `plan: "Individual"`
- `ownerUserId: uid do usuario`
- membership com papel unico `TERAPEUTA`

O terapeuta individual acessa apenas agenda, pacientes e prontuario dentro de `whitelabels/individual_{uid}/...`. Ele nao recebe acesso a `Gestao`, convites, cadastro de equipe ou administracao de clinica. Contas antigas sem membership real continuam usando `legacy-default` ate a migracao.
