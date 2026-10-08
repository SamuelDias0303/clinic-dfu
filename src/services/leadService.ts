import {
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Lead, LeadStatus, Patient } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';
import { patientService } from './patientService';
import { clinicalRecordService } from './clinicalRecordService';
import type { AjusteConversao } from '../lib/conversaoLead';

/** Resultado da conversao: o paciente sempre existe; a anamnese e "melhor esforco". */
export interface ConversaoResultado {
  patientId: string;
  /** NAO_SOLICITADA: sem texto de antecedentes; CRIADA: gravada; FALHOU: paciente criado, anamnese nao. */
  anamnese: 'NAO_SOLICITADA' | 'CRIADA' | 'FALHOU';
}

export interface ResultadoAplicacao {
  leadId: string;
  patientId: string;
  pacienteNome: string;
  ok: boolean;
  /** O que de fato foi gravado (pode ser menos que o previsto se alguem preencheu no meio tempo). */
  feito: string[];
  erro?: string;
}

export const leadService = {
  /** Usado pelo site publico e por testes. Sempre nasce com status NOVO. */
  async createLead(
    lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    whitelabelId?: string | null
  ) {
    const docRef = await addDoc(scopedCollection(COLLECTIONS.leads, whitelabelId), {
      ...withTenantField({ ...lead, status: 'NOVO' as LeadStatus }, whitelabelId),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  subscribeToLeads(
    callback: (leads: Lead[]) => void,
    whitelabelId?: string | null
  ) {
    const q = query(scopedCollection(COLLECTIONS.leads, whitelabelId));

    return onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Lead[];

      // Ordenacao no cliente evita exigir indice composto no Firestore,
      // seguindo o mesmo padrao de patientService.
      const sorted = [...leads].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      callback(sorted);
    }, (error) => {
      console.error('Error subscribing to leads:', error);
      callback([]);
    });
  },

  async updateLead(id: string, patch: Partial<Lead>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.leads, id, whitelabelId);
    await updateDoc(docRef, {
      ...withTenantField(patch, whitelabelId),
      updatedAt: serverTimestamp(),
    });
  },

  async updateStatus(id: string, status: LeadStatus, whitelabelId?: string | null) {
    await this.updateLead(id, { status }, whitelabelId);
  },

  /** "Deleta" de forma reversivel: o lead some das listas, mas o status e o historico ficam. */
  async setArquivado(id: string, arquivado: boolean, whitelabelId?: string | null) {
    await this.updateLead(id, { arquivado }, whitelabelId);
  },

  /**
   * Cria o paciente no whitelabel e marca o lead como convertido.
   * `patientData` vem preenchido/conferido pela tela, nao inferido aqui.
   *
   * `antecedentesPessoais` (opcional) preenche o campo "Antecedentes Pessoais" da
   * anamnese do paciente novo. So quem pode gravar anamnese (GESTOR, TERAPEUTA,
   * ADMIN_GLOBAL) deve passa-lo. Se a anamnese falhar, o paciente NAO e desfeito:
   * o resultado avisa e a tela mostra o texto para copiar.
   */
  async convertToPatient(
    leadId: string,
    patientData: Omit<Patient, 'id' | 'createdAt'>,
    whitelabelId?: string | null,
    antecedentesPessoais?: string
  ): Promise<ConversaoResultado> {
    const patientId = await patientService.createPatient(patientData, whitelabelId);
    await this.updateLead(
      leadId,
      { status: 'CONVERTIDO', convertedPatientId: patientId },
      whitelabelId
    );

    const texto = antecedentesPessoais?.trim();
    if (!texto) return { patientId, anamnese: 'NAO_SOLICITADA' };

    try {
      await clinicalRecordService.saveAnamnese(
        { patientId, mainComplaint: '', hda: '', personalHistory: texto, familyHistory: '' },
        whitelabelId
      );
      return { patientId, anamnese: 'CRIADA' };
    } catch (erro) {
      console.error('Paciente criado, mas a anamnese nao foi gravada:', erro);
      return { patientId, anamnese: 'FALHOU' };
    }
  },

  /**
   * Aplica os ajustes escolhidos na previa ("completar convertidos"), um paciente por vez.
   * Cada gravacao REVERIFICA o banco e so preenche o que continua vazio; a falha de um
   * paciente nao impede os outros.
   */
  async aplicarAjustes(ajustes: AjusteConversao[], whitelabelId?: string | null): Promise<ResultadoAplicacao[]> {
    const resultados: ResultadoAplicacao[] = [];
    for (const ajuste of ajustes) {
      const feito: string[] = [];
      try {
        if (ajuste.motherName || ajuste.address) {
          const gravado = await patientService.completarCadastro(
            ajuste.patientId,
            { motherName: ajuste.motherName, address: ajuste.address },
            whitelabelId
          );
          if (gravado.motherName) feito.push('nome da mae');
          if (gravado.address) feito.push('endereco');
        }
        if (ajuste.antecedentes) {
          const situacao = await clinicalRecordService.preencherAntecedentes(
            ajuste.patientId,
            ajuste.antecedentes.texto,
            whitelabelId
          );
          if (situacao !== 'JA_PREENCHIDA') feito.push('antecedentes pessoais');
        }
        resultados.push({ leadId: ajuste.leadId, patientId: ajuste.patientId, pacienteNome: ajuste.pacienteNome, ok: true, feito });
      } catch (erro) {
        console.error('Falha ao completar paciente', ajuste.patientId, erro);
        resultados.push({
          leadId: ajuste.leadId,
          patientId: ajuste.patientId,
          pacienteNome: ajuste.pacienteNome,
          ok: false,
          feito,
          erro: 'Nao foi possivel gravar (verifique as permissoes).',
        });
      }
    }
    return resultados;
  },

  async deleteLead(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.leads, id, whitelabelId);
    await deleteDoc(docRef);
  },
};
