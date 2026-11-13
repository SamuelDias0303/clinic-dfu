# Pacotes de atendimento e revisão de texto do backoffice

Data: 2026-11-13. Duas frentes independentes, feitas em ordem: (1) revisão de texto, (2) pacotes.

## Intenção

O terapeuta precisa se organizar: saber, por paciente, quantas sessões de um pacote já foram feitas e quantas faltam. Hoje a agenda só registra agendamentos soltos. Além disso, a interface está sem acentos e sem til ("Gestao", "Captacao", "Mae"); deve seguir a ortografia do português do Brasil.

## Objetivos

- Criar um pacote para um paciente cadastrado, com número total de sessões.
- Vincular agendamentos ao pacote e mostrar "X de N sessões".
- Gestor, recepção, terapeuta e admin criam e editam pacotes.
- Todo texto visível ao usuário no backoffice com acentuação correta.

## Não objetivos

- Sem valor, preço, pagamento ou validade/prazo no pacote (decisão do usuário).
- Sem tela nova no menu lateral.
- Sem bloquear agendamento além do total (apenas avisa).
- Sem revisar `docs/*.md`, nem a landing page, nem nomes de código.

## Anti-objetivos

- Contador errado depois de cancelar, reabrir ou apagar uma série de agendamentos.
- Quebrar dados ou regras trocando valor gravado por texto "corrigido".

## Abordagens consideradas

- **A. Pacote guarda só o total; "usadas" é calculado (escolhida).** Usadas = agendamentos com aquele `packageId` e status `CONCLUÍDO`. Nada a estornar, nunca desanda.
- B. Contador `usedSessions` gravado e incrementado ao concluir. Descartada: desanda ao reabrir/cancelar/apagar série; exige transação.
- C. Pré-gerar as N sessões. Descartada: exige datas na criação; pacote não tem prazo.

## Design

### Dados

Nova coleção `whitelabels/{id}/packages` (entrada em `TENANT_COLLECTIONS`, `src/lib/tenantPaths.ts`):

```
Package { id, whitelabelId, patientId, totalSessions (inteiro 1..200),
          status 'ATIVO' | 'ENCERRADO', createdBy (email), createdAt }
```

`Appointment` ganha `packageId?: string`. A série recorrente já copia o agendamento inteiro (`...appointment` em `buildRecurringAppointments`), então todas as ocorrências herdam o `packageId`. As regras de `appointments` não têm lista fechada de campos, então não mudam.

### Contagem

`packageService.subscribeToPackages(patientId)` e uma assinatura de agendamentos por `packageId` (um único filtro de igualdade, sem índice composto); o status `CONCLUÍDO` é filtrado no cliente. Pacote "completo" = usadas >= total, derivado na tela, sem gravar nada.

### Telas

- **Prontuário** (`ClinicalRecordView`): cartão de pacotes do paciente, com barra "5 de 10 sessões", botão "Novo pacote" (campo de total) e "Encerrar".
- **Formulário de agendamento** (`AppointmentFormModal`): select opcional "Pacote", listando só pacotes `ATIVO` e não completos do paciente escolhido; limpa ao trocar de paciente. Aviso (não bloqueio) se o pacote já estiver completo ou a série ultrapassar o saldo.

### Regras do Firestore

`packages`: leitura para admin e membro ativo; `create`/`update` para admin ou (`tenantFieldIsValid` e gestor/recepção/terapeuta); `delete` só admin/gestor (o fluxo normal é "Encerrar"). Deploy com `firebase deploy --only firestore:rules --project clinic-dfu`.

### Revisão de texto

Revisão manual, arquivo a arquivo (16 arquivos `.tsx` em `src` e os alertas/erros dos serviços), sem busca-e-troca automática. Entram: rótulos, títulos, placeholders, `alert`/`confirm`, mensagens de erro exibidas. **Ficam de fora** (são dado ou contrato): valores gravados e comparados nas regras (`'Ativo'/'Inativo'`, papéis como `REPCAO`, status de lead, `preocupacoes`, especialidades), chaves do Firestore e do `localStorage`, `console.*`, textos espelhados da landing. Resultado: um commit separado, antes dos pacotes.

## Decisões minhas (confira)

- "Encerrado automático" virou derivado na tela (não grava `ENCERRADO` sozinho), para não criar escrita extra nem inconsistência.
- Pacote sem nome; só paciente + total.
- Terapeuta vê todos os pacotes do tenant (guardam só `patientId` e contagem, sem dado clínico); restringir por terapeuta fica como evolução.
- Sem teste automatizado: a lógica nova é uma contagem trivial. Verificação: `npm run lint`, `npm run build`, regras publicadas e conferência manual no navegador.

## Fica para quem constrói

Layout exato do cartão de pacotes; texto das mensagens de aviso; lista final de cada string revisada.
