import React, { useState } from 'react';
import { 
  Stethoscope, 
  Lock, 
  Mail, 
  Loader2, 
  Chrome, 
  UserPlus, 
  LogIn 
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface LoginViewProps {
  onLogin: (email: string) => void;
  onForgotPassword: (email: string) => void;
}

function getEmailPasswordAuthErrorMessage(error: any) {
  if (error?.code === 'auth/email-already-in-use') {
    return 'Ja existe uma conta com este e-mail. Entre usando o metodo cadastrado originalmente.';
  }

  if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
    return 'E-mail ou senha invalidos. Confira os dados e tente novamente.';
  }

  if (error?.code === 'auth/invalid-email') {
    return 'Informe um e-mail valido para continuar.';
  }

  if (error?.code === 'auth/weak-password') {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  return error?.message || 'Ocorreu um erro na autenticacao.';
}

function getGoogleAuthErrorMessage(error: any) {
  if (error?.code === 'auth/account-exists-with-different-credential') {
    return 'Ja existe uma conta com este e-mail usando outro metodo de acesso. Entre com e-mail e senha para preservar o cadastro original.';
  }

  if (error?.code === 'auth/credential-already-in-use') {
    return 'Esta conta Google ja esta vinculada a outro acesso. Entre usando o metodo cadastrado originalmente.';
  }

  if (error?.code === 'auth/popup-closed-by-user') {
    return 'Entrada com Google cancelada antes da conclusao.';
  }

  if (error?.code === 'auth/unauthorized-domain') {
    return 'Este dominio nao esta autorizado no Firebase. Adicione os URLs da App nas configuracoes de dominios autorizados do Firebase.';
  }

  return `Erro ao entrar com o Google: ${error?.message || 'nao foi possivel concluir o acesso.'}`;
}

export default function LoginView({ onLogin, onForgotPassword }: LoginViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin(email);
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(getEmailPasswordAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);
      
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email) {
        onLogin(result.user.email);
      }
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError(getGoogleAuthErrorMessage(err));
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clinic DFU</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 text-center">
            {isSignUp ? 'Crie sua conta na plataforma terapeutica' : 'Bem-vindo de volta a sua plataforma terapeutica'}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary dark:bg-slate-800" 
              />
              Lembrar de mim
            </label>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => onForgotPassword(email)}
                disabled={loading}
                className="text-primary font-semibold hover:underline disabled:opacity-50 disabled:hover:no-underline"
              >
                Esqueceu a senha?
              </button>
            )}
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              isSignUp ? <><UserPlus size={20} /> Criar Conta</> : <><LogIn size={20} /> Entrar</>
            )}
          </button>
        </form>

        {!isSignUp && (
          <div className="mt-6">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
              </div>
              <span className="relative px-4 bg-white dark:bg-slate-900 text-xs text-slate-400 uppercase font-bold tracking-wider">Ou continue com</span>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <Chrome size={20} className="text-primary" />
              Entrar com Google
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-xs text-slate-600 dark:text-slate-400 font-medium"
          >
            {isSignUp ? 'Ja tem uma conta? ' : 'Nao tem uma conta? '}
            <span className="text-primary font-bold hover:underline">
              {isSignUp ? 'Fazer login' : 'Criar agora'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
