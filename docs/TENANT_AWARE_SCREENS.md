# Telas Com Escopo Por Whitelabel

Este documento registra a entrega da Sprint 6.

## Objetivo

Garantir que telas operacionais e clinicas so sejam usadas dentro de um whitelabel ativo.

## Telas Protegidas

- Painel
- Agenda
- Pacientes
- Terapeutas
- Prontuario

Essas telas dependem de `activeWhitelabelId` quando o papel ativo nao e `ADMIN_GLOBAL`.

## Comportamento Implementado

- Usuario sem whitelabel ativo e enviado para selecao de whitelabel.
- Usuario sem nenhuma associacao ativa recebe estado explicito informando que precisa de acesso.
- `ADMIN_GLOBAL` entra direto no Backoffice.
- Se `ADMIN_GLOBAL` tentar abrir telas clinicas, o app exibe um estado informativo e oferece atalho para Backoffice.
- O topo do app continua mostrando o whitelabel ativo quando existe contexto.

## Componente Novo

`src/components/TenantAccessState.tsx`

Esse componente centraliza mensagens de contexto ausente, permissao ou direcionamento operacional.

## Observacao

Esta sprint ainda nao publica regras nem altera producao. A validacao continua local em `http://127.0.0.1:3000`.
