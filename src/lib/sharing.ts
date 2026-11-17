import { Appointment, Package, Patient, ShareLevel, WhitelabelLinks } from '../types';

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
export function buildPatientCopy(patient: Patient & { id: string }, ownerWhitelabelId: string, accessLevel?: ShareLevel) {
  const { id, whitelabelId, sharedWith, sharedAccess, accessLevel: _ignored, ...rest } = patient;
  return { ...rest, ownerWhitelabelId, patientId: id, ...(accessLevel ? { accessLevel } : {}) };
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

// --- Níveis de acesso por destino ------------------------------------------
export const SHARE_LEVELS: ShareLevel[] = ['LEITURA', 'PADRAO', 'EDICAO'];

export const SHARE_LEVEL_LABELS: Record<ShareLevel, string> = {
  LEITURA: 'Só leitura',
  PADRAO: 'Padrão',
  EDICAO: 'Edição',
};

export function levelOf(access: Record<string, ShareLevel> | undefined, whitelabelId: string): ShareLevel {
  return access?.[whitelabelId] ?? 'PADRAO';
}

// Agendar, evoluir e anamnese: tudo menos só leitura.
export function canWriteClinical(level: ShareLevel): boolean {
  return level !== 'LEITURA';
}

export function canEditSharedPatient(level: ShareLevel): boolean {
  return level === 'EDICAO';
}

// Paciente do próprio whitelabel nunca é limitado; o compartilhado usa o nível da cópia.
export function patientLevel(patient: Pick<Patient, 'whitelabelId' | 'accessLevel'>, activeWhitelabelId: string): ShareLevel {
  return isForeignPatient(patient, activeWhitelabelId) ? patient.accessLevel ?? 'PADRAO' : 'EDICAO';
}

// Só chaves que continuam em sharedWith e níveis válidos.
export function normalizeAccess(sharedWith: string[], access: Record<string, ShareLevel> | undefined): Record<string, ShareLevel> {
  const result: Record<string, ShareLevel> = {};
  sharedWith.forEach((id) => {
    const level = access?.[id];
    if (level && SHARE_LEVELS.includes(level)) result[id] = level;
  });
  return result;
}

// Campos que o destino com nível EDICAO nunca grava no paciente de origem (as regras também negam).
const FOREIGN_FORBIDDEN_FIELDS = [
  'id', 'whitelabelId', 'createdAt', 'sharedWith', 'sharedAccess', 'accessLevel',
  'therapistId', 'therapistName', 'ownerWhitelabelId', 'patientId',
];

export function stripForeignEditFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const result: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!FOREIGN_FORBIDDEN_FIELDS.includes(key)) result[key] = value;
  });
  return result as Partial<T>;
}

// --- Painel de compartilhados -------------------------------------------------
export interface SharedRow {
  patientId: string;
  patientName: string;
  targetId: string;
  targetName: string;
  level: ShareLevel;
}

// Uma linha por paciente e destino, por nome do paciente e depois pela ordem dos destinos no cadastro.
export function sharedRows(patients: (Patient & { id: string })[], targetName: (id: string) => string): SharedRow[] {
  return patients
    .filter((patient) => (patient.sharedWith ?? []).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((patient) => (patient.sharedWith ?? []).map((targetId) => ({
      patientId: patient.id,
      patientName: patient.name,
      targetId,
      targetName: targetName(targetId),
      level: levelOf(patient.sharedAccess, targetId),
    })));
}

export function withTargetLevel(patient: Pick<Patient, 'sharedWith' | 'sharedAccess'>, targetId: string, level: ShareLevel) {
  const sharedWith = patient.sharedWith ?? [];
  return { sharedWith, sharedAccess: normalizeAccess(sharedWith, { ...(patient.sharedAccess ?? {}), [targetId]: level }) };
}

export function withoutTarget(patient: Pick<Patient, 'sharedWith' | 'sharedAccess'>, targetId: string) {
  const sharedWith = (patient.sharedWith ?? []).filter((id) => id !== targetId);
  return { sharedWith, sharedAccess: normalizeAccess(sharedWith, patient.sharedAccess) };
}

// Filtro "Compartilhados": paciente que este whitelabel compartilhou ou que veio de outro.
export function isSharedPatient(patient: Pick<Patient, 'whitelabelId' | 'sharedWith'>, activeWhitelabelId: string): boolean {
  return isForeignPatient(patient, activeWhitelabelId) || (patient.sharedWith ?? []).length > 0;
}
