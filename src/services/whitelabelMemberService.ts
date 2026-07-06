import {
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { toFirestoreData } from '../lib/firestoreData';
import { WhitelabelMembership } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

type MembershipPayload = Omit<WhitelabelMembership, 'id' | 'createdAt' | 'updatedAt'>;

export const whitelabelMemberService = {
  subscribeToMembers(whitelabelId: string, callback: (members: WhitelabelMembership[]) => void) {
    const q = query(scopedCollection(COLLECTIONS.members, whitelabelId));

    return onSnapshot(q, (snapshot) => {
      const rawMembers = snapshot.docs
        .map((item) => ({
          ...item.data(),
          id: item.id,
        }) as WhitelabelMembership);

      const activeEmails = new Set(
        rawMembers
          .filter((member) => member.status === 'ATIVO' && member.id === member.userId)
          .map((member) => member.email.toLowerCase())
      );

      const members = rawMembers.filter((member) => {
        if (member.status === 'ATIVO') return member.id === member.userId;
        if (member.status === 'PENDENTE') return !activeEmails.has(member.email.toLowerCase());
        return false;
      });

      callback(members.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => {
      console.error('Error subscribing to whitelabel members:', error);
      callback([]);
    });
  },

  async saveMember(member: MembershipPayload) {
    const memberId = member.userId || member.email;
    const docRef = scopedDoc(COLLECTIONS.members, memberId, member.whitelabelId);

    await setDoc(docRef, toFirestoreData({
      ...withTenantField(member, member.whitelabelId),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }), { merge: true });
  },

  async updateMember(whitelabelId: string, memberId: string, member: Partial<WhitelabelMembership>) {
    const docRef = scopedDoc(COLLECTIONS.members, memberId, whitelabelId);
    await updateDoc(docRef, toFirestoreData({
      ...withTenantField(member, whitelabelId),
      updatedAt: serverTimestamp(),
    }));
  },

  async deleteMember(whitelabelId: string, memberId: string) {
    const docRef = scopedDoc(COLLECTIONS.members, memberId, whitelabelId);
    await deleteDoc(docRef);
  },
};
