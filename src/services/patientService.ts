import {
  addDoc,
  deleteDoc,
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

  async updatePatient(id: string, patient: Partial<Patient>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    await updateDoc(docRef, withTenantField(patient, whitelabelId));
  },

  async deletePatient(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    await deleteDoc(docRef);
  },
};
