import {
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { ROOT_COLLECTIONS } from '../lib/tenantPaths';
import { UserInvite, UserRole, Whitelabel } from '../types';
import { COLLECTIONS, scopedDoc, withTenantField } from './serviceScope';

type InvitePayload = {
  whitelabel: Whitelabel;
  name: string;
  email: string;
  roles: UserRole[];
  therapistId?: string;
  therapistSpecialty?: string;
  invitedBy?: string;
};

function createInviteToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeInvite(id: string, data: any): UserInvite {
  return {
    id,
    token: data.token ?? id,
    whitelabelId: data.whitelabelId,
    whitelabelName: data.whitelabelName,
    email: data.email,
    name: data.name,
    roles: Array.isArray(data.roles) ? data.roles : [],
    status: data.status ?? 'PENDENTE',
    therapistId: data.therapistId,
    therapistSpecialty: data.therapistSpecialty,
    invitedBy: data.invitedBy,
    acceptedBy: data.acceptedBy,
    acceptedAt: data.acceptedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    expiresAt: data.expiresAt,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateInvite(invite: UserInvite) {
  if (!invite.token) throw new Error('Convite sem token.');
  if (!invite.whitelabelId) throw new Error('Convite sem whitelabel.');
  if (!invite.email) throw new Error('Convite sem e-mail.');
  if (!invite.roles.length) throw new Error('Convite sem papel definido.');
  if (invite.status !== 'PENDENTE') throw new Error('Convite nao esta pendente.');
}

export function buildInviteUrl(token: string) {
  return `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
}

export const inviteService = {
  async createInvite(payload: InvitePayload) {
    if (!payload.whitelabel.id) throw new Error('Whitelabel sem ID para convite.');

    const token = createInviteToken();
    const email = normalizeEmail(payload.email);
    const inviteUrl = buildInviteUrl(token);
    const inviteRef = doc(db, ROOT_COLLECTIONS.invites, token);
    const pendingMemberRef = scopedDoc(COLLECTIONS.members, email, payload.whitelabel.id);

    await setDoc(inviteRef, toFirestoreData({
      token,
      whitelabelId: payload.whitelabel.id,
      whitelabelName: payload.whitelabel.name,
      email,
      name: payload.name.trim(),
      roles: payload.roles,
      status: 'PENDENTE',
      therapistId: payload.therapistId,
      therapistSpecialty: payload.therapistSpecialty,
      invitedBy: payload.invitedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await setDoc(pendingMemberRef, withTenantField({
      whitelabelId: payload.whitelabel.id,
      whitelabelName: payload.whitelabel.name,
      userId: email,
      email,
      name: payload.name.trim(),
      roles: payload.roles,
      status: 'PENDENTE',
      invitationToken: token,
      inviteUrl,
      therapistId: payload.therapistId,
      therapistSpecialty: payload.therapistSpecialty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, payload.whitelabel.id), { merge: true });

    return {
      token,
      inviteUrl,
    };
  },

  async getInvite(token: string) {
    const snapshot = await getDoc(doc(db, ROOT_COLLECTIONS.invites, token));
    return snapshot.exists() ? normalizeInvite(snapshot.id, snapshot.data()) : null;
  },

  async updateInvite(token: string, payload: Partial<Pick<UserInvite, 'roles' | 'therapistId' | 'therapistSpecialty'>>) {
    const inviteRef = doc(db, ROOT_COLLECTIONS.invites, token);
    await updateDoc(inviteRef, toFirestoreData({
      ...payload,
      updatedAt: serverTimestamp(),
    }));
  },

  async acceptInvite(invite: UserInvite, userId: string, userEmail?: string | null) {
    const inviteRef = doc(db, ROOT_COLLECTIONS.invites, invite.token);
    const inviteSnapshot = await getDoc(inviteRef);

    if (!inviteSnapshot.exists()) {
      throw new Error('Convite nao encontrado.');
    }

    const currentInvite = {
      ...normalizeInvite(inviteSnapshot.id, inviteSnapshot.data()),
      name: invite.name || inviteSnapshot.data().name,
    };

    validateInvite(currentInvite);

    if (userEmail && normalizeEmail(userEmail) !== normalizeEmail(currentInvite.email)) {
      throw new Error('A conta autenticada nao corresponde ao e-mail do convite.');
    }

    const memberRef = scopedDoc(COLLECTIONS.members, userId, currentInvite.whitelabelId);
    const pendingMemberRef = scopedDoc(COLLECTIONS.members, currentInvite.email, currentInvite.whitelabelId);
    const pendingSnapshot = await getDoc(pendingMemberRef);

    await setDoc(memberRef, withTenantField({
      whitelabelId: currentInvite.whitelabelId,
      whitelabelName: currentInvite.whitelabelName,
      userId,
      email: currentInvite.email,
      name: currentInvite.name,
      roles: currentInvite.roles,
      status: 'ATIVO',
      invitationToken: currentInvite.token,
      therapistId: currentInvite.therapistId,
      therapistSpecialty: currentInvite.therapistSpecialty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, currentInvite.whitelabelId), { merge: true });

    if (pendingSnapshot.exists() && pendingMemberRef.id !== memberRef.id) {
      await deleteDoc(pendingMemberRef);
    }

    await updateDoc(inviteRef, toFirestoreData({
      status: 'ACEITO',
      acceptedBy: userId,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  },
};
