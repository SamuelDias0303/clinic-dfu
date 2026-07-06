# Matriz De Teste De Seguranca Whitelabel

Use esta matriz antes de publicar regras ou liberar os services tenant-aware.

## Perfis De Teste

```text
adminGlobal: usuario com custom claim admin=true ou roles=["ADMIN_GLOBAL"]
gestorA: membro ATIVO do whitelabel A com roles=["GESTOR"]
recepcaoA: membro ATIVO do whitelabel A com roles=["REPCAO"]
terapeutaA: membro ATIVO do whitelabel A com roles=["TERAPEUTA"]
gestorB: membro ATIVO do whitelabel B com roles=["GESTOR"]
semMembership: usuario autenticado sem membership
anonimo: request.auth == null
```

## Whitelabels

```text
whitelabels/tenant-a
whitelabels/tenant-b
```

Crie pelo menos um paciente, terapeuta, agendamento, evolucao e anamnese em cada tenant.

## Casos Obrigatorios

| Caso | Usuario | Operacao | Caminho | Esperado |
| --- | --- | --- | --- | --- |
| 1 | anonimo | read | `whitelabels/tenant-a` | Negado |
| 2 | semMembership | read | `whitelabels/tenant-a/patients/{id}` | Negado |
| 3 | gestorA | read | `whitelabels/tenant-a/patients/{id}` | Permitido |
| 4 | gestorA | read | `whitelabels/tenant-b/patients/{id}` | Negado |
| 5 | recepcaoA | create | `whitelabels/tenant-a/patients/{id}` | Permitido |
| 6 | recepcaoA | delete | `whitelabels/tenant-a/patients/{id}` | Negado |
| 7 | terapeutaA | read | paciente de outro terapeuta no tenant A | Negado |
| 8 | terapeutaA | read | paciente vinculado ao terapeuta no tenant A | Permitido |
| 9 | gestorA | create | `whitelabels/tenant-a/appointments/{id}` | Permitido |
| 10 | gestorA | create | appointment com `whitelabelId=tenant-b` em tenant A | Negado |
| 11 | terapeutaA | create | appointment para outro terapeuta | Negado |
| 12 | terapeutaA | create | evolution no tenant A | Permitido |
| 13 | terapeutaA | read | evolution no tenant B | Negado |
| 14 | gestorA | delete | `whitelabels/tenant-a/evolutions/{id}` | Permitido |
| 15 | recepcaoA | read | `whitelabels/tenant-a/evolutions/{id}` | Negado |
| 16 | adminGlobal | create | `whitelabels/{id}` | Permitido |
| 17 | adminGlobal | create | `whitelabels/tenant-a/members/{uid}` | Permitido |
| 18 | gestorA | create | `whitelabels/tenant-a/members/{uid}` | Permitido |
| 19 | gestorA | create | `whitelabels/tenant-b/members/{uid}` | Negado |
| 20 | qualquer autenticado | read | `patients/{id}` global legado | Negado apos migracao |

## Observacoes

- Mesmo com services tenant-aware, nao publique regras bloqueando globais em producao ate a migracao estar validada localmente.
- A permissao de terapeuta depende de padronizar `therapistId`. Hoje o app ainda usa e-mail em alguns fluxos; valide isso antes de endurecer regras em producao.
- `ADMIN_GLOBAL` consegue gerenciar whitelabels e memberships. O acesso a dados clinicos deve ser usado com cuidado operacional e pode ser endurecido depois com audit logs.
