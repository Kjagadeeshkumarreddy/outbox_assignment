import { EmailRecord, EmailStats, SchedulePayload, User } from '../types';

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('reachinbox_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  async getMe(): Promise<{ user: User | null }> {
    try {
      return await request<{ user: User | null }>('/auth/me');
    } catch {
      return { user: null };
    }
  },

  async devLogin(email: string = 'demo@reachinbox.ai', name: string = 'ReachInbox Demo'): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
    if (res.token) {
      localStorage.setItem('reachinbox_token', res.token);
    }
    return res;
  },

  async logout(): Promise<{ success: boolean }> {
    localStorage.removeItem('reachinbox_token');
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  },

  async getStats(): Promise<EmailStats> {
    return request<EmailStats>('/emails/stats');
  },

  async getScheduled(limit = 100, offset = 0): Promise<{ items: EmailRecord[]; total: number }> {
    return request<{ items: EmailRecord[]; total: number }>(
      `/emails/scheduled?limit=${limit}&offset=${offset}`
    );
  },

  async getSent(limit = 100, offset = 0): Promise<{ items: EmailRecord[]; total: number }> {
    return request<{ items: EmailRecord[]; total: number }>(
      `/emails/sent?limit=${limit}&offset=${offset}`
    );
  },

  async schedule(payload: SchedulePayload): Promise<{ success: boolean; count: number; batchId: string }> {
    return request<{ success: boolean; count: number; batchId: string }>('/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelEmail(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/emails/${id}`, {
      method: 'DELETE',
    });
  },
};
