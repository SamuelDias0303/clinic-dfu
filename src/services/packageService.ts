import {
  addDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Appointment, Package } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

export const packageService = {
  async createPackage(
    data: { patientId: string; totalSessions: number; createdBy: string; therapistId?: string; therapistName?: string; patientWhitelabelId?: string },
    whitelabelId?: string | null
  ) {
    const docRef = await addDoc(scopedCollection(COLLECTIONS.packages, whitelabelId), {
      ...withTenantField({ ...data, status: 'ATIVO' }, whitelabelId),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async closePackage(id: string, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.packages, id, whitelabelId);
    await updateDoc(docRef, {
      ...withTenantField({ status: 'ENCERRADO' }, whitelabelId),
      updatedAt: serverTimestamp(),
    });
  },

  // Todos os pacotes do tenant (painel). Cabe ao chamador restringir por paciente visível.
  subscribeToPackages(
    callback: (packages: Package[]) => void,
    whitelabelId?: string | null
  ) {
    return onSnapshot(scopedCollection(COLLECTIONS.packages, whitelabelId), (snapshot) => {
      callback(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })) as Package[]);
    }, (error) => {
      console.error('Error subscribing to packages:', error);
      callback([]);
    });
  },

  subscribeToPatientPackages(
    patientId: string,
    callback: (packages: Package[]) => void,
    whitelabelId?: string | null
  ) {
    const q = query(
      scopedCollection(COLLECTIONS.packages, whitelabelId),
      where('patientId', '==', patientId)
    );

    return onSnapshot(q, (snapshot) => {
      const packages = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Package[];

      // createdAt e null por instantes logo apos criar (serverTimestamp pendente): fica no topo.
      const millis = (pkg: Package) => pkg.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      callback([...packages].sort((a, b) => millis(b) - millis(a)));
    }, (error) => {
      console.error('Error subscribing to packages:', error);
      callback([]);
    });
  },

  // Agendamentos do paciente que pertencem a algum pacote. Terapeuta so le os
  // proprios (regra do Firestore), entao a consulta precisa filtrar por therapistId.
  subscribeToPatientAppointments(
    patientId: string,
    callback: (appointments: Appointment[]) => void,
    therapistId?: string,
    whitelabelId?: string | null
  ) {
    const base = scopedCollection(COLLECTIONS.appointments, whitelabelId);
    const q = therapistId
      ? query(base, where('patientId', '==', patientId), where('therapistId', '==', therapistId))
      : query(base, where('patientId', '==', patientId));

    return onSnapshot(q, (snapshot) => {
      const appointments = snapshot.docs
        .map((item) => ({ ...item.data(), id: item.id }) as Appointment)
        .filter((appointment) => !!appointment.packageId);
      callback(appointments);
    }, (error) => {
      console.error('Error subscribing to patient appointments:', error);
      callback([]);
    });
  },
};
