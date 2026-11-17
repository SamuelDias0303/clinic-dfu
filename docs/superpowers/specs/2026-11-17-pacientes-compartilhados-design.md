# Pacientes compartilhados entre whitelabels e pacotes por terapeuta

## Intenção

Dois whitelabels (`rafaela-fisio` e `raiza-fisio`) precisam atender os mesmos pacientes. Cada lado deve conseguir ver o paciente, agendar na própria agenda e registrar evolução, com o gerenciamento de hoje. Só o gestor decide quais pacientes são compartilhados e com quais whitelabels. Junto com isso, o pacote de atendimento passa a ser **de um terapeuta**, para o controle de sessões de cada terapeuta ficar separado.

## Objetivos

- O gestor marca pacientes e escolhe os whitelabels de destino; pode desfazer depois.
- O whitelabel de destino vê o paciente na lista (com marca "Compartilhado"), abre o prontuário, agenda e registra evolução.
- Prontuário único: uma evolução registrada por um lado aparece para o outro.
- Pacote pertence a um terapeuta; sessões contadas só dos agendamentos dele.

## Fora do escopo

- Compartilhar com mais de 3 whitelabels por paciente.
- Compartilhar leads, terapeutas ou qualquer outra coleção. Agenda só aparece para o outro lado nos agendamentos marcados (ver "Agendamentos compartilhados").
- Mover ou duplicar paciente entre whitelabels.
- Migrar pacotes antigos para um terapeuta (continuam valendo como estão).

## O que não pode acontecer

- Whitelabel sem vínculo ver paciente que não foi compartilhado com ele.
- Quem não é gestor do whitelabel de origem alterar `sharedWith`.
- Contador de pacote misturar sessões de terapeutas diferentes.

## Abordagens consideradas

- **A. Copiar o paciente para o outro whitelabel.** Cadastros divergem e evoluções não se encontram. Descartada.
- **B. Paciente e prontuário ficam na origem; o destino lê e grava lá (escolhida).**
- **C. Cadastro central fora dos whitelabels.** Exige migrar tudo e reescrever regras e telas. Descartada por custo.

O usuário escolheu B.

## Desenho (B)

### Dados

- `Patient.sharedWith?: string[]` — ids dos whitelabels com acesso (máximo 3). O paciente e seu prontuário (`evolutions`, `anamneses`) continuam em `whitelabels/{origem}/...`.
- `Appointment.patientWhitelabelId?: string` — preenchido quando o paciente é de outro whitelabel. O agendamento fica na agenda de quem agendou.
- `Appointment.sharedToWhitelabels?: string[]` — a tag de visibilidade: whitelabels (entre os de `sharedWith` do paciente, máximo 3) em que este agendamento deve aparecer. Vazio ou ausente = só a agenda de quem agendou vê.
- `whitelabelLinks/{origemId}` `{ targetIds: string[], targets: { id, name, slug }[] }` — quais whitelabels a origem pode ver e usar como destino de compartilhamento. É direcional: A poder compartilhar com B não faz B poder compartilhar com A. Só o admin global grava (tela de administração, uma lista de caixas de seleção por whitelabel). Leitura: admin global e membro ativo da própria origem. Nome e slug do destino são copiados para `targets` na gravação; renomear um whitelabel pede reabrir o vínculo (o admin vê o aviso).
- `Package.therapistId?: string` e `Package.patientWhitelabelId?: string`. O pacote fica no whitelabel do terapeuta que atende. Pacote sem `therapistId` (antigo) continua utilizável por qualquer terapeuta do whitelabel.

### Quem pode o quê

- Gestor da origem (e admin global) altera `sharedWith`. Nenhum outro papel altera esse campo.
- Edição do cadastro do paciente continua só no whitelabel de origem.
- Gestor, recepção e terapeuta do destino leem o paciente compartilhado. Gestor e terapeuta do destino leem e gravam evoluções e anamneses dele. Terapeuta do destino vê todos os pacientes compartilhados com o whitelabel dele (decisão minha, ver abaixo).

