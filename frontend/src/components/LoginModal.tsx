import React, { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDemoLogin: (email: string, name: string) => Promise<User>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onDemoLogin,
}) => {
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleGoogleClick = () => {
    window.location.href = '/api/auth/google';
  };

  const handleDemoClick = async (email?: string, name?: string) => {
    setIsDemoLoading(true);
    try {
      await onDemoLogin(
        email || customEmail || 'alex@reachinbox.ai',
        name || customName || 'Alex Johnson'
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Sign in to ReachInbox</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <button
            onClick={handleGoogleClick}
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors shadow-xs"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-2 text-xs text-slate-400">or 1-click test login</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleDemoClick('alex@reachinbox.ai', 'Alex Johnson')}
              disabled={isDemoLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-colors shadow-xs disabled:opacity-50"
            >
              {isDemoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              <span>Continue as Alex Johnson (Demo User)</span>
            </button>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800">Or custom tester name/email:</div>
              <div className="flex space-x-2">
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleDemoClick()}
                  className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded font-medium text-xs text-slate-700"
                >
                  Enter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
