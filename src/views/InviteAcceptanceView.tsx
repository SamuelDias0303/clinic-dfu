import React, { useEffect, useRef, useState } from 'react';
import { browserSessionPersistence, createUserWithEmailAndPassword, setPersistence, signOut, updateProfile } from 'firebase/auth';
import { CheckCircle2, Loader2, Lock, Mail, Stethoscope, UserRound, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { inviteService } from '../services/inviteService';
import { UserInvite } from '../types';

interface InviteAcceptanceViewProps {
  token: string;
  onFinished: () => void;
}

export default function InviteAcceptanceView({ token, onFinished }: InviteAcceptanceViewProps) {
  const [invite, setInvite] = useState<UserInvite | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const attemptedCurrentUserActivation = useRef(false);

  const validateForm = () => {
    if (!invite) return 'Convite nao carregado.';
    if (invite.status !== 'PENDENTE') return 'Convite nao esta pendente.';
    if (!name.trim()) return 'Informe o nome para ativar a conta.';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (password !== confirmPassword) return 'As senhas nao conferem.';
    return null;
  };

  useEffect(() => {
    let mounted = true;

    async function loadInvite() {
      setLoading(true);
      setError(null);

      try {
        const data = await inviteService.getInvite(token);
        if (!mounted) return;

        if (!data || data.status !== 'PENDENTE') {
          setError('Convite nao encontrado ou ja utilizado.');
          setInvite(null);
          return;
        }

        setInvite(data);
        setName(data.name);
      } catch (loadError) {
        console.error('Error loading invite:', loadError);
        if (mounted) setError('Nao foi possivel carregar o convite.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInvite();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!invite || success || saving || attemptedCurrentUserActivation.current) return;
    if (auth.currentUser?.email?.toLowerCase() !== invite.email.toLowerCase()) return;

    attemptedCurrentUserActivation.current = true;
    handleActivateCurrentUser();
  }, [invite, saving, success]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await setPersistence(auth, browserSessionPersistence);
      const credential = await createUserWithEmailAndPassword(auth, invite.email, password);
      await updateProfile(credential.user, { displayName: name.trim() || invite.name });
      await inviteService.acceptInvite(
        { ...invite, name: name.trim() || invite.name },
        credential.user.uid,
        credential.user.email
      );
      setSuccess(true);
    } catch (acceptError: any) {
      console.error('Error accepting invite:', acceptError);
      if (acceptError.code === 'auth/email-already-in-use') {
        setError('Este e-mail ja possui conta. Entre normalmente com e-mail e senha ou use recuperacao de senha.');
      } else {
        setError(acceptError.message || 'Nao foi possivel ativar a conta.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleActivateCurrentUser = async () => {
    if (!invite || !auth.currentUser) return;

    if (auth.currentUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
      setError('A conta logada nao corresponde ao e-mail do convite.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await inviteService.acceptInvite(
        { ...invite, name: name.trim() || invite.name },
        auth.currentUser.uid,
        auth.currentUser.email
      );
      setSuccess(true);
    } catch (activateError: any) {
      console.error('Error activating current user:', activateError);
      setError(activateError.message || 'Nao foi possivel ativar o convite com a conta atual.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-8"
      >
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-12 bg-primary rounded-xl flex items-center justify-center text-white mb-4">
            <Stethoscope size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Ativar acesso</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {invite ? `${invite.whitelabelName} convidou voce para acessar a plataforma.` : 'Validando convite de acesso.'}
          </p>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : success ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Conta ativada</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Seu acesso foi criado. Voce ja pode entrar na aplicacao.
              </p>
            </div>
            <button
              onClick={async () => {
                await signOut(auth).catch(() => undefined);
                window.history.replaceState({}, document.title, window.location.pathname);
                onFinished();
              }}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Ir para login
            </button>
          </div>
        ) : error && !invite ? (
          <div className="space-y-5 text-center">
            <XCircle className="mx-auto text-rose-600" size={42} />
            <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <button
              onClick={onFinished}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Ir para login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  disabled
                  value={invite?.email ?? ''}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              disabled={saving}
              type="submit"
              className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : 'Ativar conta'}
            </button>

            {auth.currentUser && auth.currentUser.email?.toLowerCase() !== invite?.email.toLowerCase() && (
              <button
                disabled={saving}
                type="button"
                onClick={handleActivateCurrentUser}
                className="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Ativar com conta ja logada
              </button>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
