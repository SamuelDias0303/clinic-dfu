# Modulo Captacao

Registro da Sprint 23.

## Objetivo

Receber solicitacoes vindas do site publico de um whitelabel e gerenciar o conteudo desse site, sem que
ninguem precise editar codigo para trocar um texto, um depoimento ou uma foto.

O primeiro consumidor e a landing page da Dra. Raiza Freitas, em
`C:\trabalho\codigo-fonte\landing-page-raiza`.

## Por que lead e nao appointment

`Appointment` exige `patientId`, `therapistId`, `date` e `type` — e uma consulta ja marcada. O que chega do
site e um contato bruto: alguem que preencheu um formulario e ainda nao e paciente.

Criar `Patient` direto encheria a base clinica de curioso, duplicata e spam, e paciente e dado clinico sob
LGPD. Por isso existe `Lead`, com triagem propria e conversao explicita.

## Estrutura no Firestore

```text
whitelabels/{whitelabelId}/leads/{leadId}
whitelabels/{whitelabelId}/siteContent/landing
```

Storage:

```text
whitelabels/{whitelabelId}/site/{slot}.{ext}
```

## Fluxo

1. Visitante preenche o formulario no site publico.
2. O site grava direto em `leads` — unica escrita anonima do sistema.
3. O lead aparece em **Captacao > Solicitacoes** com status `NOVO`.
4. Recepcao ou gestor tria: `EM_CONTATO`, `AGENDADO`, `DESCARTADO`, e registra notas internas.
5. **Converter em paciente** abre o rascunho, o operador completa os dados e o `patientService` cria o
   `Patient` no whitelabel. O lead vai para `CONVERTIDO` guardando `convertedPatientId`.

O rascunho nao inventa CPF, data de nascimento nem parentesco. O formulario pergunta "responsavel", que pode
ser mae ou pai — presumir isso gravaria dado errado num prontuario.

## Seguranca

`leads` e a unica colecao que aceita `create` sem autenticacao. A validacao em `isValidLeadCreate`
(`firestore.rules`) trabalha com **lista fechada** de campos permitidos, nao com lista de proibidos:

- `keys().hasOnly(leadAllowedKeys())` e `hasAll(leadRequiredKeys())`
- `whitelabelId` tem que bater com o caminho
- `status` obrigatoriamente `NOVO`, `consentimento` obrigatoriamente `true`
- `createdAt == request.time`
- teto por string (nome 120, observacoes 1000) e no maximo 10 preocupacoes
- **nenhuma leitura publica** — quem envia nao recupera nada

`isValidLeadTriage` impede que o operador reescreva o que a pessoa enviou: so `status`, `notasInternas`,
`convertedPatientId` e `updatedAt` podem mudar. Isso preserva a integridade da prova de consentimento.

Um campo novo no formulario exige alteracao em **tres** lugares:

1. `src/types.ts` — `Lead` e `LEAD_LIMITS`
2. `firestore.rules` — `leadAllowedKeys` e `isValidLeadCreate`
3. `landing-page-raiza/src/lib/clinicContract.ts` — contrato espelhado

O script `npm run test:contract` no repositorio da landing page compara 1 e 3 com 2 e falha se divergirem.

## Conteudo do site

`siteContent/landing` tem leitura publica (e conteudo de site) e escrita restrita a `ADMIN_GLOBAL` e
`GESTOR`. A aba **Conteudo do site** edita secao por secao, com adicionar/remover/reordenar em depoimentos,
FAQ, sintomas e passos.

Trechos entre `*asteriscos*` viram destaque visual no site; entre `**duplos**`, negrito. Serve para a
profissional editar uma frase inteira num campo so, sem lidar com HTML.

O site nao usa o SDK do Firestore para ler esse documento — faz uma chamada REST simples. O SDK custa
~170 kB gzip e nao se justifica para ler um documento publico numa pagina cujo publico acessa por 4G. O SDK
so entra quando alguem envia o formulario.

### Primeira carga

O documento comeca vazio. Para popular com o que ja esta no ar, rode `npm run content:seed` no repositorio
da landing page e importe o `site-content.seed.json` gerado pelo botao **Importar JSON**.

## Imagens

Upload direto para o Storage pela aba Conteudo, com validacao de tipo e teto de 5 MB. As dimensoes sao lidas
do arquivo e gravadas junto, para o site manter `width`/`height` no HTML e nao reintroduzir layout shift.

`storage.rules` da leitura publica apenas em `whitelabels/{id}/site/**` e escrita apenas para `GESTOR` ou
`ADMIN_GLOBAL` do whitelabel.

## Arquivos

| Arquivo | Papel |
| :--- | :--- |
| `src/views/CaptacaoView.tsx` | Abas Solicitacoes e Conteudo, tabela, filtros, export CSV |
| `src/components/LeadDetailModal.tsx` | Detalhe, triagem e conversao em paciente |
| `src/components/SiteContentEditor.tsx` | Editor por secao, import/export JSON |
| `src/components/SiteImagesPanel.tsx` | Upload e alt text por slot |
| `src/services/leadService.ts` | CRUD de leads e `convertToPatient` |
| `src/services/siteContentService.ts` | Conteudo e upload de imagem |

## Pendencias

- **Firebase Storage nao esta provisionado no projeto `clinic-dfu`.** A config web ja tem `storageBucket`,
  mas o servico nunca foi iniciado — `firebase deploy --only storage` falha com "Firebase Storage has not
  been set up". Enquanto isso, o upload de imagens da aba Conteudo nao funciona; o resto do modulo funciona
  normalmente. Ativar em Console > Storage > "Get Started", escolhendo a mesma regiao do Firestore.
- Regras nao publicadas. `firestore.rules` ja compila sem erro (`firebase deploy --only firestore:rules
  --dry-run`), mas compilar nao e o mesmo que se comportar como esperado — validar no emulador conforme
  `.planning/STATE.md`.
- App Check nao configurado. Enforcement vale para o projeto inteiro: registrar backoffice e landing antes
  de ligar, e observar em modo monitoramento primeiro.
- Sem notificacao automatica quando chega solicitacao — exigiria Cloud Functions e plano Blaze.
- Sem prazo de retencao definido para leads. Dado de saude de bebe sob LGPD merece politica publicada.
