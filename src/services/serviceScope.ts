import { collection, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { tenantCollectionPath, TENANT_COLLECTIONS, TenantCollection } from '../lib/tenantPaths';
import { sharedCopyId } from '../lib/sharing';

export const LEGACY_WHITELABEL_ID = 'legacy-default';

export function isLegacyWhitelabel(whitelabelId?: string | null) {
  return whitelabelId === LEGACY_WHITELABEL_ID;
}

export function scopedCollection(collectionName: TenantCollection, whitelabelId?: string | null) {
  if (isLegacyWhitelabel(whitelabelId)) {
    return collection(db, collectionName);
  }

  if (!whitelabelId) {
    throw new Error('whitelabelId é obrigatório para acessar coleções isoladas por whitelabel.');
  }

  return collection(db, tenantCollectionPath(whitelabelId, collectionName));
}

export function scopedDoc(collectionName: TenantCollection, id: string, whitelabelId?: string | null) {
  if (isLegacyWhitelabel(whitelabelId)) {
    return doc(db, collectionName, id);
  }

  if (!whitelabelId) {
    throw new Error('whitelabelId é obrigatório para acessar documentos isolados por whitelabel.');
  }

  return doc(db, tenantCollectionPath(whitelabelId, collectionName), id);
}

// Cópia-índice no whitelabel de destino ({origem}__{id}); só existe em whitelabels reais.
export function sharedCopyDoc(collectionName: 'sharedPatients' | 'sharedAppointments', targetWhitelabelId: string, originWhitelabelId: string, id: string) {
  return doc(db, tenantCollectionPath(targetWhitelabelId, collectionName), sharedCopyId(originWhitelabelId, id));
}

export function withTenantField<T extends Record<string, unknown>>(data: T, whitelabelId?: string | null): T {
  if (isLegacyWhitelabel(whitelabelId)) return toFirestoreData(data);
  return toFirestoreData({
    ...data,
    whitelabelId,
  });
}

export const COLLECTIONS = TENANT_COLLECTIONS;
