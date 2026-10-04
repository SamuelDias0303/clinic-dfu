# Relatório diário por e-mail

Todo dia às ~20:00 (Brasília), um Google Apps Script envia um relatório visual de solicitações e lista de espera:

- `raiza.fisio@gmail.com`: só o whitelabel `raiza-fisio`.
- `smdb.ti@gmail.com` (admin global): todos os whitelabels + total consolidado.

Spec: [docs/superpowers/specs/2026-10-04-relatorio-diario-design.md](../../docs/superpowers/specs/2026-10-04-relatorio-diario-design.md).

## Como funciona

`Relatorio.js` (regra pura) + `Code.gs` (Firestore REST, envio, gatilho) rodam dentro de um projeto do Apps Script
da conta `smdb.ti@gmail.com`. O Firestore é lido por uma **conta de serviço somente leitura**. O e-mail não leva
telefone, endereço nem sobrenome, e a leitura do banco já pede só os campos necessários (máscara de campos).

## Configuração (uma vez, ~15 minutos)

### 1. Conta de serviço somente leitura (console do Google Cloud, conta `smdb.ti@gmail.com`)

1. Abra <https://console.cloud.google.com/iam-admin/serviceaccounts?project=clinic-dfu>.
2. **Criar conta de serviço**: nome `relatorio-leitura`. Em "Conceder acesso", escolha o papel **Leitor do Cloud Datastore**
   (`Cloud Datastore Viewer`). Concluir.
3. Abra a conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON**. O navegador baixa um `.json`.

> Essa chave dá **leitura** ao Firestore. Trate como senha: não coloque no repositório, em chat ou e-mail.
> Se vazar: apague a chave na mesma aba e gere outra.

### 2. Projeto no Apps Script (conta `smdb.ti@gmail.com`)

1. Abra <https://script.google.com> → **Novo projeto** → nome `Relatorio diario`.
2. **Configurações do projeto** (engrenagem) → marque **Mostrar arquivo de manifesto "appsscript.json" no editor**.
3. No editor, cole o conteúdo de `appsscript.json` deste repositório no arquivo de manifesto.
4. Renomeie o arquivo padrão para `Code.gs` e cole o conteúdo de `Code.gs`.
5. Crie um segundo arquivo (**+ → Script**) chamado `Relatorio` e cole o conteúdo de `Relatorio.js`.
6. Salve (Ctrl+S).

### 3. Propriedades do Script

**Configurações do projeto → Propriedades do script → Editar propriedades do script**, adicione:

| Propriedade | Valor |
| :--- | :--- |
| `SA_KEY` | O conteúdo **inteiro** do `.json` baixado no passo 1 |
| `CONFIG` | O JSON abaixo |

```json
{
  "backofficeUrl": "https://clinic-dfu.web.app",
  "destinatarios": [
    { "email": "raiza.fisio@gmail.com", "tipo": "TENANT", "whitelabelId": "raiza-fisio" },
    { "email": "smdb.ti@gmail.com", "tipo": "GLOBAL" }
  ]
}
```

Depois de colar `SA_KEY`, **apague o arquivo `.json` baixado** do computador (e da lixeira).

### 4. Testar

1. No editor, escolha a função `testarSemEnviar` → **Executar**. Autorize os escopos quando pedir.
   No **Registro de execução** confira uma linha por destinatário (assunto) e a contagem de leads de cada whitelabel.
2. Escolha `enviarAgoraForcando` → **Executar**: envia agora, ignorando a trava de "já enviei hoje".
   Confira os dois e-mails no Gmail (celular e computador).

### 5. Ativar o envio diário

1. Execute `criarGatilhoDiario` uma vez (ele remove gatilhos duplicados).
2. No menu **Gatilhos** (relógio), abra o gatilho de `enviarRelatorio` → **Notificações de falha** → **Notificar imediatamente**.

## Operação

- **Horário:** o gatilho dispara perto das 20:00, mas o Google não garante o minuto: a execução pode atrasar
  (a janela pode chegar a cerca de 1 hora). Observe o primeiro dia para ver o horário real de chegada.
- **Não duplica:** cada destinatário recebe no máximo um e-mail por dia; `enviarAgoraForcando` ignora a trava.
- **Falha:** se um envio falhar, o Google avisa por e-mail a conta dona do script. Um destinatário com erro não impede os outros,
  e no dia seguinte (ou numa nova execução) só quem falhou é reenviado.
- **Trocar ou incluir destinatário:** edite a propriedade `CONFIG` (não precisa mexer no código).
- **Trocar a chave:** gere uma nova no console, cole em `SA_KEY` e apague a antiga.
- **Atualizar o código:** edite os arquivos neste repositório e cole de novo no Apps Script (`Code.gs` e `Relatorio`).

## Desenvolvimento

```bash
npm run test:relatorio                       # regra pura (inclui paridade com ordenarFila) + Code.gs num Apps Script simulado
npx tsx scripts/preview-relatorio.ts         # gera tools/relatorio-diario/preview/*.html com dados fictícios
```
