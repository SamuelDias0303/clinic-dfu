# Relatório diário por e-mail (solicitações e lista de espera) — design

Data: 2026-10-04
Repositório: `clinic-dfu` (código em `tools/relatorio-diario/`). Roda fora do repositório, em um Google Apps Script.

## Objetivo

Todo dia às 20:00 (horário de Brasília), enviar por e-mail um relatório visual com o retrato das solicitações e da lista de espera:

- **Gestora** (`raiza.fisio@gmail.com`): recebe **somente** os dados do whitelabel dela, `raiza-fisio` ("Raiza Freitas - Fisioterapia Pediatrica").
- **Admin global** (`smdb.ti@gmail.com`): recebe os dados de **todos** os whitelabels, com um total consolidado.

Sem custo: o projeto Firebase está no plano Spark (sem Cloud Functions agendadas), então o agendamento e o envio ficam no Apps Script.

## Decisões confirmadas

1. Alternativa C: Google Apps Script com gatilho diário e `MailApp`.
2. Dona do script e remetente: a conta Google `smdb.ti@gmail.com` (admin global). O e-mail chega para a gestora vindo dessa conta.
3. Destinatários e escopo (configuração, não código):
   - `raiza.fisio@gmail.com` → tipo `TENANT`, `whitelabelId: raiza-fisio`.
   - `smdb.ti@gmail.com` → tipo `GLOBAL`.
4. Horário: 20:00, fuso `America/Sao_Paulo`.
5. Infográfico em HTML com CSS inline (tabelas), sem imagens externas e sem JavaScript.
6. Acesso ao Firestore por conta de serviço **somente leitura**, nova (não reaproveitar a `service-account.json` de administrador do repositório).

## 1. Arquitetura

```
Gatilho diário (Apps Script, ~20:00)
  → token OAuth da conta de serviço (JWT assinado, escopo datastore)
  → Firestore REST: lista leads e depoimentosPendentes por whitelabel
  → Relatorio.js (puro): agrega, ordena a fila, monta HTML e texto
  → MailApp.sendEmail para cada destinatário (escopo respeitado)
```

- `Code.gs`: autenticação, leitura paginada do Firestore, decodificação dos valores REST, envio, gatilho, idempotência.
- `Relatorio.js`: **lógica pura** (sem Apps Script, sem rede). Roda igual no Apps Script e no Node, por isso é testável localmente. Exporta com `if (typeof module !== 'undefined') module.exports = {...}`.
- Whitelabels: se há destinatário `GLOBAL` no envio, a execução lista a coleção `whitelabels` e lê todos; senão lê só os `whitelabelId` configurados. O e-mail de um destinatário `TENANT` é montado **somente** com o whitelabel dele (garantido por teste): os dados dos outros podem ter sido lidos na mesma execução, mas nunca entram no e-mail dele.

## 2. Acesso e segredos

- Conta de serviço nova, `relatorio-leitura`, no projeto `clinic-dfu`, papel **Leitor do Cloud Datastore** (`roles/datastore.viewer`). A chave JSON fica em **Propriedades do Script** (`SA_KEY`); nunca em arquivo do repositório.
- A configuração dos destinatários fica em `CONFIG` (Propriedades do Script), JSON:

```json
{
  "backofficeUrl": "https://clinic-dfu.web.app",
  "destinatarios": [
    { "email": "raiza.fisio@gmail.com", "tipo": "TENANT", "whitelabelId": "raiza-fisio" },
    { "email": "smdb.ti@gmail.com", "tipo": "GLOBAL" }
  ]
}
```

- Escopos do `appsscript.json`: `https://www.googleapis.com/auth/script.send_mail` e `https://www.googleapis.com/auth/script.external_request`. Fuso do projeto: `America/Sao_Paulo`.
- A chave JSON é criada e colada nas Propriedades do Script pela mesma pessoa (`smdb.ti@gmail.com` é a dona do script e do projeto Google Cloud), sem passar de mão em mão. Depois de colada, apagar o arquivo `.json` baixado. Se a chave vazar: apagá-la no console do Google Cloud e gerar outra. O dano máximo é leitura do Firestore.
- Como o script é do admin global, o remetente do e-mail da gestora é `smdb.ti@gmail.com`. Se a Raíza estranhar o remetente, ela pode marcá-lo como contato conhecido; não afeta a segurança.

## 3. Conteúdo do relatório

Por whitelabel (o `GLOBAL` repete o bloco para cada whitelabel e acrescenta um **total consolidado** no topo):

- **Cartões por status**: Novo, Lista de espera, Em contato, Agendado, Convertido, Descartado. Arquivados ficam **fora** das contagens; uma linha de rodapé informa `Arquivadas: N`.
- **Novas nas últimas 24 h** e **barras dos últimos 7 dias** (solicitações recebidas por dia, no fuso de Brasília).
- **Lista de espera**: tamanho, quantos prioritários, tempo de espera da pessoa mais antiga e os **5 primeiros da fila** (posição, **primeiro nome** do responsável, bebê se informado, dias de espera, ★ se prioritário).
- **Depoimentos aguardando moderação** (`depoimentosPendentes` com `status == 'PENDENTE'`).
- Botão "Abrir backoffice" para `backofficeUrl`.
- **Sem** telefone, endereço, observações ou nome completo no e-mail.

