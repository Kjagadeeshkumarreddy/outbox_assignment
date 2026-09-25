import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import {
  createEmailRecords,
  getScheduledEmails,
  getSentEmails,
  getEmailStats,
  deleteScheduledEmail,
} from '../services/emailService';
import { enqueueBatchEmailJobs, emailQueue } from '../queue/queue';
import { AuthenticatedRequest, optionalAuth } from './middleware';

export const scheduleRouter = Router();

scheduleRouter.use(optionalAuth);

const scheduleSchema = z.object({
  recipients: z
    .array(z.string().email())
    .min(1, 'At least one recipient email is required'),
  sender: z.string().email().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  startTime: z.string().datetime().optional().nullable(),
  delayBetweenSeconds: z.number().min(0).max(3600).optional().default(0),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
});

scheduleRouter.post('/schedule', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = scheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten(),
    });
  }

  const { recipients, subject, body, delayBetweenSeconds, hourlyLimit } = parseResult.data;
  const sender =
    parseResult.data.sender || req.user?.email || 'noreply@reachinbox-scheduler.test';

  const now = Date.now();
  const baseTime = parseResult.data.startTime
    ? Math.max(now, new Date(parseResult.data.startTime).getTime())
    : now;

  const batchId = crypto.randomUUID();
  const recordsToCreate = recipients.map((recipient, index) => {
    const scheduledTime = new Date(baseTime + index * (delayBetweenSeconds || 0) * 1000);
    return {
      userId: req.user?.id || null,
      recipient,
      sender,
      subject,
      body,
      scheduledAt: scheduledTime,
      batchId,
      hourlyLimit: hourlyLimit || null,
    };
  });

  try {
    const createdEmails = await createEmailRecords(recordsToCreate);

    const jobsToEnqueue = createdEmails.map((email) => {
      const scheduledTime = new Date(email.scheduled_at).getTime();
      const delayMs = Math.max(0, scheduledTime - Date.now());
      return {
        emailId: email.id,
        delayMs,
      };
    });

    await enqueueBatchEmailJobs(jobsToEnqueue);

    res.status(201).json({
      success: true,
      batchId,
      count: createdEmails.length,
      scheduledEmails: createdEmails,
    });
  } catch (err: any) {
    console.error('Failed to schedule email batch:', err);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

scheduleRouter.get('/scheduled', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const data = await getScheduledEmails({
      userId: req.user?.id,
      limit,
      offset,
    });

    res.json(data);
  } catch (err: any) {
    console.error('Failed to fetch scheduled emails:', err);
    res.status(500).json({ error: 'Failed to retrieve scheduled emails' });
  }
});

scheduleRouter.get('/sent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const data = await getSentEmails({
      userId: req.user?.id,
      limit,
      offset,
    });

    res.json(data);
  } catch (err: any) {
    console.error('Failed to fetch sent emails:', err);
    res.status(500).json({ error: 'Failed to retrieve sent emails' });
  }
});

scheduleRouter.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getEmailStats(req.user?.id);
    res.json(stats);
  } catch (err: any) {
    console.error('Failed to fetch email stats:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

scheduleRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);

  try {
    const deleted = await deleteScheduledEmail(id, req.user?.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Email not found or already sent' });
    }

    try {
      const job = await emailQueue.getJob(id);
      if (job) {
        await job.remove();
      }
    } catch {
    }

    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Failed to cancel email:', err);
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});
