import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  subtext?: string;
}

export default function StatCard({ label, value, trend, trendType, icon: Icon, subtext }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-tight min-w-0">{label}</span>
        <Icon size={20} className="text-primary shrink-0" />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</span>
        {trend && (
          <span className={`text-xs font-bold ${
            trendType === 'positive' ? 'text-emerald-500' : 
            trendType === 'negative' ? 'text-rose-500' : 
            'text-slate-400 dark:text-slate-500'
          }`}>
            {trend}
          </span>
        )}
        {subtext && (
          <span className={`text-xs font-medium leading-tight ${
            trendType === 'negative' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
          }`}>{subtext}</span>
        )}
      </div>
    </div>
  );
}
