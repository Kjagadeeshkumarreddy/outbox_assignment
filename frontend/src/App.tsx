import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { TabSwitcher } from './components/TabSwitcher';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { LoginModal } from './components/LoginModal';
import { api } from './lib/api';
import { EmailRecord, EmailStats, SchedulePayload, User } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [statsRes, scheduledRes, sentRes] = await Promise.all([
        api.getStats(),
        api.getScheduled(),
        api.getSent(),
      ]);

      setStats(statsRes);
      setScheduledEmails(scheduledRes.items);
      setSentEmails(sentRes.items);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
      localStorage.setItem('reachinbox_token', tokenFromUrl);
      document.cookie = `token=${tokenFromUrl}; path=/; max-age=604800`;
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorFromUrl) {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast(`Sign in error: ${errorFromUrl}`, 'error');
    }

    api.getMe().then(({ user }) => {
      setUser(user);
      if (user) {
        setIsLoginOpen(false);
        if (tokenFromUrl) {
          showToast(`Welcome, ${user.name || user.email}!`);
        }
      }
    });

    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleSchedule = async (payload: SchedulePayload) => {
    const res = await api.schedule(payload);
    showToast(
      `Successfully enqueued ${res.count} email ${res.count === 1 ? 'job' : 'jobs'} in BullMQ`
    );
    await loadData(true);
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      showToast('Scheduled email cancelled and removed from queue');
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel email', 'error');
    }
  };

  const handleDemoLogin = async (email: string, name: string) => {
    const res = await api.devLogin(email, name);
    setUser(res.user);
    setIsLoginOpen(false);
    showToast(`Signed in as ${res.user.name || res.user.email}`);
    await loadData(true);
    return res.user;
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    showToast('Logged out');
    await loadData(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        user={user}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Job Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">
            Persistent BullMQ delayed jobs with Redis rate limiting and Ethereal SMTP delivery
          </p>
        </div>

        <StatsCards stats={stats} isLoading={isLoading} />

        <TabSwitcher
          activeTab={activeTab}
          onTabChange={setActiveTab}
          scheduledCount={stats?.scheduled ?? scheduledEmails.length}
          sentCount={stats?.sent ?? sentEmails.length}
          onRefresh={() => loadData(false)}
          isRefreshing={isRefreshing}
        />

        <EmailTable
          type={activeTab}
          emails={activeTab === 'scheduled' ? scheduledEmails : sentEmails}
          isLoading={isLoading}
          onCancel={activeTab === 'scheduled' ? handleCancelEmail : undefined}
          onComposeClick={() => setIsComposeOpen(true)}
        />
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSubmit={handleSchedule}
        defaultSender={user?.email}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onDemoLogin={handleDemoLogin}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-rose-900 text-white border-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
