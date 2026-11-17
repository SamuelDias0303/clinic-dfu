import {
  addDoc,
  collection,
  deleteDoc,
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
import { buildAppointmentCopy } from '../lib/sharing';
import { tenantCollectionPath, TENANT_COLLECTIONS } from '../lib/tenantPaths';
import { Appointment } from '../types';
import { COLLECTIONS, isLegacyWhitelabel, scopedCollection, scopedDoc, sharedCopyDoc, withTenantField } from './serviceScope';

type SavedAppointment = Appointment & { id: string };

// Agendamento marcado para outro whitelabel: o destino lê uma cópia-índice (só o bloco de horário).
async function syncSharedCopies(appointment: SavedAppointment, whitelabelId: string | null | undefined, previousTargets: string[] = []) {
  if (!whitelabelId || isLegacyWhitelabel(whitelabelId)) return;
  const targets = appointment.sharedToWhitelabels ?? [];
  if (targets.length === 0 && previousTargets.length === 0) return;

  const batch = writeBatch(db);
  targets.forEach((target) => {
    batch.set(
      sharedCopyDoc(TENANT_COLLECTIONS.sharedAppointments, target, whitelabelId, appointment.id),
      toFirestoreData(buildAppointmentCopy(appointment, whitelabelId)),
    );
  });
  previousTargets.filter((target) => !targets.includes(target)).forEach((target) => {
    batch.delete(sharedCopyDoc(TENANT_COLLECTIONS.sharedAppointments, target, whitelabelId, appointment.id));
  });
  await batch.commit();
}

async function removeSharedCopies(id: string, targets: string[], whitelabelId: string | null | undefined) {
  if (!whitelabelId || isLegacyWhitelabel(whitelabelId) || targets.length === 0) return;
  await Promise.all(targets.map((target) => deleteDoc(sharedCopyDoc(TENANT_COLLECTIONS.sharedAppointments, target, whitelabelId, id))
    .catch((error) => console.warn('Não foi possível remover a cópia do agendamento compartilhado:', error))));
}

function makeRecurrenceId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRecurringAppointments(appointment: Omit<Appointment, 'id' | 'createdAt'>) {
  let appointmentsToCreate: Omit<Appointment, 'id' | 'createdAt'>[] = [appointment];
  const recurrenceId = makeRecurrenceId();

  if (!appointment.recurrence || appointment.recurrence === 'NONE') {
    return appointmentsToCreate;
  }

  appointment.recurrenceId = recurrenceId;
  const [year, month, day] = appointment.date.split('-').map(Number);
  const startDate = new Date(year, month - 1, day);
  let maxOccurrences = 12;
  if (appointment.recurrence === 'MONTHLY') maxOccurrences = 6;

  if (appointment.recurrenceDays && appointment.recurrenceDays.length > 0) {
    appointmentsToCreate = [];
    const weeksToGenerate = appointment.recurrence === 'BIWEEKLY' ? maxOccurrences * 2 : maxOccurrences;

    for (let w = 0; w < weeksToGenerate; w++) {
      if (appointment.recurrence === 'BIWEEKLY' && w % 2 !== 0) continue;

      for (const dayOfWeek of appointment.recurrenceDays) {
        const current = new Date(startDate);
        const startOfWeek = new Date(startDate);
        startOfWeek.setDate(startDate.getDate() - startDate.getDay());
        current.setTime(startOfWeek.getTime());
        current.setDate(current.getDate() + dayOfWeek + (w * 7));
        if (current < startDate) continue;

        appointmentsToCreate.push({
          ...appointment,
          date: formatDate(current),
        });
      }
    }

    if (appointment.recurrence === 'MONTHLY') {
      appointmentsToCreate = [appointment];
      for (let i = 1; i < maxOccurrences; i++) {
        const nextDate = new Date(startDate);
        nextDate.setMonth(startDate.getMonth() + i);
        appointmentsToCreate.push({ ...appointment, date: formatDate(nextDate) });
      }
    }

    return appointmentsToCreate;
  }

  for (let i = 1; i < maxOccurrences; i++) {
    const nextDate = new Date(startDate);

    if (appointment.recurrence === 'WEEKLY') {
      nextDate.setDate(startDate.getDate() + (i * 7));
    } else if (appointment.recurrence === 'BIWEEKLY') {
      nextDate.setDate(startDate.getDate() + (i * 14));
    } else if (appointment.recurrence === 'MONTHLY') {
      nextDate.setMonth(startDate.getMonth() + i);
    }

    appointmentsToCreate.push({
      ...appointment,
      date: formatDate(nextDate),
    });
  }

  return appointmentsToCreate;
}

export const appointmentService = {
  async checkConflict(
    therapistId: string,
    date: string,
    time: string,
    excludeId?: string,
    whitelabelId?: string | null
  ) {
    const q = query(
      scopedCollection(COLLECTIONS.appointments, whitelabelId),
      where('therapistId', '==', therapistId),
      where('date', '==', date),
      where('time', '==', time)
    );
    const snapshot = await getDocs(q);
    const conflicts = snapshot.docs.filter((item) => item.id !== excludeId);
    return conflicts.length > 0;
  },

  async createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>, whitelabelId?: string | null) {
    const appointmentsToCreate = buildRecurringAppointments(appointment);

    for (const app of appointmentsToCreate) {
      const hasConflict = await this.checkConflict(app.therapistId, app.date, app.time, undefined, whitelabelId);
      if (hasConflict) {
        throw new Error(`Conflito de horário detectado em ${app.date} as ${app.time}`);
      }
    }

    const results = await Promise.all(
      appointmentsToCreate.map((app) =>
        addDoc(scopedCollection(COLLECTIONS.appointments, whitelabelId), {
          ...withTenantField(app, whitelabelId),
          createdAt: serverTimestamp(),
        })
      )
    );

    try {
      await Promise.all(results.map((result, index) =>
        syncSharedCopies({ ...appointmentsToCreate[index], id: result.id } as SavedAppointment, whitelabelId)));
    } catch (error) {
      console.error('Error sharing appointment:', error);
      throw new Error('Agendamento salvo, mas não foi possível mostrá-lo na agenda do outro whitelabel.');
    }

    return results[0].id;
  },

  /**
   * Paciente deixou de ser compartilhado com estes whitelabels: tira a tag dos agendamentos
   * daqui, apaga as cópias lá e apaga, na agenda daqui, as cópias que eles marcaram para cá.
   */
  // shortcut: um único lote (500 operações); revisar se algum paciente passar de ~250 agendamentos marcados.
  async unshareForPatient(patientId: string, removedTargets: string[], whitelabelId: string) {
    if (removedTargets.length === 0 || isLegacyWhitelabel(whitelabelId)) return;

    const batch = writeBatch(db);
    const own = await getDocs(query(scopedCollection(COLLECTIONS.appointments, whitelabelId), where('patientId', '==', patientId)));
    own.docs.forEach((item) => {
      const tags: string[] = item.data().sharedToWhitelabels ?? [];
      const gone = tags.filter((id) => removedTargets.includes(id));
      if (gone.length === 0) return;
      batch.update(item.ref, { sharedToWhitelabels: tags.filter((id) => !gone.includes(id)) });
      gone.forEach((target) => batch.delete(sharedCopyDoc(TENANT_COLLECTIONS.sharedAppointments, target, whitelabelId, item.id)));
    });

    const incoming = await getDocs(query(collection(db, tenantCollectionPath(whitelabelId, TENANT_COLLECTIONS.sharedAppointments)), where('patientId', '==', patientId)));
    incoming.docs.forEach((item) => {
      if (removedTargets.includes(item.data().sourceWhitelabelId)) batch.delete(item.ref);
    });

    await batch.commit();
  },

  /**
   * Evoluir no whitelabel que recebeu o compartilhamento: liga a evolução ao agendamento de
   * origem e à cópia daqui. Só evolutionId; status continua do dono (regras do Firestore).
   */
  async linkSharedEvolution(appointmentId: string, sourceWhitelabelId: string, evolutionId: string, whitelabelId: string) {
    const batch = writeBatch(db);
    batch.update(scopedDoc(COLLECTIONS.appointments, appointmentId, sourceWhitelabelId), { evolutionId });
    batch.update(sharedCopyDoc(TENANT_COLLECTIONS.sharedAppointments, whitelabelId, sourceWhitelabelId, appointmentId), { evolutionId });
    await batch.commit();
  },

  /** Agendamentos marcados por outros whitelabels para aparecer aqui (só leitura). */
  subscribeToSharedAppointments(whitelabelId: string, callback: (appointments: Appointment[]) => void) {
    return onSnapshot(collection(db, tenantCollectionPath(whitelabelId, TENANT_COLLECTIONS.sharedAppointments)), (snapshot) => {
      const appointments = snapshot.docs.map((item) => {
        const { sourceWhitelabelId, appointmentId, ...rest } = item.data();
        return { ...rest, id: appointmentId, whitelabelId: sourceWhitelabelId } as Appointment;
      });
      callback(appointments.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)));
    }, (error) => {
      console.error('Error subscribing to shared appointments:', error);
      callback([]);
    });
  },

  subscribeToAppointments(
    callback: (appointments: Appointment[]) => void,
    therapistId?: string,
    whitelabelId?: string | null
  ) {
    const baseCollection = scopedCollection(COLLECTIONS.appointments, whitelabelId);
    const q = therapistId
      ? query(baseCollection, where('therapistId', '==', therapistId))
      : query(baseCollection);

    return onSnapshot(q, (snapshot) => {
      const appointments = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Appointment[];

      const sorted = [...appointments].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      callback(sorted);
    }, (error) => {
      console.error('Error subscribing to appointments:', error);
      callback([]);
    });
  },

  async updateAppointment(id: string, appointment: Partial<Appointment>, whitelabelId?: string | null) {
    const docRef = scopedDoc(COLLECTIONS.appointments, id, whitelabelId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) throw new Error('Agendamento não encontrado.');
    const current = snapshot.data() as Appointment;

    if (appointment.date || appointment.time || appointment.therapistId) {

      const therapistId = appointment.therapistId || current.therapistId;
      const date = appointment.date || current.date;
      const time = appointment.time || current.time;

      const hasConflict = await this.checkConflict(therapistId, date, time, id, whitelabelId);
      if (hasConflict) {
        throw new Error(`Conflito de horário detectado em ${date} as ${time}`);
      }
    }

    await updateDoc(docRef, withTenantField(appointment, whitelabelId));

    await syncSharedCopies({ ...current, ...appointment, id } as SavedAppointment, whitelabelId, current.sharedToWhitelabels)
      .catch((error) => {
        console.error('Error sharing appointment:', error);
        throw new Error('Agendamento salvo, mas não foi possível atualizar a agenda do outro whitelabel.');
      });
  },

  async deleteAppointment(id: string, whitelabelId?: string | null) {
    if (!id) throw new Error('ID do agendamento é obrigatório para exclusão.');
    const docRef = scopedDoc(COLLECTIONS.appointments, id, whitelabelId);
    const snapshot = await getDoc(docRef);
    await deleteDoc(docRef);
    await removeSharedCopies(id, snapshot.exists() ? (snapshot.data() as Appointment).sharedToWhitelabels ?? [] : [], whitelabelId);
  },

  async deleteRecurrence(recurrenceId: string, whitelabelId?: string | null) {
    if (!recurrenceId) throw new Error('ID da recorrência é obrigatório.');

    const q = query(
      scopedCollection(COLLECTIONS.appointments, whitelabelId),
      where('recurrenceId', '==', recurrenceId)
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((item) => deleteDoc(item.ref));
    await Promise.all(deletePromises);
    await Promise.all(snapshot.docs.map((item) => removeSharedCopies(item.id, (item.data() as Appointment).sharedToWhitelabels ?? [], whitelabelId)));
  },
};