### Regras de segurança

Regras não percorrem listas, então a checagem usa posições fixas de `sharedWith` (0, 1, 2), por isso o limite de 3. Uma função `sharedWithMe(origem, pacienteId)` faz um `get` do paciente e verifica se alguma das 3 posições é um whitelabel em que o usuário é membro ativo. Ela libera:

- leitura direta do paciente (documento do whitelabel de origem);
- leitura e escrita de `evolutions` e `anamneses` ligadas ao paciente (pelo campo `patientId` do documento).

Dentro do limite de 10 acessos por requisição. `sharedWith` só é validado como lista de até 3 strings e só muda se o usuário for gestor da origem ou admin.

### Agendamentos compartilhados

- Ao agendar um paciente compartilhado, o formulário mostra "Mostrar na agenda de: [whitelabels do paciente]". Padrão: desligado.
- Nos whitelabels marcados, o agendamento aparece na agenda como bloco **somente leitura**, com selo do whitelabel de origem. Quem o vê não edita nem exclui.
- Esse bloco **não impacta** o whitelabel que o vê: não entra em checagem de conflito de horário, em "Meu dia", em evolução pendente, em contagem de pacote nem no Painel. É só informação.
- Cópia-índice: as regras do Firestore não conseguem provar acesso numa consulta entre whitelabels (verificado no emulador). Por isso o agendamento marcado é copiado para `whitelabels/{destino}/sharedAppointments/{origem}__{id}`, que o destino lê como qualquer coleção dele. Quem agenda grava e mantém a cópia (criar, editar, excluir, trocar tag). A tag pode incluir o dono do paciente além dos whitelabels de `sharedWith`.
- Gravação de `sharedToWhitelabels` só passa se cada id também estiver em `sharedWith` do paciente.

### Telas

- **Pacientes (gestor):** nova ação "Compartilhar" (em lote, por seleção) abre um modal com a lista de pacientes e os whitelabels de destino. Whitelabels disponíveis: só os de `whitelabelLinks/{origem}.targets`, definidos pelo admin (o gestor pode não ser membro do outro lado). Sem vínculo liberado, a ação "Compartilhar" **não aparece** (decisão minha entre sumir e ficar desabilitada: sumir evita um botão morto que o gestor não consegue destravar sozinho). Badge "Compartilhado com X" na origem, "Compartilhado" no destino.
- **Lista de pacientes do destino:** mescla os próprios pacientes com a coleção `whitelabels/{destino}/sharedPatients/{origem}__{id}`, cópia do cadastro gravada junto com `sharedWith` pelo gestor da origem (em lote) e atualizada a cada edição do cadastro. Abrir o prontuário usa o paciente real na origem.
- **Prontuário e agenda:** quando o paciente é de outro whitelabel, os serviços usam o whitelabel de origem para evoluções e anamnese e gravam `patientWhitelabelId` no agendamento.
- **Pacotes:** criar pacote exige terapeuta (o próprio, se quem cria é terapeuta). O formulário de agendamento lista e vincula automaticamente só pacotes do terapeuta escolhido (e os antigos sem terapeuta). O Painel agrupa por terapeuta como hoje.

## Decisões minhas para revisar

- Limite de 3 whitelabels por paciente (por causa das regras).
- Terapeuta do destino vê todos os pacientes compartilhados com o whitelabel dele, não só os "dele". Posso refinar depois com atribuição por terapeuta.
- Pacotes antigos sem terapeuta ficam como estão.
- O gestor só enxerga e só compartilha com os whitelabels que o admin liberou em `whitelabelLinks`. As regras reforçam: `sharedWith` do paciente só aceita ids presentes em `targetIds` da origem, e tirar um vínculo não apaga compartilhamentos já feitos (o admin vê o aviso e o gestor descompartilha).
- O vínculo é direcional e sem aceite do outro lado: o admin decide. Cada compartilhamento fica em `auditLogs` com paciente, origem e destinos.
- Tag de agendamento começa desligada, para ninguém expor agenda sem querer.
- Descompartilhar tira o whitelabel da lista; evoluções já gravadas ficam no paciente.

