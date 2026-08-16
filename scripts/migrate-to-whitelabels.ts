/**
 * Migra as colecoes globais para o modelo `whitelabels/{id}/...`.
 *
 * CONTEXTO
 *
 * Todo o dado clinico ainda vive nas colecoes de raiz (`patients`,
 * `appointments`, ...). O `firestore.rules` do repositorio bloqueia essas
 * colecoes (`allow read, write: if false`), entao publicar as regras antes de
 * migrar deixaria a clinica sem sistema.
 *
 * O roteamento e por `therapistId`, que nesta base e o E-MAIL do profissional —
 * mesmo valor usado como id do documento em `therapists`. `anamneses` nao tem
 * `therapistId`, entao herda o do paciente.
 *
 * NAO usar `legacy-default` como destino: esse id e o valor-sentinela de
 * `serviceScope.isLegacyWhitelabel()`, que faz os services caírem de volta nas
 * colecoes globais. Dado migrado para la nunca seria lido.
 *
 * SEGURANCA
 *
 * - Dry-run por padrao. Escreve somente com `--apply`.
 * - Copia, nunca move: as colecoes globais ficam intactas como rede de seguranca.
 * - Preserva o id de cada documento, para que `patientId`, `evolutionId` e
 *   `recurrenceId` continuem validos.
 * - Rode `npm.cmd run backup` antes.
 *
 * USO
 *
 *   npm.cmd run migrate:whitelabels            # relatorio, nao escreve nada
 *   npm.cmd run migrate:whitelabels -- --apply # executa
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json');

interface DestinoTenant {
  whitelabelId: string;
  name: string;
  slug: string;
  /** E-mail do profissional; e o `therapistId` usado nos documentos clinicos. */
  therapistEmail: string;
  ownerUid: string;
  ownerName: string;
}

/**
 * Um whitelabel por profissional, conforme decidido: praticas separadas.
 * Dados de `smdb.ti@gmail.com` e do orfao `default-therapist` sao de teste e
 * ficam para tras de proposito.
 */
const DESTINOS: DestinoTenant[] = [
  {
    whitelabelId: 'raiza-fisio',
    name: 'Raiza Freitas - Fisioterapia Pediatrica',
    slug: 'raiza-fisio',
    therapistEmail: 'raiza.fisio@gmail.com',
    ownerUid: 'VX6Yt94EHdddjaYPhvdSHIzmKjK2',
    ownerName: 'Raiza Freitas',
  },
  {
    whitelabelId: 'rafaela-fisio',
    name: 'Rafaela Silveira - Fisioterapia',
    slug: 'rafaela-fisio',
    therapistEmail: 'rafaela.rafa.silveira@gmail.com',
    ownerUid: 'cLqjefavfqQJ9JN7CKwqz0goJN22',
    ownerName: 'Rafaela Silveira',
  },
];

