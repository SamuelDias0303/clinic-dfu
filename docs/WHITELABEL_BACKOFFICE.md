# Backoffice De Whitelabel

Este documento registra a entrega da Sprint 5.

## Objetivo

Transformar a tela de backoffice em uma area operacional para gerenciar whitelabels e membros associados.

## Funcionalidades Entregues

- Listagem de whitelabels normalizados a partir da colecao legada `clients`.
- Criacao e edicao de whitelabel.
- Suspensao, reativacao e arquivamento com confirmacao.
- Configuracoes principais: nome, slug, dominio, plano, contato, cor primaria, unidade padrao e tipos de agendamento.
- Modal de membros por whitelabel com cadastro de nome, e-mail, uid, papeis e terapeuta vinculado.

## Compatibilidade

O `whitelabelService` ainda usa `clients` como origem temporaria para preservar compatibilidade com o backoffice existente.

Os membros sao gravados em:

```text
whitelabels/{whitelabelId}/members/{memberId}
```

Esse caminho ja segue o modelo alvo, mas deve ser validado localmente antes de qualquer publicacao de regras em producao.

## Cuidados

- Nao fazer deploy real das regras enquanto a migracao local nao estiver validada.
- Arquivar whitelabel altera status para `ARQUIVADO`; nao apaga dados clinicos.
- A remocao de membros remove apenas o vinculo do whitelabel, nao a conta Firebase Auth.
- A associacao de pacientes e terapeutas aos whitelabels sera consolidada junto da validacao local dos dados migrados.