## Fica para quem constrói

Forma exata dos testes de regras e do modal, e como tratar agendamentos antigos de um paciente já descompartilhado (o agendamento continua na agenda do destino, mas o paciente deixa de abrir).

## Complemento: agendamentos compartilhados em "Meu dia" (2026-11-17)

Pedido do usuário: o agendamento compartilhado também aparece em "Meu dia" no whitelabel que recebeu.

- Quem recebe vê, em "Meu dia", os blocos compartilhados de hoje com selo do whitelabel de origem e só duas ações: **Evoluir** e **Prontuário**. **Concluir** continua só do dono do agendamento.
- Visibilidade: gestor, recepção e admin veem todos; terapeuta vê só os que têm o e-mail dele em `therapistId`.
- Os cartões do Painel (agenda de hoje, capacidade, pendências, pacotes) continuam sem esses blocos.
- Evoluir grava a evolução no whitelabel do paciente e liga `evolutionId` ao agendamento de origem. Regra nova e estreita: gestor ou terapeuta de um whitelabel da tag altera no agendamento de origem **somente** `evolutionId` (e `updatedAt`), e na própria cópia somente `evolutionId`. Status nunca.
- A cópia passa a levar `evolutionId`, para o "Meu dia" esconder Evoluir depois de registrada.
- Limite: com a tag em mais de um destino, o `evolutionId` que um destino liga aparece na origem e na cópia dele; a cópia dos outros destinos só atualiza quando a origem editar de novo.

## Complemento: níveis de acesso por destino (2026-11-17)

Pedido do usuário: o gestor escolhe quanto o destino pode fazer. Três níveis aprovados:

| Nível | Ver cadastro e prontuário | Agendar, evoluir, anamnese | Editar cadastro |
|---|---|---|---|
| `LEITURA` | sim | não | não |
| `PADRAO` (é o de hoje) | sim | sim | não |
| `EDICAO` | sim | sim | sim |

- **Dados:** `Patient.sharedAccess?: Record<string, 'LEITURA' | 'PADRAO' | 'EDICAO'>`, chave = whitelabel de destino. Ausente = `PADRAO`, então nada que já foi compartilhado muda. A cópia do cadastro no destino (`sharedPatients`) leva `accessLevel` para a interface esconder o que o nível não permite.
- **Quem muda o nível:** só gestor da origem ou admin global, junto com `sharedWith` (as chaves precisam estar em `sharedWith`; valores só os três níveis).
- **Regras:** leitura do paciente e do prontuário vale para todos os níveis. Evolução e anamnese (criar, editar) exigem `PADRAO` ou `EDICAO`. Agendar paciente de outro whitelabel passa a exigir que o destino esteja em `sharedWith` do paciente e que o nível não seja `LEITURA` (isso também fecha um buraco de hoje: não há checagem de que o paciente de outro whitelabel foi mesmo compartilhado). Editar o cadastro no destino: gestor ou recepção com `EDICAO`, exceto `sharedWith`, `sharedAccess`, `whitelabelId`, `therapistId`, `therapistName` e `createdAt`; a cópia do destino pode ser atualizada pelo próprio destino nesse caso.
- **Interface:** no modal "Compartilhar", escolha do nível por destino e mudança de nível dos já compartilhados; selo "Compartilhado · só leitura/edição"; destino sem permissão não vê Evoluir, aba de evolução, salvar anamnese, escolha do paciente no agendamento nem Editar.
- **Limite:** quando o destino edita o cadastro, só a cópia dele atualiza na hora; as dos outros destinos atualizam quando o gestor da origem editar.
