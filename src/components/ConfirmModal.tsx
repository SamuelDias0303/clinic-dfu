import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmModalProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error in confirmation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const variantClasses = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200',
    info: 'bg-primary hover:bg-primary/90 shadow-primary/20'
  };

  const iconClasses = {
    danger: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    info: 'text-primary bg-primary/10 dark:bg-primary/20'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="p-6 text-center">
          <div className={`mx-auto size-14 rounded-full flex items-center justify-center mb-4 ${iconClasses[variant]}`}>
            <AlertTriangle size={28} />
          </div>
          
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{message}</p>
          
          <div className="flex flex-col gap-3 sm:flex-row">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button 
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${variantClasses[variant]}`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
