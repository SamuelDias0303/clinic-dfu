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

/** Resultado da conversao: o paciente sempre existe; a anamnese e "melhor esforco". */
export interface ConversaoResultado {
  patientId: string;
  /** NAO_SOLICITADA: sem texto de antecedentes; CRIADA: gravada; FALHOU: paciente criado, anamnese nao. */
  anamnese: 'NAO_SOLICITADA' | 'CRIADA' | 'FALHOU';
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

  async deleteLead(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.leads, id, whitelabelId);
    await deleteDoc(docRef);
  },
};
