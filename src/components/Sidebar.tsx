import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Settings, 
  Stethoscope,
  UserRound,
  LogOut,
  Sparkles
} from 'lucide-react';
import { UserRole, View } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  role: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activeView, onNavigate, role, isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();
  const navItems = [
    { id: 'DASHBOARD', icon: LayoutDashboard, label: 'Painel', roles: ['ADMIN_GLOBAL', 'GESTOR', 'REPCAO', 'TERAPEUTA'] },
    { id: 'AGENDA', icon: Calendar, label: 'Agenda', roles: ['GESTOR', 'REPCAO', 'TERAPEUTA'] },
    { id: 'PACIENTES', icon: Users, label: 'Pacientes', roles: ['GESTOR', 'REPCAO', 'TERAPEUTA'] },
    { id: 'TERAPEUTAS', icon: UserRound, label: 'Terapeutas', roles: ['GESTOR'] },
    { id: 'BACKOFFICE', icon: ShieldCheck, label: role === 'GESTOR' ? 'Gestao' : 'Backoffice', roles: ['ADMIN_GLOBAL', 'GESTOR'] },
    { id: 'AI_RESOURCES', icon: Sparkles, label: 'Recursos IA', roles: ['ADMIN_GLOBAL'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(role));

  const handleNavigate = (view: View) => {
    onNavigate(view);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-50 transition-transform duration-300 -translate-x-full lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : ''
      }`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Stethoscope size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Clinic DFU</h1>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <LogOut size={20} className="rotate-180 text-slate-400" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as View)}
              className={`w-full group relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeView === item.id 
                  ? 'bg-primary/5 dark:bg-primary/10 text-primary' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {activeView === item.id && (
                <div className="absolute left-0 w-0.5 h-4 bg-primary rounded-r-full" />
              )}
              <item.icon size={20} className={activeView === item.id ? 'text-primary' : 'text-slate-500'} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 space-y-1">
          <button 
            onClick={() => handleNavigate('CONFIGURACOES')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
          >
            <Settings size={20} className="text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">Configurações</span>
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer transition-colors group"
          >
            <LogOut size={20} className="text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
