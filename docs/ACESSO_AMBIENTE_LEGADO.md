# Acesso ao ambiente legado

O ambiente legado representa os dados antigos que ainda estao nas colecoes globais:

- `patients`
- `therapists`
- `appointments`
- `evolutions`
- `anamneses`

Ele aparece no Backoffice como `Clinic DFU - Legado` e usa o identificador tecnico `legacy-default`.

## Quando usar

Use este acesso para consultar e administrar pacientes, terapeutas, gestores operacionais e agendamentos que foram criados antes da estrutura de whitelabels.

Este fluxo nao migra dados. Ele apenas abre as telas clinicas apontando para o modelo antigo.

## Como acessar

1. Entre com um usuario `ADMIN_GLOBAL`.
2. Abra `Backoffice`.
3. Localize a linha `Clinic DFU - Legado`.
4. Clique no icone de entrada na coluna `Acoes`.
5. O app muda para o contexto operacional do legado.
6. Use `Painel`, `Agenda`, `Pacientes` e `Terapeutas` para administrar os dados antigos.

## Como voltar ao Backoffice global

1. Clique em `Trocar Perfil` no topo.
2. Escolha `Administrador Global`.
3. O app volta para o Backoffice global.

## Regras importantes

- Apenas `ADMIN_GLOBAL` enxerga e assume o ambiente legado pelo Backoffice.
- O legado usa `legacy-default` e acessa as colecoes globais antigas.
- Whitelabels novas continuam isoladas em `whitelabels/{whitelabelId}/...`.
- Workspaces individuais continuam isolados em `whitelabels/individual_{uid}/...`.
- Entrar no legado nao altera nem migra dados de whitelabels novas.

## Caminho futuro

Quando a migracao for executada, os dados globais antigos devem ser movidos para uma whitelabel real. Depois disso, a linha `Clinic DFU - Legado` pode ser removida do Backoffice.