async function main() {
  const apply = process.argv.includes('--apply');

  if (!existsSync(KEY_PATH)) {
    console.error(`Chave de servico nao encontrada em ${KEY_PATH}`);
    process.exit(1);
  }

  let admin: typeof import('firebase-admin');
  try {
    admin = await import('firebase-admin');
  } catch {
    console.error('firebase-admin nao instalado. Rode: npm i -D firebase-admin');
    process.exit(1);
  }

  const credentials = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore(app);

  console.log(`\n${apply ? '*** MODO APPLY — vai escrever no Firestore ***' : 'Dry-run: nada sera escrito.'}\n`);

  // --- Carrega as colecoes globais uma vez -----------------------------------
  const ler = async (nome: string) => (await db.collection(nome).get()).docs;
  const [patients, therapists, appointments, evolutions, anamneses] = await Promise.all([
    ler('patients'), ler('therapists'), ler('appointments'), ler('evolutions'), ler('anamneses'),
  ]);

  /** patientId -> therapistId, para rotear anamneses. */
  const donoDoPaciente = new Map<string, string>();
  patients.forEach((d) => donoDoPaciente.set(d.id, d.data().therapistId));

  const problemas: string[] = [];
  let escritos = 0;

  for (const destino of DESTINOS) {
    const { whitelabelId, therapistEmail } = destino;

    const meusPacientes = patients.filter((d) => d.data().therapistId === therapistEmail);
    const meusIds = new Set(meusPacientes.map((d) => d.id));
    const meusTerapeutas = therapists.filter((d) => d.id === therapistEmail || d.data().email === therapistEmail);
    const meusAgendamentos = appointments.filter((d) => d.data().therapistId === therapistEmail);
    const minhasEvolucoes = evolutions.filter((d) => d.data().therapistId === therapistEmail);
    const minhasAnamneses = anamneses.filter((d) => donoDoPaciente.get(d.data().patientId) === therapistEmail);

    // Integridade referencial. Documento clinico apontando para paciente que
    // nao vem junto vira referencia pendurada no tenant novo.
    //
    // Esses documentos SAO migrados mesmo assim: sao do profissional (pelo
    // therapistId) e evolucao finalizada e registro clinico, que nao se
    // descarta. O relatorio existe para a correcao ser feita depois, com
    // conhecimento de causa.
    const registrarPendencia = (colecao: string, docId: string, pid: string) => {
      const existeGlobal = donoDoPaciente.has(pid);
      problemas.push(
        existeGlobal
          ? `${colecao}/${docId}: paciente ${pid} pertence a outro profissional (${donoDoPaciente.get(pid)})`
          : `${colecao}/${docId}: paciente ${pid} nao existe mais (apagado antes da migracao)`
      );
    };

    for (const evo of minhasEvolucoes) {
      const pid = evo.data().patientId;
      if (pid && !meusIds.has(pid)) registrarPendencia('evolutions', evo.id, pid);
    }
    for (const ag of meusAgendamentos) {
      const pid = ag.data().patientId;
      if (pid && !meusIds.has(pid)) registrarPendencia('appointments', ag.id, pid);
    }

    console.log(`=== ${whitelabelId} (${therapistEmail}) ===`);
    console.log(`  therapists   ${meusTerapeutas.length}`);
    console.log(`  patients     ${meusPacientes.length}`);
    console.log(`  appointments ${meusAgendamentos.length}`);
    console.log(`  evolutions   ${minhasEvolucoes.length}`);
    console.log(`  anamneses    ${minhasAnamneses.length}`);
    console.log(`  members      1 (${destino.ownerName}, GESTOR+TERAPEUTA)`);

    if (!apply) {
      console.log('');
      continue;
    }

    const lote = db.bulkWriter();

    lote.set(db.doc(`whitelabels/${whitelabelId}`), {
      name: destino.name,
      slug: destino.slug,
      status: 'ATIVO',
      plan: 'Clinica',
      workspaceType: 'CLINICA',
      ownerUserId: destino.ownerUid,
      contactEmail: therapistEmail,
      branding: { primaryColor: '#0066ff' },
      settings: {
        defaultUnitName: 'Atendimento',
        appointmentTypes: ['Consulta', 'Avaliacao', 'Retorno'],
        therapistSpecialties: ['Fisioterapia Pediatrica'],
        enabledFeatures: ['agenda', 'pacientes', 'prontuario', 'captacao'],
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    lote.set(db.doc(`whitelabels/${whitelabelId}/members/${destino.ownerUid}`), {
      whitelabelId,
      whitelabelName: destino.name,
      userId: destino.ownerUid,
      email: therapistEmail,
      name: destino.ownerName,
      roles: ['GESTOR', 'TERAPEUTA'],
      status: 'ATIVO',
      therapistId: therapistEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    escritos += 2;

    const copiar = (docs: FirebaseFirestore.QueryDocumentSnapshot[], sub: string) => {
      for (const origem of docs) {
        lote.set(
          db.doc(`whitelabels/${whitelabelId}/${sub}/${origem.id}`),
          { ...origem.data(), whitelabelId },
          { merge: true }
        );
        escritos += 1;
      }
    };

    copiar(meusTerapeutas, 'therapists');
    copiar(meusPacientes, 'patients');
    copiar(meusAgendamentos, 'appointments');
    copiar(minhasEvolucoes, 'evolutions');
    copiar(minhasAnamneses, 'anamneses');

    await lote.close();
    console.log('  -> gravado\n');
  }

  // --- O que fica para tras ---------------------------------------------------
  const emailsMigrados = DESTINOS.map((d) => d.therapistEmail);
  const foraPacientes = patients.filter((d) => !emailsMigrados.includes(d.data().therapistId));
  const foraAgend = appointments.filter((d) => !emailsMigrados.includes(d.data().therapistId));
  const foraEvo = evolutions.filter((d) => !emailsMigrados.includes(d.data().therapistId));

  console.log('=== nao migrado (dado de teste, por decisao) ===');
  console.log(`  patients ${foraPacientes.length} | appointments ${foraAgend.length} | evolutions ${foraEvo.length}`);
  const responsaveis = new Set([
    ...foraPacientes.map((d) => d.data().therapistId),
    ...foraAgend.map((d) => d.data().therapistId),
    ...foraEvo.map((d) => d.data().therapistId),
  ]);
  console.log(`  therapistId: ${[...responsaveis].join(', ') || '(nenhum)'}\n`);

  if (problemas.length) {
    console.log('=== REFERENCIAS PENDURADAS (pre-existentes, migradas mesmo assim) ===');
    problemas.slice(0, 20).forEach((p) => console.log(`  ${p}`));
    if (problemas.length > 20) console.log(`  ... e mais ${problemas.length - 20}`);
    console.log('');
  } else {
    console.log('Integridade referencial: nenhum documento aponta para paciente de outro tenant.\n');
  }

  if (apply) {
    console.log(`${escritos} documento(s) gravado(s).`);
    console.log('As colecoes globais continuam intactas — nada foi apagado.\n');
  } else {
    console.log('Rode com --apply para executar. Faca `npm.cmd run backup` antes.\n');
  }
}

main().catch((error) => {
  console.error('Falhou:', error instanceof Error ? error.message : error);
  process.exit(1);
});
