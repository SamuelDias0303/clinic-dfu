import React from 'react';
import { Building2, ShieldAlert } from 'lucide-react';

interface TenantAccessStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'warning' | 'info';
}

export default function TenantAccessState({
  title,
  message,
  actionLabel,
  onAction,
  variant = 'warning',
}: TenantAccessStateProps) {
  const Icon = variant === 'warning' ? ShieldAlert : Building2;
  const iconClass = variant === 'warning'
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    : 'bg-primary/10 text-primary';

  return (
    <div className="min-h-[420px] flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm">
        <div className={`size-12 rounded-lg ${iconClass} flex items-center justify-center mx-auto mb-4`}>
          <Icon size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-6 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
