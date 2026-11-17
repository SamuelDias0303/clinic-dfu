import { Appointment, Package, Patient, WhitelabelLinks } from '../types';

// Limite das regras do Firestore: elas olham posições fixas (0, 1, 2) de sharedWith.
export const MAX_SHARED_WHITELABELS = 3;

export function isForeignPatient(patient: Pick<Patient, 'whitelabelId'>, activeWhitelabelId: string): boolean {
  return !!patient.whitelabelId && patient.whitelabelId !== activeWhitelabelId;
}

export function patientOwnerWhitelabel(patient: Pick<Patient, 'whitelabelId'>, activeWhitelabelId: string): string {
  return patient.whitelabelId ?? activeWhitelabelId;
}

export function isExternalAppointment(appointment: Pick<Appointment, 'whitelabelId'>, activeWhitelabelId: string): boolean {
  return !!appointment.whitelabelId && appointment.whitelabelId !== activeWhitelabelId;
}

export function splitAppointments<T extends Pick<Appointment, 'whitelabelId'>>(list: T[], activeWhitelabelId: string) {
  const own: T[] = [];
  const external: T[] = [];
  list.forEach((item) => (isExternalAppointment(item, activeWhitelabelId) ? external : own).push(item));
  return { own, external };
}

// Pacotes do terapeuta e os antigos, sem terapeuta, que servem a qualquer um.
export function packagesForTherapist<T extends Pick<Package, 'therapistId'>>(packages: T[], therapistId: string): T[] {
  return packages.filter((pkg) => !pkg.therapistId || pkg.therapistId === therapistId);
}

export function allowedShareTargets(links: WhitelabelLinks | null) {
  return links?.targets ?? [];
}

export function clampShareTargets(requested: string[], allowedIds: string[]): string[] {
  const allowed = new Set(allowedIds);
  return [...new Set(requested)].filter((id) => allowed.has(id)).slice(0, MAX_SHARED_WHITELABELS);
}

// Id da cópia-índice no whitelabel de destino: {origem}__{id do original}.
export function sharedCopyId(originWhitelabelId: string, id: string): string {
  return `${originWhitelabelId}__${id}`;
}

// Cópia do cadastro para a lista do destino. Sem sharedWith (é do original) e sem id/whitelabelId.
export function buildPatientCopy(patient: Patient & { id: string }, ownerWhitelabelId: string) {
  const { id, whitelabelId, sharedWith, ...rest } = patient;
  return { ...rest, ownerWhitelabelId, patientId: id };
}

// Cópia do agendamento para a agenda do destino: só o bloco de horário.
// shortcut: notas e evolução clínica ficam de fora de propósito; se o destino precisar delas, abrir por outro caminho. evolutionId vai, para o destino saber que já registrou.
export function buildAppointmentCopy(appointment: Appointment & { id: string }, sourceWhitelabelId: string) {
  const { id, whitelabelId, notes, clinicalEvolution, sharedToWhitelabels, ...rest } = appointment;
  return { ...rest, sourceWhitelabelId, appointmentId: id };
}

export function copyTargetsDiff(previous: string[] | undefined, next: string[]) {
  const before = new Set(previous ?? []);
  const after = new Set(next);
  return {
    add: next.filter((id) => !before.has(id)),
    remove: [...before].filter((id) => !after.has(id)),
  };
}

export function buildSharedWithAudit(
  patientId: string,
  ownerWhitelabelId: string,
  targets: string[],
  actor: { uid: string; email: string },
) {
  return {
    action: 'PACIENTE_COMPARTILHADO' as const,
    patientId,
    ownerWhitelabelId,
    targets,
    actorUid: actor.uid,
    actorEmail: actor.email,
  };
}

// "Meu dia" do destino: o terapeuta vê só os compartilhados em que ele é o terapeuta; os outros papéis veem todos.
export function visibleExternalAppointments<T extends Pick<Appointment, 'therapistId'>>(list: T[], role: string | null | undefined, email: string): T[] {
  return role === 'TERAPEUTA' ? list.filter((item) => item.therapistId === email) : list;
}
