import type { Appointment, Package, Patient } from '../types';

// Avisa a família quando restam até este número de sessões.
export const PACKAGE_ENDING_THRESHOLD = 2;

// Sessões usadas são derivadas dos agendamentos, nunca gravadas: cancelar,
// reabrir ou apagar uma sessão corrige o número sozinho.
export function packageProgress(
  pkg: Pick<Package, 'totalSessions' | 'status'>,
  appointments: Pick<Appointment, 'status'>[],
) {
  const used = appointments.filter((appointment) => appointment.status === 'CONCLUÍDO').length;
  const total = pkg.totalSessions;
  const complete = used >= total;
  const remaining = Math.max(total - used, 0);
  const open = pkg.status === 'ATIVO' && !complete;

  return {
    used,
    total,
    remaining,
    complete,
    open,
    ending: open && remaining <= PACKAGE_ENDING_THRESHOLD,
  };
}

export interface PackageOverviewRow {
  packageId: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  used: number;
  total: number;
  remaining: number;
  complete: boolean;
  ending: boolean;
}

// Uma linha por pacote não encerrado, com o terapeuta do paciente. Pacote cujo
// paciente não está na lista (ex.: terapeuta só enxerga os próprios) fica de fora.
// Abertos primeiro, do menor saldo para o maior; completos no fim.
export function packageOverview(
  packages: Package[],
  patients: Pick<Patient, 'id' | 'name' | 'therapistId' | 'therapistName'>[],
  appointments: Pick<Appointment, 'status' | 'packageId'>[],
): PackageOverviewRow[] {
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  return packages
    .filter((pkg) => pkg.status !== 'ENCERRADO' && patientsById.has(pkg.patientId))
    .map((pkg) => {
      const patient = patientsById.get(pkg.patientId)!;
      const progress = packageProgress(pkg, appointments.filter((appointment) => appointment.packageId === pkg.id));
      return {
        packageId: pkg.id ?? '',
        patientId: pkg.patientId,
        patientName: patient.name,
        // Pacote novo é de um terapeuta; o antigo cai no terapeuta do paciente.
        therapistId: pkg.therapistId || patient.therapistId || '',
        therapistName: (pkg.therapistId ? pkg.therapistName : patient.therapistName) || 'Sem terapeuta',
        used: progress.used,
        total: progress.total,
        remaining: progress.remaining,
        complete: progress.complete,
        ending: progress.ending,
      };
    })
    .sort((a, b) =>
      Number(a.complete) - Number(b.complete)
      || a.remaining - b.remaining
      || a.patientName.localeCompare(b.patientName));
}
