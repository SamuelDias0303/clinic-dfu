# Guia Operacional Clinic DFU

Este guia descreve, passo a passo, as principais acoes que podem ser feitas na aplicacao por administradores globais, gestores, recepcao e terapeutas.

## Ambiente Seguro De Uso

Durante a fase atual, use primeiro o ambiente local:

```text
http://127.0.0.1:3000
```

Nao publique regras do Firestore nem execute deploy real antes de validar a migracao e os fluxos localmente.

## Login E Recuperacao De Senha

1. Acesse `http://127.0.0.1:3000`.
2. Para entrar com e-mail e senha, preencha os campos e clique em `Entrar`.
3. Para recuperar uma senha, informe o e-mail e clique em `Esqueceu a senha?`.
4. Aguarde a mensagem de confirmacao de envio do link de recuperacao.
5. Para usar Google, mantenha a tela no modo de login e clique em `Entrar com Google`.
6. Para criar uma conta nova por e-mail e senha, clique em `Criar agora`, preencha os dados e clique em `Criar Conta`.

Observacoes:

- A opcao `Entrar com Google` aparece somente na tela de login.
- A tela `Criar Conta` e exclusiva para cadastro por e-mail e senha, para evitar confusao entre cadastro local e login social.

## Perfis E Acessos

### ADMIN_GLOBAL

Usa o Backoffice global para criar e gerenciar whitelabels.

Pode acessar:

- Backoffice
- Recursos IA

Nao deve operar dados clinicos diretamente. O app direciona esse perfil para o Backoffice.

### GESTOR

Gerencia a operacao de uma whitelabel ativa.

Pode acessar:

- Painel
- Agenda
- Pacientes
- Terapeutas
- Prontuario

### REPCAO

Opera agenda e cadastros dentro da whitelabel ativa.

Pode acessar:

- Painel
- Agenda
- Pacientes

### TERAPEUTA

Opera seus atendimentos e registros clinicos dentro da whitelabel ativa.

Pode acessar:

- Painel
- Agenda
- Pacientes
- Prontuario

## Acesso Inicial Como Administrador Global

No ambiente local, existe um fallback temporario para facilitar desenvolvimento.

1. Acesse `http://127.0.0.1:3000`.
2. Clique em `Criar agora`, se ainda nao tiver uma conta.
3. Crie ou entre com um e-mail que contenha `admin`, por exemplo `admin@clinicdfu.local`.
4. Informe a senha.
5. Clique em `Entrar`.
6. O app deve abrir ou direcionar para `Backoffice`.

Para producao, nao use esse fallback. O acesso correto deve ser por custom claim do Firebase ou documento `users/{uid}` com `roles: ["ADMIN_GLOBAL"]`.

## Backoffice: Criar Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse o menu lateral.
2. Clique em `Backoffice`.
3. Clique em `Novo Whitelabel`.
4. Preencha `Nome`.
5. Revise o `Slug` gerado automaticamente.
6. Preencha `Dominio`, se existir.
7. Preencha `Plano`.
8. Preencha `E-mail de contato` e `Telefone`, se existirem.
9. Escolha a `Cor primaria`.
10. Confirme o `Status` como `ATIVO`.
11. Revise `Unidade padrao`.
12. Revise `Tipos de agendamento`.
13. Clique em `Salvar Whitelabel`.

Resultado esperado:

- A nova whitelabel aparece na tabela do Backoffice.
- O status aparece como `ATIVO`.
- O registro fica disponivel para associacao de membros.

## Backoffice: Acessar Ambiente Legado

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize `Clinic DFU - Legado`.
3. Clique no icone de entrada na coluna `Acoes`.
4. O app abre o contexto `legacy-default`.
5. Use `Pacientes`, `Agenda` e `Terapeutas` para gerenciar os dados antigos.

Para voltar ao Backoffice global, clique em `Trocar Perfil` no topo e selecione `Administrador Global`.

## Backoffice: Convidar Gestor

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel na tabela.
3. Clique em `Membros`.
4. Preencha `Nome` e `E-mail`.
5. Marque o papel `GESTOR`.
6. Clique em `Gerar Convite`.
7. Clique em `Copiar link`.
8. Envie o link ao gestor.

Resultado esperado:

- O link de convite aparece na tela para copiar.
- O membro aparece como `PENDENTE` enquanto nao aceitar o convite.
- O gestor abre o link, define a senha e ativa a propria conta.
- O membro aparece na lista depois do aceite, sem duplicar por e-mail e UID.
- Depois do aceite, o gestor entra normalmente pela tela de login.

## Gestao: Convidar Recepcao Ou Terapeuta

Perfil necessario: `GESTOR`.

1. Entre na aplicacao com a conta de gestor.
2. Confirme que a whitelabel ativa aparece no topo.
3. Acesse `Gestao` no menu lateral.
4. Clique em `Membros`.
5. Preencha `Nome` e `E-mail`.
6. Marque `REPCAO` ou `TERAPEUTA`.
7. Clique em `Gerar Convite`.
8. Copie o link e envie ao usuario.

Resultado esperado:

