# Requisitos

## Aceite Basico

- O TypeScript compila com `npm run lint`.
- O build de producao conclui com `npm run build`.
- A navegacao continua sensivel ao papel ativo do usuario.
- O comportamento do menu lateral em telas pequenas continua funcionando.
- Toda nova interface segue o contrato visual de `DESIGN.md`.
- Dashboard nao exibe tendencias hardcoded ou percentuais aparentes sem fonte de dados real.
- Componentes visuais principais mantem conteudo legivel e acoes acessiveis em mobile e desktop.
- Tabelas, toolbars e grades de agenda podem rolar horizontalmente quando a densidade de dados nao cabe na tela.

## Aceite De Whitelabel

- `ADMIN_GLOBAL` consegue criar, editar, suspender/reativar e excluir ou arquivar whitelabels.
- Cada whitelabel possui configuracoes proprias: nome, slug/dominio, status, plano, tokens de marca, dados de contato e flags opcionais de funcionalidade.
- Cada whitelabel pode manter uma lista propria de modalidades terapeuticas para classificar terapeutas convidados ou ja ativos.
- A area administrativa permite associar terapeutas e pacientes a um whitelabel.
- Usuarios de tenant enxergam apenas whitelabels em que possuem associacao explicita.
- `GESTOR` gerencia terapeutas, pacientes, agendamentos e prontuarios apenas dentro do whitelabel ativo.
- `GESTOR` e `ADMIN_GLOBAL` podem convidar terapeutas e definir ou alterar a modalidade terapeutica do membro depois.
- `REPCAO` acessa apenas fluxos de recepcao dentro do whitelabel ativo.
- `TERAPEUTA` acessa apenas seus pacientes, agendamentos e prontuarios permitidos dentro do whitelabel ativo.
- Se um usuario tiver acesso a mais de um whitelabel, o app exige selecao explicita do whitelabel ativo.
- Todo documento sensivel e gravado em um caminho de tenant ou possui identificador imutavel de whitelabel validado por regras.
- Leituras e escritas entre whitelabels diferentes sao bloqueadas por regras do Firestore, nao apenas escondidas pela UI.
- As telas existentes mantem seus fluxos atuais depois da aplicacao do escopo por whitelabel.
- Estados de vazio, carregamento, permissao negada e whitelabel suspenso sao exibidos de forma explicita.
- A tela de terapeutas nao permite criar novo terapeuta diretamente; novos terapeutas entram por convite em gerenciamento de membros.
- Cadastro de paciente permite informar, de forma opcional, nome do pai, nome da mae e link de localizacao da casa.
- Prontuario permite registrar diagnostico dentro da anamnese, mantendo compatibilidade com anamneses antigas sem esse campo.
- Login por e-mail/senha permite solicitar recuperacao de senha pelo e-mail informado.
- Recuperacao de senha possui tela dedicada, acessivel pelo login, com campo de e-mail, estado de envio, retorno ao login e mensagem generica quando a solicitacao e processada.
- Recuperacao de senha nao deve revelar se o e-mail informado existe ou nao na base de autenticacao.
- Login com Google nao deve sobrescrever ou interferir em conta existente criada por e-mail/senha; conflitos de credencial devem orientar o usuario a entrar pelo metodo original.
- Criacao por e-mail/senha nao deve criar duplicidade quando o e-mail ja possui conta por outro metodo de acesso.
- Modo de criacao de conta exibe apenas o fluxo de criacao por e-mail e senha, sem chamada para login com Google.

## Aceite De Seguranca E Isolamento

- Papeis e associacoes de whitelabel vem de dados persistidos confiaveis ou custom claims, nao de verificacao por texto no e-mail.
- Regras do Firestore negam acesso nao autenticado a dados operacionais e clinicos.
- Regras do Firestore impedem usuarios de tenant de listar dados globais de outros tenants.
- Escritas nao podem falsificar outro `whitelabelId`, outro terapeuta ou outra associacao de paciente.
- Prontuarios nao podem ser acessados por tentativa de adivinhar IDs de outro whitelabel.
- Operacoes de admin global sao separadas de operacoes de tenant nas regras e no codigo dos services.
- Existe uma matriz de teste cobrindo acesso permitido no mesmo whitelabel e acesso negado entre whitelabels para pacientes, terapeutas, agendamentos, evolucoes e anamneses.

## Melhorias De Implementacao E Codigo

- Substituir a inferencia de papel em `AuthContext` por documento de perfil de usuario e/ou Firebase custom claims.
- Centralizar o estado de autorizacao em um `TenantContext` ou em um auth context expandido com `activeWhitelabelId`, associacoes e papel ativo.
- Criar helpers tipados de colecao para evitar consultas acidentais em colecoes globais.
- Renomear `clients` para `whitelabels` no codigo ou criar camada de compatibilidade com nomes claros antes da migracao.
- Remover imports nao utilizados dos services enquanto os arquivos forem alterados.
- Extrair ordenacao em memoria e tratamento de erro de subscriptions para pequenas utilidades compartilhadas.
- Criar indices do Firestore de forma intencional depois que as consultas por tenant estiverem definidas.
- Adicionar testes focados para construcao de caminhos, helpers de permissao e estados criticos da UI.
- Corrigir problemas existentes de codificacao dos textos em portugues conforme os arquivos forem tocados.
- Extrair ou nomear constantes de capacidade operacional usadas por metricas para evitar numeros magicos sem contexto.

## Fora Do Escopo Da Primeira Fatia

- Nao introduzir uma nova biblioteca de componentes.
- Nao reconstruir todo o sistema visual alem dos tokens necessarios de whitelabel.
- Nao adicionar multi-regiao ou um projeto Firebase por tenant sem decisao explicita.
- Nao depender de filtros no frontend como mecanismo principal de isolamento de dados.
