import React from 'react';
import { Clock, Send, RotateCw } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  scheduledCount: number;
  sentCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const TabSwitcher: React.FC<TabSwitcherProps> = ({
  activeTab,
  onTabChange,
  scheduledCount,
  sentCount,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 mb-4 pb-3">
      <div className="flex space-x-1 sm:space-x-2">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'scheduled'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Scheduled Emails</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'scheduled'
                ? 'bg-slate-800 text-slate-200'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'sent'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent Emails</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'sent'
                ? 'bg-slate-800 text-slate-200'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh data"
        className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-md transition-colors"
      >
        <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
};
