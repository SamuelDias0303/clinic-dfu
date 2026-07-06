import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { ROOT_COLLECTIONS } from '../lib/tenantPaths';
import { Whitelabel, WhitelabelStatus } from '../types';

const COLLECTION_NAME = ROOT_COLLECTIONS.legacyClients;

type LegacyWhitelabelPayload = Omit<Whitelabel, 'id' | 'createdAt' | 'updatedAt'>;

function normalizeStatus(status: unknown): WhitelabelStatus {
  if (status === 'SUSPENSO' || status === 'Suspenso') return 'SUSPENSO';
  if (status === 'ARQUIVADO' || status === 'Arquivado') return 'ARQUIVADO';
  return 'ATIVO';
}

function toLegacyStatus(status: WhitelabelStatus) {
  if (status === 'SUSPENSO') return 'Suspenso';
  if (status === 'ARQUIVADO') return 'Arquivado';
  return 'Ativo';
}

function normalizeWhitelabel(id: string, data: any): Whitelabel {
  return {
    id,
    name: data.name ?? '',
    slug: data.slug ?? data.domain ?? id,
    domain: data.domain,
    status: normalizeStatus(data.status),
    plan: data.plan ?? 'Padrao',
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    branding: data.branding ?? {
      primaryColor: '#0066ff',
    },
    settings: data.settings,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function toLegacyPayload(whitelabel: LegacyWhitelabelPayload) {
  return {
    ...whitelabel,
    status: toLegacyStatus(whitelabel.status),
  };
}

function toLegacyPartialPayload(whitelabel: Partial<LegacyWhitelabelPayload>) {
  const payload: Record<string, unknown> = {
    ...whitelabel,
  };

  if (whitelabel.status) {
    payload.status = toLegacyStatus(whitelabel.status);
  }

  return payload;
}

export const whitelabelService = {
  async createWhitelabel(whitelabel: LegacyWhitelabelPayload) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), toFirestoreData({
      ...toLegacyPayload(whitelabel),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    return docRef.id;
  },

  subscribeToWhitelabels(callback: (whitelabels: Whitelabel[]) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((item) => normalizeWhitelabel(item.id, item.data())));
    });
  },

  subscribeToWhitelabel(id: string, callback: (whitelabel: Whitelabel | null) => void) {
    return onSnapshot(doc(db, COLLECTION_NAME, id), (snapshot) => {
      callback(snapshot.exists() ? normalizeWhitelabel(snapshot.id, snapshot.data()) : null);
    }, (error) => {
      console.error('Error subscribing to whitelabel:', error);
      callback(null);
    });
  },

  async getWhitelabel(id: string) {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id));
    return snapshot.exists() ? normalizeWhitelabel(snapshot.id, snapshot.data()) : null;
  },

  async updateWhitelabel(id: string, whitelabel: Partial<LegacyWhitelabelPayload>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, toFirestoreData({
      ...toLegacyPartialPayload(whitelabel),
      updatedAt: serverTimestamp(),
    }));
  },

  async updateTherapistSpecialties(id: string, therapistSpecialties: string[]) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, toFirestoreData({
      'settings.therapistSpecialties': therapistSpecialties,
      updatedAt: serverTimestamp(),
    }));
  },

  async deleteWhitelabel(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
