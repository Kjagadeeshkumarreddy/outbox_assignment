import { Worker, Job } from 'bullmq';
import { redis, checkAndIncrementRateLimit } from '../rateLimiter/hourlyLimiter';
import { getEmailById, updateEmailStatus } from '../services/emailService';
import { sendEmail } from '../services/mailer';
import { config } from '../config';
import { EmailJobData } from '../types';
import { QUEUE_NAME } from './queue';

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;

      const email = await getEmailById(emailId);
      if (!email) {
        return { skipped: true, reason: 'Record not found' };
      }

      if (email.status === 'sent') {
        return { skipped: true, reason: 'Already sent' };
      }

      const effectiveLimit = email.hourly_limit || config.worker.maxEmailsPerHour;
      const rateCheck = await checkAndIncrementRateLimit(
        email.sender,
        effectiveLimit
      );

      if (!rateCheck.allowed) {
        await updateEmailStatus(emailId, 'rate_limited', {
          errorMessage: `Hourly rate limit of ${effectiveLimit} exceeded. Rescheduled.`,
        });

        if (job.token) {
          await job.moveToDelayed(Date.now() + rateCheck.msUntilNextWindow, job.token);
        }

        return {
          rescheduled: true,
          delayMs: rateCheck.msUntilNextWindow,
        };
      }

      await updateEmailStatus(emailId, 'queued');

      try {
        const result = await sendEmail({
          from: email.sender,
          to: email.recipient,
          subject: email.subject,
          html: email.body,
        });

        await updateEmailStatus(emailId, 'sent', {
          etherealUrl: result.etherealUrl,
          sentAt: new Date(),
          errorMessage: null,
        });

        return {
          success: true,
          emailId,
          etherealUrl: result.etherealUrl,
        };
      } catch (err: any) {
        const errorMsg = err?.message || 'SMTP send failure';
        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

        await updateEmailStatus(emailId, isFinalAttempt ? 'failed' : 'pending', {
          errorMessage: errorMsg,
          incrementRetry: true,
        });

        throw err;
      }
    },
    {
      connection: redis,
      concurrency: config.worker.concurrency,
      limiter: {
        max: 1,
        duration: config.worker.sendDelayMs,
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (job) {
      console.warn(`Job ${job.id} failed attempt ${job.attemptsMade}: ${err.message}`);
    }
  });

  worker.on('completed', (job) => {
    if (job) {
      console.log(`Job ${job.id} completed successfully`);
    }
  });

  return worker;
}
