import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toFirestoreData } from '../lib/firestoreData';
import { ROOT_COLLECTIONS } from '../lib/tenantPaths';
import { WhitelabelLinks } from '../types';

type Target = WhitelabelLinks['targets'][number];

// Quais whitelabels a origem pode ver e usar como destino de compartilhamento.
// Só o admin global grava (regras do Firestore).
export const whitelabelLinksService = {
  subscribe(whitelabelId: string, callback: (links: WhitelabelLinks | null) => void) {
    return onSnapshot(doc(db, ROOT_COLLECTIONS.whitelabelLinks, whitelabelId), (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data();
      callback({ targetIds: data.targetIds ?? [], targets: data.targets ?? [] });
    }, (error) => {
      console.error('Error subscribing to whitelabel links:', error);
      callback(null);
    });
  },

  async save(whitelabelId: string, targets: Target[]) {
    await setDoc(doc(db, ROOT_COLLECTIONS.whitelabelLinks, whitelabelId), toFirestoreData({
      targetIds: targets.map((target) => target.id),
      targets,
      updatedAt: serverTimestamp(),
    }));
  },
};