Assunto: `Relatório diário — DD/MM — Lista de espera: N` (para o `GLOBAL`: total de todas as listas).
Corpo em HTML (600 px de largura, legível no celular) e versão em texto simples.

## 4. Regras de negócio (em `Relatorio.js`)

- **Fila**: só `status == 'LISTA_ESPERA'` e não arquivado; prioritários primeiro; depois `createdAt` crescente; lead sem `createdAt` vai para o fim; empate desfeito por `id`. É a mesma regra de `src/lib/listaEspera.ts` (`ordenarFila`); um teste de paridade garante que as duas implementações dão a mesma ordem para os mesmos dados.
- **Fuso**: Brasil não tem horário de verão desde 2019, então os dias são calculados com deslocamento fixo UTC-3. Se o horário de verão voltar, a divisão de dias muda em uma hora até o código ser ajustado.
- **Dia**: "últimas 24 h" é uma janela deslizante até o momento do envio; "7 dias" são os 7 dias-calendário de Brasília que terminam hoje.
- **Primeiro nome**: `responsavel.trim().split(/\s+/)[0]`; vazio vira "—".
- **Dados incompletos**: lead sem `status` conhecido entra em "Outros"; `createdAt` ausente não entra nas barras nem nas últimas 24 h.

## 5. Envio e robustez

- Um e-mail por destinatário, cada um com o seu escopo. Falha ao montar ou enviar para um destinatário não impede os demais; a falha é registrada e relançada no fim para o Google avisar a dona do script.
- **Idempotência**: guarda `ultimoEnvio:<email>` (data no fuso de Brasília) nas Propriedades do Script; o gatilho não reenvia no mesmo dia. `enviarRelatorio({ forcar: true })` ignora essa trava (para testes).
- Função `testarSemEnviar()` monta os e-mails e registra no log (assunto e contagens), sem enviar nada.
- Gatilho: `ScriptApp.newTrigger('enviarRelatorio').timeBased().atHour(20).nearMinute(0).everyDays(1).create()`, o que dispara perto das 20:00. O Google não garante o minuto: a janela pode chegar a cerca de 1 hora (observar o horário real no primeiro dia). Notificação de falha do gatilho: "Notificar imediatamente".
- Cotas gratuitas folgadas: `MailApp` (100 destinatários/dia em conta Gmail comum) e `UrlFetchApp` (20.000 chamadas/dia). A leitura do Firestore é paginada.

## 6. Entregáveis em `clinic-dfu/tools/relatorio-diario/`

- `Relatorio.js` (lógica pura) e `Code.gs` (Firestore + envio + gatilho).
- `appsscript.json` (fuso e escopos).
- `README.md`: passo a passo da configuração manual (ver abaixo).
- `scripts/test-relatorio.ts` + `npm run test:relatorio`: testes da lógica pura, incluindo isolamento de escopo e paridade com `ordenarFila`.

### Passo a passo da configuração manual (README)

1. (`smdb.ti@gmail.com`, no console do Google Cloud do projeto `clinic-dfu`) IAM → Contas de serviço → criar `relatorio-leitura` com o papel **Leitor do Cloud Datastore** → Chaves → criar chave JSON.
2. (Dona do script, `smdb.ti@gmail.com`) em script.google.com, criar um projeto; colar `Relatorio.js` e `Code.gs`; ajustar o manifesto com `appsscript.json`.
3. Propriedades do Script: `SA_KEY` (JSON da chave) e `CONFIG` (JSON acima).
4. Rodar `testarSemEnviar` (autorizar os escopos), conferir o log; rodar `enviarRelatorio` com `forcar` e conferir os dois e-mails.
5. Rodar `criarGatilhoDiario` uma vez e ativar a notificação de falha.

## 7. Testes e verificação

- `npm run test:relatorio` (Node/tsx): agregação por status; arquivados fora; novas 24 h e 7 dias com timestamps na virada do dia em UTC-3; fila (prioritário, data, sem `createdAt`, paridade com `ordenarFila`); primeiro nome; HTML sem telefone/endereço/sobrenome; **isolamento**: o e-mail `TENANT` do `raiza-fisio` nunca contém dados de outro whitelabel e o `GLOBAL` contém todos; ausência de dados (zero leads) renderiza sem quebrar.
- `npm run lint` e `npm run test:local` continuam verdes.
- Verificação ao vivo (usuário): `testarSemEnviar`, depois envio forçado e conferência visual no Gmail (celular e desktop).

## 8. Fora de escopo

- Gráficos como imagem, anexos em PDF, envio por WhatsApp.
- Mais destinatários além dos dois configurados (basta editar `CONFIG`, sem código).
- Relatório semanal ou mensal.
- Qualquer escrita no Firestore.
