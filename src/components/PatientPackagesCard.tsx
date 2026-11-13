import { useEffect, useState } from 'react';
import { Package as PackageIcon, Plus, Loader2 } from 'lucide-react';
import { Appointment, Package } from '../types';
import { packageService } from '../services/packageService';
import { packageProgress } from '../lib/packageProgress';
import { useAuth } from '../contexts/AuthContext';

export default function PatientPackagesCard({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [totalSessions, setTotalSessions] = useState('');
  const [saving, setSaving] = useState(false);

  const whitelabelId = user?.activeWhitelabelId;
  // Terapeuta só lê os próprios agendamentos; a contagem dele reflete isso.
  const therapistId = user?.activeRole === 'TERAPEUTA' ? user.email : undefined;

  useEffect(() => {
    const unsubPackages = packageService.subscribeToPatientPackages(patientId, setPackages, whitelabelId);
    const unsubAppointments = packageService.subscribeToPatientAppointments(patientId, setAppointments, therapistId, whitelabelId);
    return () => {
      unsubPackages();
      unsubAppointments();
    };
  }, [patientId, whitelabelId, therapistId]);

  const handleCreate = async () => {
    const total = Number(totalSessions);
    if (!Number.isInteger(total) || total < 1 || total > 200) {
      alert('Informe um número inteiro de sessões entre 1 e 200.');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      await packageService.createPackage({ patientId, totalSessions: total, createdBy: user.email }, whitelabelId);
      setTotalSessions('');
      setShowForm(false);
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Erro ao criar pacote.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (id: string) => {
    if (!window.confirm('Encerrar este pacote? Ele deixa de aparecer na escolha de agendamentos.')) return;
    try {
      await packageService.closePackage(id, whitelabelId);
    } catch (error) {
      console.error('Error closing package:', error);
      alert('Erro ao encerrar pacote.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
          <PackageIcon size={20} className="text-[#1e5d8c] dark:text-blue-400" />
          Pacotes de atendimento
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e5d8c] text-white rounded-xl text-sm font-bold hover:bg-[#1e5d8c]/90 transition-all active:scale-95"
          >
            <Plus size={16} />
            NOVO PACOTE
          </button>
        )}
      </div>

      {showForm && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div>
            <label htmlFor="package-total" className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Total de sessões
            </label>
            <input
              id="package-total"
              type="number"
              min={1}
              max={200}
              value={totalSessions}
              onChange={(event) => setTotalSessions(event.target.value)}
              className="w-32 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#1e5d8c] text-white rounded-xl text-sm font-bold hover:bg-[#1e5d8c]/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            CRIAR
          </button>
          <button
            onClick={() => { setShowForm(false); setTotalSessions(''); }}
            disabled={saving}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            CANCELAR
          </button>
        </div>
      )}

      {packages.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum pacote para este paciente.</p>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => {
            const progress = packageProgress(pkg, appointments.filter((appointment) => appointment.packageId === pkg.id));
            const percent = Math.min(100, Math.round((progress.used / progress.total) * 100));
            const stateLabel = pkg.status === 'ENCERRADO' ? 'Encerrado' : progress.complete ? 'Concluído' : null;

            return (
              <li key={pkg.id} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {progress.used} de {progress.total} sessões
                    {stateLabel && (
                      <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase rounded-full">
                        {stateLabel}
                      </span>
                    )}
                  </p>
                  {pkg.status === 'ATIVO' && pkg.id && (
                    <button
                      onClick={() => handleClose(pkg.id!)}
                      className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      ENCERRAR
                    </button>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={Math.min(progress.used, progress.total)}
                  className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                >
                  <div className="h-full bg-[#1e5d8c] dark:bg-blue-600" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
