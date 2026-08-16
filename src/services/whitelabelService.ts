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

// As whitelabels de pratica (raiza-fisio, rafaela-fisio, ...) vivem em
// `whitelabels/{id}`, a mesma colecao usada por scopedCollection,
// migrate-to-whitelabels.ts e firestore.rules. `clients` era a colecao antiga,
// anterior a essa migracao, e so segue existindo pelo doc sentinela
// `legacy-default` (ver serviceScope.isLegacyWhitelabel).
const COLLECTION_NAME = ROOT_COLLECTIONS.whitelabels;

type LegacyWhitelabelPayload = Omit<Whitelabel, 'id' | 'createdAt' | 'updatedAt'>;

function normalizeStatus(status: unknown): WhitelabelStatus {
  if (status === 'SUSPENSO' || status === 'Suspenso') return 'SUSPENSO';
  if (status === 'ARQUIVADO' || status === 'Arquivado') return 'ARQUIVADO';
  return 'ATIVO';
}

function normalizeWhitelabel(id: string, data: any): Whitelabel {
  return {
    id,
    name: data.name ?? '',
    slug: data.slug ?? data.domain ?? id,
    domain: data.domain,
    status: normalizeStatus(data.status),
    plan: data.plan ?? 'Padrao',
    workspaceType: data.workspaceType,
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

export const whitelabelService = {
  async createWhitelabel(whitelabel: LegacyWhitelabelPayload) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), toFirestoreData({
      ...whitelabel,
      workspaceType: whitelabel.workspaceType ?? 'CLINICA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    return docRef.id;
  },

  subscribeToWhitelabels(callback: (whitelabels: Whitelabel[]) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      callback(
        snapshot.docs
          .map((item) => normalizeWhitelabel(item.id, item.data()))
          // Workspaces individuais (personalWorkspaceService) sao consultorios
          // pessoais de um unico terapeuta, nao praticas gerenciaveis pelo
          // Admin Global — nao devem aparecer nesta tela.
          .filter((whitelabel) => whitelabel.workspaceType !== 'INDIVIDUAL')
      );
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
      ...whitelabel,
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
