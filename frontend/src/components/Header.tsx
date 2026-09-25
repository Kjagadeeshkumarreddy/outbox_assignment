import React from 'react';
import { Mail, LogOut, Plus, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onOpenCompose: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenCompose,
  onOpenLogin,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">ReachInbox</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Scheduler
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenCompose}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Compose New Email
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2.5">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name || user.email}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-medium text-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block text-left text-xs">
                    <div className="font-semibold text-slate-900 leading-tight">{user.name || 'User'}</div>
                    <div className="text-slate-500 leading-tight truncate max-w-[140px]">{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <UserIcon className="w-4 h-4 mr-1.5 text-slate-500" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
