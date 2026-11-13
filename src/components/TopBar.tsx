import React from 'react';
import { LogOut, UserCircle, Menu, Sun, Moon, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface TopBarProps {
  role: UserRole;
  onLogout: () => Promise<void>;
  onSwitchProfile?: () => void;
  onSwitchWhitelabel?: () => void;
  onReturnToGlobalAdmin?: () => void;
  onMenuClick?: () => void;
}

export default function TopBar({ role, onLogout, onSwitchProfile, onSwitchWhitelabel, onReturnToGlobalAdmin, onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const activeMembership = user?.whitelabelMemberships?.find(
    (membership) => membership.whitelabelId === user.activeWhitelabelId
  );

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'ADMIN_GLOBAL': return 'Administrador Global';
      case 'GESTOR': return 'Gestor';
      case 'REPCAO': return 'Recepção';
      case 'TERAPEUTA': return 'Terapeuta';
      default: return r;
    }
  };

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-4 lg:px-8 py-3 lg:py-4">
      <div className="glass-effect rounded-xl px-3 sm:px-4 lg:px-6 min-h-14 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={onSwitchWhitelabel}
            disabled={!onSwitchWhitelabel}
            className="hidden md:inline text-sm font-medium text-slate-500 truncate disabled:cursor-default hover:text-primary transition-colors"
            title={onSwitchWhitelabel ? 'Trocar whitelabel' : undefined}
          >
            {activeMembership?.whitelabelName || activeMembership?.whitelabelId || 'Admin Global'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 shrink-0">
          {onReturnToGlobalAdmin && (
            <button
              onClick={onReturnToGlobalAdmin}
              className="hidden sm:flex items-center gap-1.5 text-[10px] lg:text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline transition-all"
              title="Sair da simulação e voltar ao painel de Admin Global"
            >
              <ShieldCheck size={14} />
              Voltar ao Admin Global
            </button>
          )}

          {onSwitchProfile && (
            <button 
              onClick={onSwitchProfile}
              className="hidden sm:block text-[10px] lg:text-xs font-bold text-primary hover:underline transition-all"
            >
              Trocar Perfil
            </button>
          )}

          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[100px]">{user?.name || 'Usuário'}</span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">{getRoleLabel(role)}</span>
            </div>
            <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {user?.name?.substring(0, 2).toUpperCase() || <UserCircle size={20} />}
            </div>
          </div>
 
          <button 
            onClick={onLogout}
            className="flex items-center justify-center p-2 lg:px-3 lg:py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-900/20 dark:hover:text-rose-300 dark:hover:border-rose-900 transition-all shadow-sm active:scale-95"
            title="Sair"
          >
            <LogOut size={16} />
            <span className="hidden lg:inline ml-2">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
