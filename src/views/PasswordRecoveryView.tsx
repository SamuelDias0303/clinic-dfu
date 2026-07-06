import React, { useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { motion } from 'motion/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface PasswordRecoveryViewProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

const GENERIC_SUCCESS_MESSAGE = 'Se este e-mail estiver cadastrado, enviaremos um link de recuperacao de senha, verifique sua caixa de entrada, incluindo a pasta de spam.';

function getPasswordRecoveryError(error: any) {
  if (error?.code === 'auth/invalid-email') {
    return 'Informe um e-mail valido para continuar.';
  }

  if (error?.code === 'auth/too-many-requests') {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  return 'Nao foi possivel processar a solicitacao agora. Tente novamente em instantes.';
}

export default function PasswordRecoveryView({ initialEmail = '', onBackToLogin }: PasswordRecoveryViewProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    setError(null);
    setSuccessMessage(null);

    if (!normalizedEmail) {
      setError('Informe seu e-mail para receber as instrucoes de recuperacao.');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccessMessage(GENERIC_SUCCESS_MESSAGE);
    } catch (err: any) {
      console.error('Password recovery error:', err);

      if (err?.code === 'auth/user-not-found') {
        setSuccessMessage(GENERIC_SUCCESS_MESSAGE);
        return;
      }

      setError(getPasswordRecoveryError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="size-12 bg-primary rounded-xl flex items-center justify-center text-white mb-4">
            <Stethoscope size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Recuperar senha</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 text-center">
            Informe seu e-mail para receber instrucoes de acesso.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg font-medium">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> Enviar link</>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium hover:text-primary dark:hover:text-primary"
          >
            <ArrowLeft size={16} />
            Voltar para login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
