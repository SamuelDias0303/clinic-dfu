import type { Appointment, Package } from '../types';

// Sessões usadas são derivadas dos agendamentos, nunca gravadas: cancelar,
// reabrir ou apagar uma sessão corrige o número sozinho.
export function packageProgress(
  pkg: Pick<Package, 'totalSessions' | 'status'>,
  appointments: Pick<Appointment, 'status'>[],
) {
  const used = appointments.filter((appointment) => appointment.status === 'CONCLUÍDO').length;
  const total = pkg.totalSessions;
  const complete = used >= total;

  return {
    used,
    total,
    remaining: Math.max(total - used, 0),
    complete,
    open: pkg.status === 'ATIVO' && !complete,
  };
}
