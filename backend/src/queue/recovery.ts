import { query } from '../db/client';
import { EmailRecord } from '../types';
import { enqueueEmailJob } from './queue';

export async function runRecoverySweep(): Promise<{ recoveredCount: number }> {
  try {
    const res = await query<EmailRecord>(
      `SELECT * FROM emails WHERE status IN ('pending', 'rate_limited') ORDER BY scheduled_at ASC LIMIT 500`
    );

    let count = 0;
    const now = Date.now();

    for (const email of res.rows) {
      const scheduledTime = new Date(email.scheduled_at).getTime();
      const delayMs = Math.max(0, scheduledTime - now);

      try {
        await enqueueEmailJob(email.id, delayMs);
        count++;
      } catch (err: any) {
      }
    }

    if (count > 0) {
      console.log(`Recovery sweep reconciled ${count} pending/rate-limited jobs`);
    }

    return { recoveredCount: count };
  } catch (err) {
    console.error('Error during startup recovery sweep:', err);
    return { recoveredCount: 0 };
  }
}
