import { Queue, QueueOptions } from 'bullmq';
import { redis } from '../rateLimiter/hourlyLimiter';
import { EmailJobData } from '../types';

export const QUEUE_NAME = 'email-send';

const queueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      count: 2000,
    },
    removeOnFail: {
      count: 2000,
    },
  },
};

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, queueOptions);

export async function enqueueEmailJob(emailId: string, delayMs: number) {
  const safeDelay = Math.max(0, Math.floor(delayMs));
  return emailQueue.add(
    'send-email',
    { emailId },
    {
      delay: safeDelay,
      jobId: emailId,
    }
  );
}

export async function enqueueBatchEmailJobs(
  jobs: Array<{ emailId: string; delayMs: number }>
) {
  if (jobs.length === 0) return [];

  const chunkSize = 250;
  const results = [];

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const bulkPayload = chunk.map((item) => ({
      name: 'send-email',
      data: { emailId: item.emailId },
      opts: {
        delay: Math.max(0, Math.floor(item.delayMs)),
        jobId: item.emailId,
      },
    }));

    const added = await emailQueue.addBulk(bulkPayload);
    results.push(...added);
  }

  return results;
}
