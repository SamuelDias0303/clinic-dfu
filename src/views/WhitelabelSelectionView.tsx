import React from 'react';
import { ArrowRight, Building2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { WhitelabelMembership } from '../types';
import { ROLE_LABELS } from '../lib/permissions';

interface WhitelabelSelectionViewProps {
  memberships: WhitelabelMembership[];
  onSelect: (whitelabelId: string) => void;
}

export default function WhitelabelSelectionView({ memberships, onSelect }: WhitelabelSelectionViewProps) {
  const activeMemberships = memberships.filter((membership) => membership.status === 'ATIVO');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Selecione o Whitelabel</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
            Escolha o ambiente de atendimento que deseja acessar.
          </p>
        </div>

        {activeMemberships.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm">
            <div className="size-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={24} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Nenhum whitelabel ativo</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Sua conta nao possui associacao ativa com um whitelabel. Solicite acesso a um administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMemberships.map((membership, index) => (
              <motion.button
                key={`${membership.whitelabelId}:${membership.userId}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => onSelect(membership.whitelabelId)}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-left shadow-sm hover:border-primary hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div className="flex items-center gap-1 text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Acessar <ArrowRight size={14} />
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {membership.whitelabelName || membership.whitelabelId}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Papeis: {membership.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
