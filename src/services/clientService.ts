import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface Client {
  id: string;
  name: string;
  domain: string;
  status: 'Ativo' | 'Suspenso';
  users: number;
  plan: string;
  createdAt?: any;
}

const COLLECTION_NAME = "clients";

export const clientService = {
  // Create
  async createClient(client: Omit<Client, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...client,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Read (Real-time)
  subscribeToClients(callback: (clients: Client[]) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Client[];
      callback(clients);
    });
  },

  // Update
  async updateClient(id: string, client: Partial<Client>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, client);
  },

  // Delete
  async deleteClient(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};
