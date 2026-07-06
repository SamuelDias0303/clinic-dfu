import React from 'react';
import { ArrowRight, ShieldCheck, UserCircle, UserRound, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../types';

interface ProfileSelectionViewProps {
  roles: UserRole[];
  onSelect: (role: UserRole) => void;
}

const roleConfig: Record<UserRole, { label: string; icon: any; color: string; desc: string }> = {
  ADMIN_GLOBAL: {
    label: 'Administrador Global',
    icon: ShieldCheck,
    color: 'bg-purple-100 text-purple-700',
    desc: 'Gestao de clientes, branding e dominios.',
  },
  GESTOR: {
    label: 'Gestor da Clinica',
    icon: Users,
    color: 'bg-blue-100 text-blue-700',
    desc: 'Gestao de unidades, terapeutas e pacientes.',
  },
  REPCAO: {
    label: 'Recepcao',
    icon: UserCircle,
    color: 'bg-emerald-100 text-emerald-700',
    desc: 'Agenda operacional e cadastros.',
  },
  TERAPEUTA: {
    label: 'Terapeuta',
    icon: UserRound,
    color: 'bg-amber-100 text-amber-700',
    desc: 'Atendimentos e registros clinicos.',
  },
};

export default function ProfileSelectionView({ roles, onSelect }: ProfileSelectionViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Selecione seu Perfil</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Identificamos multiplos acessos vinculados a sua conta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role, index) => {
            const config = roleConfig[role];
            return (
              <motion.button
                key={role}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSelect(role)}
                className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary dark:hover:border-primary transition-all text-left flex flex-col"
              >
                <div className={`size-12 rounded-xl ${config.color.includes('dark:') ? config.color : config.color + ' dark:bg-opacity-20'} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <config.icon size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{config.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex-1">{config.desc}</p>
                <div className="mt-4 flex items-center gap-2 text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  Acessar <ArrowRight size={16} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
