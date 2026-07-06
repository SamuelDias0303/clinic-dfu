import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { ROOT_COLLECTIONS, TENANT_COLLECTIONS } from '../lib/tenantPaths';
import { WhitelabelMembership } from '../types';

function buildWorkspaceId(userId: string) {
  return `individual_${userId}`;
}

function buildSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 48);
}

export const personalWorkspaceService = {
  async ensurePersonalWorkspace(firebaseUser: FirebaseUser): Promise<WhitelabelMembership> {
    const userName = firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Terapeuta';
    const email = firebaseUser.email ?? '';
    const whitelabelId = buildWorkspaceId(firebaseUser.uid);
    const whitelabelName = `Consultorio de ${userName}`;

    const memberRef = doc(
      db,
      ROOT_COLLECTIONS.whitelabels,
      whitelabelId,
      TENANT_COLLECTIONS.members,
      firebaseUser.uid
    );
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const data = memberSnap.data();
      return {
        id: memberSnap.id,
        whitelabelId,
        whitelabelName: data.whitelabelName ?? whitelabelName,
        userId: firebaseUser.uid,
        email: data.email ?? email,
        name: data.name ?? userName,
        roles: ['TERAPEUTA'],
        status: 'ATIVO',
        therapistId: data.therapistId ?? email,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    const batch = writeBatch(db);
    const whitelabelRef = doc(db, ROOT_COLLECTIONS.whitelabels, whitelabelId);
    const therapistRef = doc(
      db,
      ROOT_COLLECTIONS.whitelabels,
      whitelabelId,
      TENANT_COLLECTIONS.therapists,
      email || firebaseUser.uid
    );
    const userRef = doc(db, ROOT_COLLECTIONS.users, firebaseUser.uid);

    batch.set(whitelabelRef, toFirestoreData({
      name: whitelabelName,
      slug: buildSlug(`${userName}-${firebaseUser.uid.substring(0, 6)}`),
      status: 'ATIVO',
      plan: 'Individual',
      workspaceType: 'INDIVIDUAL',
      ownerUserId: firebaseUser.uid,
      contactEmail: email,
      branding: {
        primaryColor: '#0066ff',
      },
      settings: {
        defaultUnitName: 'Atendimento Individual',
        appointmentTypes: ['Consulta', 'Avaliacao', 'Retorno'],
        therapistSpecialties: ['Terapeuta Geral'],
        enabledFeatures: ['agenda', 'pacientes', 'prontuario'],
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), { merge: true });

    batch.set(memberRef, toFirestoreData({
      whitelabelId,
      whitelabelName,
      userId: firebaseUser.uid,
      email,
      name: userName,
      roles: ['TERAPEUTA'],
      status: 'ATIVO',
      therapistId: email || firebaseUser.uid,
      therapistSpecialty: 'Terapeuta Geral',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), { merge: true });

    batch.set(therapistRef, toFirestoreData({
      whitelabelId,
      email,
      name: userName,
      specialty: 'Terapeuta Geral',
      status: 'Ativo',
      units: ['Atendimento Individual'],
      rating: 5,
      createdAt: serverTimestamp(),
    }), { merge: true });

    batch.set(userRef, toFirestoreData({
      name: userName,
      email,
      roles: ['TERAPEUTA'],
      provisioningMode: 'PERSONAL_WORKSPACE',
      personalWhitelabelId: whitelabelId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), { merge: true });

    await batch.commit();

    return {
      id: firebaseUser.uid,
      whitelabelId,
      whitelabelName,
      userId: firebaseUser.uid,
      email,
      name: userName,
      roles: ['TERAPEUTA'],
      status: 'ATIVO',
      therapistId: email || firebaseUser.uid,
    };
  },
};
