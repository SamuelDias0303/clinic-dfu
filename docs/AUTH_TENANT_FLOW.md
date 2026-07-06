# Fluxo De Autenticacao E Tenant

Este documento registra a implementacao inicial da Sprint 2.

## Fontes De Perfil

O `AuthContext` tenta montar o usuario autenticado a partir destas fontes:

1. Custom claims do Firebase Auth, quando existirem.
2. Documento `users/{uid}`, quando existir.
3. Associacoes em `whitelabels/{whitelabelId}/members/{userId}`.
4. Fallback legado para manter o produto funcionando durante a migracao.

## Fallback Legado

Enquanto as regras e a migracao nao forem aplicadas, contas sem perfil/membership recebem um contexto legado:

```text
whitelabelId: legacy-default
whitelabelName: Clinic DFU
```

Esse fallback sera removido ou reduzido depois que a Sprint 3 e a Sprint 4 estiverem completas.

## Escolha De Perfil

Se o usuario tiver mais de um papel e ainda nao houver papel ativo, o app mostra `ProfileSelectionView`.

O papel escolhido e salvo em:

```text
localStorage.activeRole_{uid}
```

## Escolha De Whitelabel

Se o usuario tiver mais de uma associacao ativa e ainda nao houver whitelabel ativo, o app mostra `WhitelabelSelectionView`.

O whitelabel escolhido e salvo em:

```text
localStorage.activeWhitelabel_{uid}
```

## Proximas Sprints

- Sprint 3 deve adicionar regras do Firestore para bloquear acesso sem associacao.
- Sprint 4 adicionou services tenant-aware com fallback `legacy-default`.
- As proximas etapas devem validar dados locais por whitelabel real e evoluir o backoffice.
