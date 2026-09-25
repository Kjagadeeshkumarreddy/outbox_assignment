import React from 'react';
import { Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { EmailStats } from '../types';

interface StatsCardsProps {
  stats: EmailStats | null;
  isLoading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading }) => {
  const cards = [
    {
      title: 'Scheduled / In Queue',
      value: stats?.scheduled ?? 0,
      icon: Clock,
      color: 'text-sky-600 bg-sky-50 border-sky-200',
      description: 'Persistent BullMQ delayed jobs',
    },
    {
      title: 'Successfully Sent',
      value: stats?.sent ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      description: 'Dispatched via Ethereal SMTP',
    },
    {
      title: 'Failed',
      value: stats?.failed ?? 0,
      icon: AlertCircle,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      description: 'Exceeded max retry attempts',
    },
    {
      title: 'Rate Limited',
      value: stats?.rateLimited ?? 0,
      icon: ShieldAlert,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      description: 'Deferred to next hour window',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-md border ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
};
