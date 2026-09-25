export type EmailStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'rate_limited';

export interface EmailRecord {
  id: string;
  user_id: string | null;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  ethereal_url: string | null;
  error_message: string | null;
  retry_count: number;
  batch_id: string | null;
  hourly_limit?: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface EmailJobData {
  emailId: string;
}

export interface ScheduleRequest {
  recipients: string[];
  sender?: string;
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenSeconds?: number;
  hourlyLimit?: number;
}
