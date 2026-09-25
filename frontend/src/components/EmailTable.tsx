import React from 'react';
import { ExternalLink, Trash2, Mail, Clock } from 'lucide-react';
import { EmailRecord, EmailStatus } from '../types';

interface EmailTableProps {
  type: 'scheduled' | 'sent';
  emails: EmailRecord[];
  isLoading: boolean;
  onCancel?: (id: string) => void;
  onComposeClick: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const isFuture = diffMs > 0;
  const absDiffSeconds = Math.floor(Math.abs(diffMs) / 1000);

  if (absDiffSeconds < 10) {
    return isFuture ? 'in a few seconds' : 'just now';
  }
  if (absDiffSeconds < 60) {
    return isFuture ? `in ${absDiffSeconds}s` : `${absDiffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(absDiffSeconds / 60);
  if (diffMinutes < 60) {
    return isFuture ? `in ${diffMinutes}m` : `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return isFuture ? `in ${diffHours}h` : `${diffHours}h ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: EmailStatus }) {
  switch (status) {
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Sent
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          Failed
        </span>
      );
    case 'rate_limited':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Rate Limited
        </span>
      );
    case 'queued':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
          Queued
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Scheduled
        </span>
      );
  }
}

export const EmailTable: React.FC<EmailTableProps> = ({
  type,
  emails,
  isLoading,
  onCancel,
  onComposeClick,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center space-x-4 animate-pulse">
              <div className="w-1/4 h-4 bg-slate-100 rounded" />
              <div className="w-2/4 h-4 bg-slate-100 rounded" />
              <div className="w-1/6 h-4 bg-slate-100 rounded" />
              <div className="w-1/12 h-4 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          {type === 'scheduled' ? <Clock className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          {type === 'scheduled' ? 'No scheduled emails in queue' : 'No sent emails yet'}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
          {type === 'scheduled'
            ? 'When you schedule email jobs with delayed dispatch, they will appear here.'
            : 'Emails dispatched by the BullMQ worker via Ethereal SMTP will appear here with live preview links.'}
        </p>
        <button
          onClick={onComposeClick}
          className="inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-colors"
        >
          Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">Recipient</th>
              <th className="px-6 py-3">Subject</th>
              <th className="px-6 py-3">{type === 'scheduled' ? 'Scheduled For' : 'Sent At'}</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {emails.map((email) => {
              const displayTime =
                type === 'scheduled' ? email.scheduled_at : email.sent_at || email.updated_at;

              return (
                <tr key={email.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{email.recipient}</div>
                    <div className="text-xs text-slate-400">from {email.sender}</div>
                  </td>
                  <td className="px-6 py-3.5 max-w-xs truncate">
                    <span className="font-medium text-slate-800">{email.subject}</span>
                    {email.error_message && (
                      <div
                        className={`text-xs truncate ${
                          email.status === 'rate_limited' ? 'text-amber-600' : 'text-rose-600'
                        }`}
                      >
                        {email.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap" title={new Date(displayTime).toLocaleString()}>
                    <div className="text-slate-900 font-medium">{formatRelativeTime(displayTime)}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(displayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <StatusBadge status={email.status} />
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-right">
                    {type === 'sent' && email.ethereal_url ? (
                      <a
                        href={email.ethereal_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs font-medium text-sky-600 hover:text-sky-800 hover:underline"
                      >
                        <span>Ethereal Preview</span>
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    ) : type === 'scheduled' && onCancel ? (
                      <button
                        onClick={() => onCancel(email.id)}
                        title="Cancel this scheduled send"
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