- O usuario convidado ativa a conta pelo link.
- O membro aparece na lista depois do aceite.
- O acesso fica limitado a mesma whitelabel do gestor.
- O gestor nao consegue convidar outro `GESTOR`.

## Backoffice: Editar Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel na tabela.
3. Clique no icone de lapis.
4. Ajuste os campos necessarios.
5. Clique em `Salvar Whitelabel`.

Use esta acao para alterar nome, dominio, plano, cor primaria, contato e configuracoes principais.

## Backoffice: Suspender Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel ativa.
3. Clique no icone de energia.
4. Confirme a acao de suspender.

Resultado esperado:

- O status muda para `SUSPENSO`.
- A whitelabel deve ser tratada como indisponivel nos fluxos finais de operacao.

## Backoffice: Reativar Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel suspensa.
3. Clique no icone de energia.
4. Confirme a reativacao.

Resultado esperado:

- O status volta para `ATIVO`.

## Backoffice: Arquivar Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel.
3. Clique no icone de arquivo.
4. Confirme a acao.

Resultado esperado:

- O status muda para `ARQUIVADO`.
- Nenhum dado clinico e apagado por essa acao.

## Backoffice: Vincular Membros A Uma Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel.
3. Clique no icone de usuarios.
4. No modal `Membros do Whitelabel`, preencha `Nome`.
5. Preencha `E-mail`.
6. Preencha `UID Firebase`, se ja tiver o UID do usuario.
7. Se nao tiver o UID, deixe em branco; o e-mail sera usado como identificador temporario.
8. Selecione um ou mais papeis:
   - `GESTOR`
   - `REPCAO`
   - `TERAPEUTA`
9. Se o membro for terapeuta, preencha `Terapeuta ID` quando ja souber o identificador usado no cadastro do terapeuta.
10. Clique em `Adicionar Membro`.

Resultado esperado:

- O membro aparece na lista da whitelabel.
- Quando esse usuario entrar, o app tenta reconhecer a associacao por `userId` ou por `email`.

## Backoffice: Remover Membro De Uma Whitelabel

Perfil necessario: `ADMIN_GLOBAL`.

1. Acesse `Backoffice`.
2. Localize a whitelabel.
3. Clique no icone de usuarios.
4. Encontre o membro.
5. Clique no icone de lixeira.
6. Confirme a remocao.

Resultado esperado:

- O vinculo do membro com a whitelabel e removido.
- A conta Firebase Auth do usuario nao e apagada.

## Fluxo Recomendado Para Criar Uma Nova Whitelabel Operacional

1. Entrar como `ADMIN_GLOBAL`.
2. Criar a whitelabel no `Backoffice`.
3. Associar pelo menos um membro com papel `GESTOR`.
4. O gestor entra na aplicacao.
5. O gestor seleciona a whitelabel, se tiver acesso a mais de uma.
6. O gestor cadastra terapeutas.
7. O gestor ou recepcao cadastra pacientes.
8. O gestor ou recepcao cria agendamentos.
9. O terapeuta acessa agenda/pacientes e registra evolucoes.

## Gestor: Cadastrar Terapeuta

Perfil necessario: `GESTOR`.

1. Entrar na aplicacao.
2. Selecionar o perfil `GESTOR`, se solicitado.
3. Selecionar a whitelabel ativa, se solicitado.
4. Acessar `Terapeutas`.
5. Clicar em `Novo Terapeuta`.
6. Preencher nome, e-mail, especialidade, status, avaliacao e unidades.
7. Clicar em `Salvar Terapeuta`.

Resultado esperado:

- O terapeuta aparece na lista da whitelabel ativa.

## Gestor: Editar Ou Excluir Terapeuta

Perfil necessario: `GESTOR`.

1. Acessar `Terapeutas`.
2. Localizar o terapeuta.
3. Passar o mouse sobre o card para exibir as acoes.
4. Clicar no lapis para editar.
5. Clicar na lixeira para excluir.
6. Confirmar a exclusao quando solicitada.

## Gestor Ou Recepcao: Cadastrar Paciente

Perfis permitidos: `GESTOR`, `REPCAO`.

1. Acessar `Pacientes`.
2. Clicar em `Novo Paciente`.
3. Preencher nome completo.
4. Preencher CPF, data de nascimento do paciente, telefone, e-mail, convenio e endereco.
5. Se desejar, preencher nome do pai, nome da mae e link de localizacao da casa.
6. Selecionar status.
7. Se estiver como gestor, escolher o terapeuta responsavel ou deixar sem terapeuta para vincular a plataforma.
8. Clicar em `Salvar Paciente`.

Resultado esperado:

- O paciente aparece na lista da whitelabel ativa.
- Os campos pai, mae e localizacao podem ficar vazios sem impedir o cadastro.
- Quando informado, o link de localizacao deve iniciar com `http://` ou `https://`.

## Gestor Ou Recepcao: Editar Ou Excluir Paciente

Perfis permitidos: `GESTOR`, `REPCAO`.

1. Acessar `Pacientes`.
2. Localizar o paciente pela busca.
3. Clicar no lapis para editar.
4. Clicar na lixeira para excluir.
5. Confirmar a exclusao quando solicitada.

