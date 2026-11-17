import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { buildPatientCopy, buildSharedWithAudit, copyTargetsDiff } from '../lib/sharing';
import { tenantCollectionPath, TENANT_COLLECTIONS } from '../lib/tenantPaths';
import { Patient } from '../types';
import { COLLECTIONS, isLegacyWhitelabel, scopedCollection, scopedDoc, sharedCopyDoc, withTenantField } from './serviceScope';

type SavedPatient = Patient & { id: string };

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
    if (!snapshot.exists()) throw new Error('Paciente não encontrado.');
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

    if (whitelabelId && !isLegacyWhitelabel(whitelabelId)) {
      const saved = await getDoc(docRef);
      if (saved.exists() && (saved.data().sharedWith ?? []).length > 0) {
        // shortcut: só o gestor da origem grava as cópias; se outro papel editar, a cópia fica velha até o gestor editar de novo.
        await this.syncSharedCopies({ ...(saved.data() as Patient), id }, whitelabelId).catch((error) => {
          console.warn('Não foi possível atualizar as cópias do paciente compartilhado:', error);
        });
      }
    }
  },

  async deletePatient(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.patients, id, whitelabelId);
    const saved = whitelabelId && !isLegacyWhitelabel(whitelabelId) ? await getDoc(docRef) : null;
    await deleteDoc(docRef);

    const targets: string[] = saved?.exists() ? saved.data().sharedWith ?? [] : [];
    await Promise.all(targets.map((target) => deleteDoc(sharedCopyDoc(TENANT_COLLECTIONS.sharedPatients, target, whitelabelId!, id))
      .catch((error) => console.warn('Não foi possível remover a cópia do paciente compartilhado:', error))));
  },

  /** Cópias do cadastro nos whitelabels de destino, para a lista deles. */
  async syncSharedCopies(patient: SavedPatient, whitelabelId: string) {
    const batch = writeBatch(db);
    (patient.sharedWith ?? []).forEach((target) => {
      batch.set(
        sharedCopyDoc(TENANT_COLLECTIONS.sharedPatients, target, whitelabelId, patient.id),
        toFirestoreData(buildPatientCopy(patient, whitelabelId)),
      );
    });
    await batch.commit();
  },

  /**
   * Define com quem cada paciente é compartilhado: atualiza `sharedWith`, cria ou remove as
   * cópias no destino e registra auditoria, tudo em lote (as regras conferem pelo estado final).
   */
  async setSharedWith(
    changes: { patient: SavedPatient; sharedWith: string[] }[],
    whitelabelId: string,
    actor: { uid: string; email: string },
  ) {
    const CHUNK = 80;
    for (let start = 0; start < changes.length; start += CHUNK) {
      const batch = writeBatch(db);
      changes.slice(start, start + CHUNK).forEach(({ patient, sharedWith }) => {
        const { remove } = copyTargetsDiff(patient.sharedWith, sharedWith);
        batch.update(scopedDoc(COLLECTIONS.patients, patient.id, whitelabelId), { sharedWith });
        const next = { ...patient, sharedWith };
        sharedWith.forEach((target) => {
          batch.set(
            sharedCopyDoc(TENANT_COLLECTIONS.sharedPatients, target, whitelabelId, patient.id),
            toFirestoreData(buildPatientCopy(next, whitelabelId)),
          );
        });
        remove.forEach((target) => {
          batch.delete(sharedCopyDoc(TENANT_COLLECTIONS.sharedPatients, target, whitelabelId, patient.id));
        });
        batch.set(
          doc(collection(db, tenantCollectionPath(whitelabelId, TENANT_COLLECTIONS.auditLogs))),
          toFirestoreData({
            ...buildSharedWithAudit(patient.id, whitelabelId, sharedWith, actor),
            whitelabelId,
            createdAt: serverTimestamp(),
          }),
        );
      });
      await batch.commit();
    }
  },

  /** Pacientes de outros whitelabels compartilhados com este (cópias-índice). */
  subscribeToSharedPatients(whitelabelId: string, callback: (patients: Patient[]) => void) {
    return onSnapshot(collection(db, tenantCollectionPath(whitelabelId, TENANT_COLLECTIONS.sharedPatients)), (snapshot) => {
      const patients = snapshot.docs.map((item) => {
        const { ownerWhitelabelId, patientId, ...rest } = item.data();
        return { ...rest, id: patientId, whitelabelId: ownerWhitelabelId } as Patient;
      });
      callback(patients);
    }, (error) => {
      console.error('Error subscribing to shared patients:', error);
      callback([]);
    });
  },
};
