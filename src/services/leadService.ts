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

/**
 * Rascunho de paciente a partir de um lead.
 *
 * Deliberadamente NAO adivinha se o responsavel e mae ou pai, nem inventa CPF,
 * data de nascimento ou endereco. Quem converte completa esses campos na tela —
 * paciente e dado clinico e nao deve nascer com informacao presumida.
 */
export function buildPatientDraft(lead: Lead): Omit<Patient, 'id' | 'createdAt'> {
  return {
    name: lead.bebeNome?.trim() || `Bebe de ${lead.responsavel}`,
    cpf: '',
    birthDate: '',
    phone: lead.whatsapp,
    email: '',
    healthPlan: '',
    address: '',
    status: 'Ativo',
  };
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

  /**
   * Cria o paciente no whitelabel e marca o lead como convertido.
   * `patientData` vem preenchido/conferido pela tela, nao inferido aqui.
   */
  async convertToPatient(
    leadId: string,
    patientData: Omit<Patient, 'id' | 'createdAt'>,
    whitelabelId?: string | null
  ) {
    const patientId = await patientService.createPatient(patientData, whitelabelId);
    await this.updateLead(
      leadId,
      { status: 'CONVERTIDO', convertedPatientId: patientId },
      whitelabelId
    );
    return patientId;
  },

  async deleteLead(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.leads, id, whitelabelId);
    await deleteDoc(docRef);
  },
};
