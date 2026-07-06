# Migracao Para Whitelabel

Este documento define o caminho repetivel para migrar as colecoes globais atuais para o modelo com escopo por whitelabel.

## Objetivo

Mover dados de:

```text
patients
therapists
appointments
evolutions
anamneses
clients
```

para:

```text
whitelabels/{whitelabelId}/patients
whitelabels/{whitelabelId}/therapists
whitelabels/{whitelabelId}/appointments
whitelabels/{whitelabelId}/evolutions
whitelabels/{whitelabelId}/anamneses
whitelabels/{whitelabelId}/members
```

## Whitelabel Padrao Inicial

Enquanto nao houver separacao real dos clientes antigos, use:

```text
whitelabelId: legacy-default
name: Clinic DFU
slug: clinic-dfu
status: ATIVO
plan: Legado
```

## Ordem Recomendada

1. Fazer backup/export do Firestore antes de qualquer escrita.
2. Criar documento `whitelabels/legacy-default`.
3. Criar memberships para usuarios conhecidos em `whitelabels/legacy-default/members/{uid}`.
4. Copiar `therapists/*` para `whitelabels/legacy-default/therapists/*`.
5. Copiar `patients/*` para `whitelabels/legacy-default/patients/*`.
6. Copiar `appointments/*` para `whitelabels/legacy-default/appointments/*`.
7. Copiar `evolutions/*` para `whitelabels/legacy-default/evolutions/*`.
8. Copiar `anamneses/*` para `whitelabels/legacy-default/anamneses/*`.
9. Adicionar `whitelabelId: legacy-default` nos documentos copiados, quando fizer sentido.
10. Executar a matriz de seguranca em `docs/WHITELABEL_SECURITY_MATRIX.md`.
11. Validar os services tenant-aware entregues na Sprint 4 com dados locais.
12. Somente depois da validacao local e da migracao, bloquear ou arquivar as colecoes globais antigas.

## Formato Esperado De Membership

```json
{
  "whitelabelId": "legacy-default",
  "whitelabelName": "Clinic DFU",
  "userId": "firebase-auth-uid",
  "email": "usuario@clinica.com",
  "name": "Nome do Usuario",
  "roles": ["GESTOR"],
  "status": "ATIVO"
}
```

Para terapeutas, inclua `therapistId` quando houver um identificador de terapeuta correspondente.

## Cuidados

- Nao apagar as colecoes globais antigas antes de validar a migracao localmente.
- Nao publicar regras que bloqueiam colecoes globais enquanto o frontend ainda depende delas em producao.
- Validar se `therapistId` usa e-mail, uid ou id do documento antes de aplicar regras mais restritivas.
- Conferir que todos os documentos clinicos copiados mantem vinculo correto com `patientId`.
- Conferir que recorrencias de agenda mantem `recurrenceId`.

## Criterio De Conclusao Da Migracao

- Dados aparecem corretamente no whitelabel padrao.
- Usuarios sem membership nao conseguem ler dados clinicos.
- Usuario do whitelabel A nao acessa dados do whitelabel B.
- Services usam `whitelabelId` obrigatorio.
- Colecoes globais antigas deixam de ser usadas pelo app.

## Validacao Das Regras

As regras podem ser validadas sem deploy real com:

```powershell
$env:NO_UPDATE_NOTIFIER='1'
firebase deploy --only firestore:rules,firestore:indexes --project clinic-dfu --dry-run
```

Nao execute o deploy real antes da migracao local validada, porque `firestore.rules` ja bloqueia as colecoes globais antigas de dados sensiveis.
