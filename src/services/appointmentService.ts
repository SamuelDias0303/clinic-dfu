import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Appointment } from '../types';
import { COLLECTIONS, scopedCollection, scopedDoc, withTenantField } from './serviceScope';

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
        throw new Error(`Conflito de horario detectado em ${app.date} as ${app.time}`);
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

    return results[0].id;
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

    if (appointment.date || appointment.time || appointment.therapistId) {
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) throw new Error('Agendamento nao encontrado.');
      const current = snapshot.data() as Appointment;

      const therapistId = appointment.therapistId || current.therapistId;
      const date = appointment.date || current.date;
      const time = appointment.time || current.time;

      const hasConflict = await this.checkConflict(therapistId, date, time, id, whitelabelId);
      if (hasConflict) {
        throw new Error(`Conflito de horario detectado em ${date} as ${time}`);
      }
    }

    await updateDoc(docRef, withTenantField(appointment, whitelabelId));
  },

  async deleteAppointment(id: string, whitelabelId?: string | null) {
    if (!id) throw new Error('ID do agendamento e obrigatorio para exclusao.');
    const docRef = scopedDoc(COLLECTIONS.appointments, id, whitelabelId);
    await deleteDoc(docRef);
  },

  async deleteRecurrence(recurrenceId: string, whitelabelId?: string | null) {
    if (!recurrenceId) throw new Error('ID da recorrencia e obrigatorio.');

    const q = query(
      scopedCollection(COLLECTIONS.appointments, whitelabelId),
      where('recurrenceId', '==', recurrenceId)
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((item) => deleteDoc(item.ref));
    await Promise.all(deletePromises);
  },
};
