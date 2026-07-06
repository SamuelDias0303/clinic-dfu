import {
  addDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Anamnese, Evolution } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

export const clinicalRecordService = {
  async createEvolution(evolution: Omit<Evolution, 'id' | 'createdAt'>, whitelabelId?: string | null) {
    return addDoc(scopedCollection(COLLECTIONS.evolutions, whitelabelId), {
      ...withTenantField(evolution, whitelabelId),
      createdAt: serverTimestamp(),
    });
  },

  async updateEvolution(id: string, evolution: Partial<Evolution>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.evolutions, id, whitelabelId);
    return updateDoc(docRef, withTenantField(evolution, whitelabelId));
  },

  subscribeToEvolutions(
    patientId: string,
    callback: (evolutions: Evolution[]) => void,
    whitelabelId?: string | null
  ) {
    const q = query(
      scopedCollection(COLLECTIONS.evolutions, whitelabelId),
      where('patientId', '==', patientId)
    );

    return onSnapshot(q, (snapshot) => {
      const evolutions = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Evolution[];

      evolutions.sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        const dateCompare = dateB.localeCompare(dateA);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      });

      callback(evolutions);
    });
  },

  async saveAnamnese(anamnese: Omit<Anamnese, 'id' | 'updatedAt'>, whitelabelId?: string | null) {
    const q = query(
      scopedCollection(COLLECTIONS.anamneses, whitelabelId),
      where('patientId', '==', anamnese.patientId),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return addDoc(scopedCollection(COLLECTIONS.anamneses, whitelabelId), {
        ...withTenantField(anamnese, whitelabelId),
        updatedAt: serverTimestamp(),
      });
    }

    const docRef = scopedDoc(COLLECTIONS.anamneses, snapshot.docs[0].id, whitelabelId);
    return updateDoc(docRef, {
      ...withTenantField(anamnese, whitelabelId),
      updatedAt: serverTimestamp(),
    });
  },

  subscribeToAnamnese(
    patientId: string,
    callback: (anamnese: Anamnese | null) => void,
    whitelabelId?: string | null
  ) {
    const q = query(
      scopedCollection(COLLECTIONS.anamneses, whitelabelId),
      where('patientId', '==', patientId),
      limit(1)
    );

    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        callback({
          ...snapshot.docs[0].data(),
          id: snapshot.docs[0].id,
        } as Anamnese);
      }
    });
  },
};
