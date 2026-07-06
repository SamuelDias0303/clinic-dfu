# Modelo De Whitelabel

Este documento descreve a estrutura alvo para implementar whitelabels no Clinic DFU.

## Objetivo

Whitelabel representa o tenant operacional do sistema. Cada whitelabel deve ter usuarios, terapeutas, pacientes, agendamentos e prontuarios isolados dos demais.

## Colecoes Raiz

```text
users/{userId}
whitelabels/{whitelabelId}
```

Durante a migracao, a colecao legada `clients` continua existindo como origem dos dados de backoffice. A camada `whitelabelService` normaliza essa colecao para o tipo `Whitelabel`.

## Estrutura Recomendada Por Tenant

```text
whitelabels/{whitelabelId}
whitelabels/{whitelabelId}/members/{userId}
whitelabels/{whitelabelId}/patients/{patientId}
whitelabels/{whitelabelId}/therapists/{therapistId}
whitelabels/{whitelabelId}/appointments/{appointmentId}
whitelabels/{whitelabelId}/evolutions/{evolutionId}
whitelabels/{whitelabelId}/anamneses/{anamneseId}
whitelabels/{whitelabelId}/auditLogs/{auditLogId}
```

Essa estrutura reduz risco de vazamento entre tenants porque consultas e regras partem do caminho do whitelabel ativo.

## Associacao De Usuario

Cada associacao fica em:

```text
whitelabels/{whitelabelId}/members/{userId}
```

Campos esperados:

- `whitelabelId`
- `userId`
- `email`
- `name`
- `roles`
- `status`
- `therapistId`, quando o usuario tambem for terapeuta
- `patientIds`, quando houver restricao direta por pacientes

## Papeis

- `ADMIN_GLOBAL`: opera o backoffice global e gerencia whitelabels.
- `GESTOR`: gerencia dados operacionais dentro do whitelabel ativo.
- `REPCAO`: usa fluxos administrativos/recepcao dentro do whitelabel ativo.
- `TERAPEUTA`: acessa agenda, pacientes e prontuarios permitidos dentro do whitelabel ativo.

## Helpers Criados Na Sprint 1

- `src/lib/tenantPaths.ts`: cria caminhos padronizados para documentos e subcolecoes de tenant.
- `src/lib/permissions.ts`: concentra verificacoes iniciais de papel e permissao.
- `src/services/whitelabelService.ts`: cria o vocabulario novo de whitelabel mantendo compatibilidade com `clients`.

## Regra De Implementacao Para As Proximas Sprints

Todo service que acessar dado clinico ou operacional deve receber `whitelabelId` de forma explicita antes de ler ou gravar Firestore.

Exemplo conceitual:

```ts
tenantCollectionPath(whitelabelId, TENANT_COLLECTIONS.patients)
```

Nao usar filtros no frontend como mecanismo principal de isolamento. A UI pode filtrar para melhorar experiencia, mas a seguranca deve estar no caminho do Firestore e nas regras.