## Gestor, Recepcao Ou Terapeuta: Criar Agendamento

Perfis permitidos: `GESTOR`, `REPCAO`, `TERAPEUTA`.

1. Acessar `Agenda`.
2. Clicar em `Novo Agendamento` ou clicar em um horario livre na agenda.
3. Se estiver como gestor, selecionar o terapeuta.
4. Buscar e selecionar o paciente.
5. Definir data e horario.
6. Selecionar tipo de atendimento.
7. Escolher recorrencia, se necessario.
8. Definir status.
9. Preencher observacoes administrativas, se necessario.
10. Clicar em `Salvar Agendamento`.

Resultado esperado:

- O agendamento aparece na agenda da whitelabel ativa.
- Se houver conflito de horario para o mesmo terapeuta, o app bloqueia o salvamento.

## Gestor, Recepcao Ou Terapeuta: Editar Agendamento

Perfis permitidos: `GESTOR`, `REPCAO`, `TERAPEUTA`.

1. Acessar `Agenda`.
2. Clicar no card do agendamento.
3. Alterar data, horario, status, paciente, terapeuta ou observacoes.
4. Clicar em `Salvar Agendamento`.

## Gestor, Recepcao Ou Terapeuta: Excluir Agendamento

Perfis permitidos: `GESTOR`, `REPCAO`, `TERAPEUTA`.

1. Acessar `Agenda`.
2. Clicar no icone de lixeira no card do agendamento ou abrir o agendamento.
3. Confirmar a exclusao.
4. Se o agendamento fizer parte de uma recorrencia, escolher se a exclusao sera individual ou da serie, quando a opcao estiver disponivel.

## Terapeuta: Acessar Pacientes Vinculados

Perfil necessario: `TERAPEUTA`.

1. Entrar na aplicacao.
2. Selecionar o perfil `TERAPEUTA`, se solicitado.
3. Selecionar a whitelabel ativa, se solicitado.
4. Acessar `Pacientes`.

Resultado esperado:

- O terapeuta visualiza pacientes conforme o filtro por terapeuta aplicado no app.

## Terapeuta: Abrir Prontuario

Perfil necessario: `TERAPEUTA`.

1. Acessar `Pacientes`.
2. Localizar o paciente.
3. Clicar em `Prontuario`.

Resultado esperado:

- A tela do prontuario abre com historico, anamnese e evolucao.

## Terapeuta: Registrar Evolucao No Prontuario

Perfil necessario: `TERAPEUTA`.

1. Abrir o prontuario do paciente.
2. Acessar a aba `EVOLUIR`.
3. Escrever a evolucao clinica.
4. Clicar em `SALVAR` para rascunho.
5. Clicar em `FINALIZAR` para evolucao finalizada.

Resultado esperado:

- A evolucao aparece no historico do prontuario.

## Terapeuta Ou Gestor: Registrar Anamnese

Perfis permitidos: `TERAPEUTA`, `GESTOR`.

1. Abrir o prontuario do paciente.
2. Acessar a aba `ANAMNESE`.
3. Preencher diagnostico, se houver.
4. Preencher queixa principal.
5. Preencher HDA.
6. Preencher antecedentes pessoais.
7. Preencher antecedentes familiares.
8. Clicar em `SALVAR ANAMNESE`.

Resultado esperado:

- A anamnese fica vinculada ao paciente dentro da whitelabel ativa.
- O diagnostico fica disponivel na propria aba `ANAMNESE` quando o prontuario for aberto novamente.

## Trocar Perfil

Disponivel quando o usuario possui mais de um papel.

1. No topo da aplicacao, clicar em `Trocar Perfil`.
2. Escolher o perfil desejado.

## Trocar Whitelabel

Disponivel quando o usuario possui associacao ativa com mais de uma whitelabel.

1. No topo da aplicacao, clicar no nome da whitelabel ativa.
2. Escolher outro ambiente.

Resultado esperado:

- As telas passam a usar os dados da nova whitelabel selecionada.

## Checklist Local Antes De Produzir

1. Rodar `npm run lint`.
2. Rodar `npm run build`.
3. Entrar como `ADMIN_GLOBAL`.
4. Criar uma whitelabel de teste.
5. Vincular um gestor.
6. Entrar como gestor.
7. Criar terapeuta.
8. Criar paciente.
9. Criar agendamento.
10. Entrar como terapeuta.
11. Validar acesso a pacientes/agendamentos.
12. Registrar evolucao.
13. Validar matriz `docs/WHITELABEL_SECURITY_MATRIX.md`.
14. Validar migracao `docs/WHITELABEL_MIGRATION.md`.
15. Somente depois disso considerar deploy de regras/indices.

## Observacoes Importantes

- O fallback de administrador por e-mail contendo `admin` e temporario para desenvolvimento local.
- Em producao, use custom claims ou `users/{uid}` para definir papeis.
- Arquivar whitelabel nao apaga dados clinicos.
- Remover membro nao remove a conta Firebase Auth.
- Nao publique `firestore.rules` enquanto o ambiente real ainda depender das colecoes globais antigas.
