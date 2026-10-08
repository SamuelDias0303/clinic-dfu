import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Patient } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

export const patientService = {
  async createPatient(patient: Omit<Patient, 'id' | 'createdAt'>, whitelabelId?: string | null) {
    const docRef = await addDoc(scopedCollection(COLLECTIONS.patients, whitelabelId), {
      ...withTenantField(patient, whitelabelId),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  subscribeToPatients(
    callback: (patients: Patient[]) => void,
    therapistId?: string,
    whitelabelId?: string | null
  ) {
    const baseCollection = scopedCollection(COLLECTIONS.patients, whitelabelId);
    const q = therapistId
      ? query(baseCollection, where('therapistId', '==', therapistId))
      : query(baseCollection);

    return onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Patient[];

      const sorted = [...patients].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      callback(sorted);
    }, (error) => {
      console.error('Error subscribing to patients:', error);
      callback([]);
    });
  },

  /** Leitura unica (sem assinatura) de todos os pacientes do whitelabel. */
  async listarPacientes(whitelabelId?: string | null): Promise<Patient[]> {
    const snapshot = await getDocs(query(scopedCollection(COLLECTIONS.patients, whitelabelId)));
    return snapshot.docs.map((item) => ({ ...item.data(), id: item.id })) as Patient[];
  },

  /**
   * Completa nome da mae e endereco SO se continuam vazios NO BANCO agora (a previa
   * da tela pode estar desatualizada). Nunca sobrescreve. Devolve o que foi gravado.
   */
  async completarCadastro(
    id: string,
    campos: { motherName?: string; address?: string },
    whitelabelId?: string | null
  ): Promise<{ motherName: boolean; address: boolean }> {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) throw new Error('Paciente nao encontrado.');
    const atual = snapshot.data() as Patient;

    const patch: Partial<Patient> = {};
    if (campos.motherName && !atual.motherName?.trim()) patch.motherName = campos.motherName;
    if (campos.address && !atual.address?.trim()) patch.address = campos.address;

    if (Object.keys(patch).length > 0) {
      await updateDoc(docRef, withTenantField(patch, whitelabelId));
    }
    return { motherName: patch.motherName !== undefined, address: patch.address !== undefined };
  },

  async updatePatient(id: string, patient: Partial<Patient>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    await updateDoc(docRef, withTenantField(patient, whitelabelId));
  },

  async deletePatient(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    await deleteDoc(docRef);
  },
};
