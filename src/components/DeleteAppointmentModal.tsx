import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Trash2, Layers } from 'lucide-react';

interface DeleteAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteSingle: () => Promise<void>;
  onDeleteSeries?: () => Promise<void>;
  isRecurring: boolean;
}

export default function DeleteAppointmentModal({
  isOpen,
  onClose,
  onDeleteSingle,
  onDeleteSeries,
  isRecurring,
}: DeleteAppointmentModalProps) {
  const [loading, setLoading] = React.useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Excluir Agendamento</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {isRecurring
                  ? 'Este é um agendamento recorrente. Como você deseja prosseguir com a exclusão?'
                  : 'Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.'}
              </p>

              {isRecurring ? (
                <div className="grid gap-3">
                  <button
                    onClick={() => handleAction(onDeleteSingle)}
                    disabled={loading}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:bg-rose-900/20"
                  >
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-500 transition-colors group-hover:bg-rose-100 group-hover:text-rose-600 dark:bg-slate-800 dark:group-hover:bg-rose-900/30 dark:group-hover:text-rose-400">
                      <Trash2 size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Apenas este agendamento</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Exclui somente o horário selecionado.</div>
                    </div>
                  </button>

                  <button
                    onClick={() => onDeleteSeries && handleAction(onDeleteSeries)}
                    disabled={loading}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:bg-rose-900/20"
                  >
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-500 transition-colors group-hover:bg-rose-100 group-hover:text-rose-600 dark:bg-slate-800 dark:group-hover:bg-rose-900/30 dark:group-hover:text-rose-400">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Toda a série</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Exclui todos os agendamentos desta recorrência.</div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleAction(onDeleteSingle)}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
