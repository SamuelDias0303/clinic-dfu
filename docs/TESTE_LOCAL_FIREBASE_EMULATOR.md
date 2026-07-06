# Teste local com Firebase Emulator

Este projeto pode rodar a interface em `http://127.0.0.1:3000`, mas isso nao garante isolamento do Firebase. Se o modo emulator nao estiver ativo, o app local usa o projeto configurado em `src/lib/firebase.ts` (`clinic-dfu`) e escritas no Firestore podem alterar dados desse projeto.

## Procedimento seguro

1. Confirme que voce esta no repositorio local:

   ```powershell
   cd C:\trabalho\codigo-fonte\clinic-dfu
   ```

2. Crie um arquivo `.env.local` para ligar o modo emulado:

   ```ini
   VITE_USE_FIREBASE_EMULATOR=true
   VITE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
   VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1
   VITE_FIRESTORE_EMULATOR_PORT=8080
   ```

3. Inicie os emuladores de Auth e Firestore:

   ```powershell
   npm run firebase:emulators:start
   ```

4. Em outro terminal, inicie a aplicacao ja apontando para os emuladores:

   ```powershell
   npm run dev:emulator
   ```

5. Acesse:

   - App: `http://127.0.0.1:3000`
   - Emulator UI: `http://127.0.0.1:4000`

6. Crie usuarios e dados de teste dentro do Emulator UI ou pelo proprio app local. Esses dados ficam no ambiente emulado e nao devem afetar o projeto Firebase real.

## Checklist do fluxo de back-office

1. Entrar com usuario de administrador global.
2. Abrir `Backoffice`.
3. Criar whitelabel preenchendo apenas Nome, Slug e Plano.
4. Confirmar que campos opcionais vazios, como Dominio, E-mail e Telefone, nao geram erro de `undefined`.
5. Editar a whitelabel e preencher Dominio, E-mail, Telefone e Cor primaria.
6. Associar um membro com e-mail, nome e papel.
7. Entrar com o usuario associado e confirmar que apenas os dados do whitelabel ativo ficam disponiveis.
8. Testar criar paciente, terapeuta, agendamento e evolucao dentro do whitelabel selecionado.
9. Trocar para outro whitelabel e confirmar que os dados anteriores nao aparecem.

## Observacao sobre producao

Nao execute `npm run firebase:deploy:firestore` durante testes locais. Esse comando publica regras e indices no Firebase real configurado pela CLI. Para homologar com seguranca, primeiro valide os fluxos no Emulator e depois combine uma janela de publicacao controlada.
