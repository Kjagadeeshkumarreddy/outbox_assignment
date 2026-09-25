import React, { useState, useId } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Calendar, Clock, Loader2 } from 'lucide-react';
import { SchedulePayload } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SchedulePayload) => Promise<void>;
  defaultSender?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultSender,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawRecipients, setRawRecipients] = useState('');
  const [sender, setSender] = useState(defaultSender || '');
  const [scheduleType, setScheduleType] = useState<'now' | 'future'>('now');
  const [futureDateTime, setFutureDateTime] = useState('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputId = useId();

  if (!isOpen) return null;

  const detectedEmails = Array.from(
    new Set(rawRecipients.match(EMAIL_REGEX) || [])
  ).map((email) => email.toLowerCase());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawRecipients((prev) => (prev ? `${prev}\n${content}` : content));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (detectedEmails.length === 0) {
      setErrorMessage('Please provide at least one valid recipient email address.');
      return;
    }

    if (!subject.trim()) {
      setErrorMessage('Please enter an email subject.');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Please enter email body content.');
      return;
    }

    let startTime: string | null = null;
    if (scheduleType === 'future') {
      if (!futureDateTime) {
        setErrorMessage('Please select a scheduled date and time.');
        return;
      }
      startTime = new Date(futureDateTime).toISOString();
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        recipients: detectedEmails,
        sender: sender.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        startTime,
        delayBetweenSeconds,
        hourlyLimit: hourlyLimit > 0 ? hourlyLimit : undefined,
      });

      onClose();
      setSubject('');
      setBody('');
      setRawRecipients('');
      setScheduleType('now');
      setFutureDateTime('');
      setDelayBetweenSeconds(2);
      setHourlyLimit(100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to schedule emails.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Compose & Schedule Batch</h2>
            <p className="text-xs text-slate-500">Configure email jobs with BullMQ delayed queue</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center space-x-2 p-3 text-xs rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Recipients (CSV or Text)
              </label>
              <label
                htmlFor={fileInputId}
                className="inline-flex items-center text-xs font-medium text-sky-600 hover:text-sky-800 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Upload CSV / TXT
              </label>
              <input
                id={fileInputId}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              rows={3}
              placeholder="Paste email addresses or upload CSV (comma, space, or newline separated)..."
              value={rawRecipients}
              onChange={(e) => setRawRecipients(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs">
                {detectedEmails.length > 0 ? (
                  <span className="inline-flex items-center text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {detectedEmails.length} valid {detectedEmails.length === 1 ? 'address' : 'addresses'} detected
                  </span>
                ) : (
                  <span className="text-slate-400">No email addresses detected yet</span>
                )}
              </div>
              {detectedEmails.length > 0 && (
                <span className="text-[11px] text-slate-400 truncate max-w-xs">
                  {detectedEmails.slice(0, 3).join(', ')}
                  {detectedEmails.length > 3 ? ` +${detectedEmails.length - 3} more` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                placeholder="Important updates for your team"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Sender Email (Optional)
              </label>
              <input
                type="email"
                placeholder={defaultSender || 'noreply@reachinbox-scheduler.test'}
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Body (HTML Supported)
            </label>
            <textarea
              rows={4}
              required
              placeholder="Hi there,<br><br>We are excited to share..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Queue & Timing
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md border transition-colors ${
                      scheduleType === 'now'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Immediate
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('future')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md border transition-colors ${
                      scheduleType === 'future'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Scheduled
                  </button>
                </div>
                {scheduleType === 'future' && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      required={scheduleType === 'future'}
                      value={futureDateTime}
                      onChange={(e) => setFutureDateTime(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Delay Between Leads (Seconds)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={delayBetweenSeconds}
                      onChange={(e) => setDelayBetweenSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                      staggers queue dispatch
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Hourly Limit (Emails / Hour)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={hourlyLimit}
                      onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-500">
                      max sends per sender window
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || detectedEmails.length === 0}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <span>
                Schedule {detectedEmails.length > 0 ? `${detectedEmails.length} Emails` : 'Emails'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
