import type { Appointment, Evolution, Patient } from '../types';

// Datas por extenso saem em minúsculas do navegador; só a primeira letra sobe.
export const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Paciente que nenhum terapeuta enxerga: sem vínculo ou com o padrão 'platform' (gestor sem escolher).
export function isUnassigned(patient: Pick<Patient, 'therapistId'>) {
  return !patient.therapistId || patient.therapistId === 'platform';
}

// Evolução já escrita que pode ser ligada a uma sessão: sem vínculo e não usada por outro
// agendamento, da data mais próxima da sessão (AAAA-MM-DD) para a mais distante.
export function evolutionCandidates<T extends Pick<Evolution, 'id' | 'date' | 'appointmentId'>>(
  evolutions: T[],
  appointmentDate: string,
  usedIds: Set<string>,
): T[] {
  const [year, month, day] = appointmentDate.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const dayOf = (value: string) => {
    const [d, m, y] = value.split('/').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  return evolutions
    .filter((evolution) => evolution.id && !evolution.appointmentId && !usedIds.has(evolution.id))
    .sort((a, b) => Math.abs(dayOf(a.date) - target) - Math.abs(dayOf(b.date) - target) || dayOf(b.date) - dayOf(a.date));
}

// Sessão concluída que ainda não tem evolução: nem vinculada (evolutionId), nem
// escrita direto no agendamento (clinicalEvolution).
export function needsEvolution(appointment: Pick<Appointment, 'status' | 'evolutionId' | 'clinicalEvolution'>) {
  return appointment.status === 'CONCLUÍDO'
    && !appointment.evolutionId
    && !appointment.clinicalEvolution?.trim();
}

const plural = (value: number, singular: string, many: string) => `${value} ${value === 1 ? singular : many}`;

function parseBirthDate(value: string) {
  const br = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [year, month, day] = br
    ? [Number(br[3]), Number(br[2]), Number(br[1])]
    : iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [];
  if (!year) return null;

  const date = new Date(year, month - 1, day);
  const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isReal ? date : null;
}

// "1 ano e 11 meses", "5 meses", "14 dias". Vazio se a data for inválida ou futura.
export function formatAge(birthDate: string, today = new Date()) {
  const birth = parseBirthDate(birthDate ?? '');
  if (!birth || birth > today) return '';

  const months = (today.getFullYear() - birth.getFullYear()) * 12
    + (today.getMonth() - birth.getMonth())
    - (today.getDate() < birth.getDate() ? 1 : 0);

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest ? `${plural(years, 'ano', 'anos')} e ${plural(rest, 'mês', 'meses')}` : plural(years, 'ano', 'anos');
  }
  if (months >= 1) return plural(months, 'mês', 'meses');

  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    - Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate())) / 86_400_000);
  return plural(days, 'dia', 'dias');
}
