import {
  addDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

export interface Therapist {
  id: string;
  whitelabelId?: string;
  name: string;
  email: string;
  specialty: string;
  status: 'Ativo' | 'Inativo';
  units: string[];
  rating: number;
  createdAt?: any;
}

export const therapistService = {
  async createTherapist(therapist: Omit<Therapist, 'id' | 'createdAt'>, whitelabelId?: string | null) {
    const docRef = await addDoc(scopedCollection(COLLECTIONS.therapists, whitelabelId), {
      ...withTenantField(therapist, whitelabelId),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  subscribeToTherapists(callback: (therapists: Therapist[]) => void, whitelabelId?: string | null) {
    const q = query(scopedCollection(COLLECTIONS.therapists, whitelabelId));

    return onSnapshot(q, (snapshot) => {
      const therapists = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Therapist[];

      const sorted = [...therapists].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      callback(sorted);
    }, (error) => {
      console.error('Error subscribing to therapists:', error);
      callback([]);
    });
  },

  async updateTherapist(id: string, therapist: Partial<Therapist>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.therapists, id, whitelabelId);
    await updateDoc(docRef, withTenantField(therapist, whitelabelId));
  },

  async deleteTherapist(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.therapists, id, whitelabelId);
    await deleteDoc(docRef);
  },

  async ensureTherapistExists(user: { email: string; name: string; specialty?: string }, whitelabelId?: string | null) {
    if (!user.email) return;

    const docRef = scopedDoc(COLLECTIONS.therapists, user.email, whitelabelId);
    const docSnap = await getDoc(docRef);
    const specialty = user.specialty || 'Terapeuta Geral';

    if (!docSnap.exists()) {
      await setDoc(docRef, withTenantField({
        email: user.email,
        name: user.name,
        specialty,
        status: 'Ativo',
        units: ['Unidade Principal'],
        rating: 5,
        createdAt: serverTimestamp(),
      }, whitelabelId));
    } else if (user.specialty) {
      await updateDoc(docRef, withTenantField({
        name: user.name,
        specialty,
      }, whitelabelId));
    }
  },
};
