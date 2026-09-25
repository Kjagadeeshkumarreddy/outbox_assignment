import { query } from '../db/client';
import { EmailRecord, EmailStatus } from '../types';
import crypto from 'crypto';

export async function createEmailRecords(
  records: Array<{
    userId?: string | null;
    recipient: string;
    sender: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    batchId?: string;
    hourlyLimit?: number | null;
  }>
): Promise<EmailRecord[]> {
  if (records.length === 0) return [];

  const created: EmailRecord[] = [];

  const chunkSize = 100;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const valueClauses: string[] = [];
    const params: any[] = [];

    chunk.forEach((item, index) => {
      const id = crypto.randomUUID();
      const baseIndex = index * 9;
      valueClauses.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`
      );
      params.push(
        id,
        item.userId || null,
        item.recipient,
        item.sender,
        item.subject,
        item.body,
        item.scheduledAt.toISOString(),
        item.batchId || null,
        item.hourlyLimit || null
      );
    });

    const sql = `
      INSERT INTO emails (id, user_id, recipient, sender, subject, body, scheduled_at, batch_id, hourly_limit)
      VALUES ${valueClauses.join(', ')}
      RETURNING *;
    `;

    const res = await query<EmailRecord>(sql, params);
    created.push(...res.rows);
  }

  return created;
}

export async function getEmailById(id: string): Promise<EmailRecord | null> {
  const res = await query<EmailRecord>('SELECT * FROM emails WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function updateEmailStatus(
  id: string,
  status: EmailStatus,
  extra: {
    etherealUrl?: string | null;
    errorMessage?: string | null;
    sentAt?: Date | null;
    incrementRetry?: boolean;
  } = {}
): Promise<EmailRecord | null> {
  const fields: string[] = ['status = $2', 'updated_at = NOW()'];
  const params: any[] = [id, status];
  let paramIdx = 3;

  if (extra.etherealUrl !== undefined) {
    fields.push(`ethereal_url = $${paramIdx++}`);
    params.push(extra.etherealUrl);
  }

  if (extra.errorMessage !== undefined) {
    fields.push(`error_message = $${paramIdx++}`);
    params.push(extra.errorMessage);
  }

  if (extra.sentAt !== undefined) {
    fields.push(`sent_at = $${paramIdx++}`);
    params.push(extra.sentAt ? extra.sentAt.toISOString() : null);
  }

  if (extra.incrementRetry) {
    fields.push('retry_count = retry_count + 1');
  }

  const sql = `
    UPDATE emails
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const res = await query<EmailRecord>(sql, params);
  return res.rows[0] || null;
}

export async function getScheduledEmails(options: {
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: EmailRecord[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const whereClauses: string[] = ["status IN ('pending', 'queued', 'rate_limited')"];
  const params: any[] = [];
  let paramIdx = 1;

  if (options.userId) {
    whereClauses.push(`user_id = $${paramIdx++}`);
    params.push(options.userId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) FROM emails ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const itemsRes = await query<EmailRecord>(
    `SELECT * FROM emails ${whereSql} ORDER BY scheduled_at ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return { items: itemsRes.rows, total };
}

export async function getSentEmails(options: {
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: EmailRecord[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const whereClauses: string[] = ["status IN ('sent', 'failed')"];
  const params: any[] = [];
  let paramIdx = 1;

  if (options.userId) {
    whereClauses.push(`user_id = $${paramIdx++}`);
    params.push(options.userId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) FROM emails ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const itemsRes = await query<EmailRecord>(
    `SELECT * FROM emails ${whereSql} ORDER BY COALESCE(sent_at, updated_at) DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return { items: itemsRes.rows, total };
}

export async function getEmailStats(userId?: string) {
  const params: any[] = [];
  let whereSql = '';
  if (userId) {
    whereSql = 'WHERE user_id = $1';
    params.push(userId);
  }

  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pending', 'queued', 'rate_limited')) AS scheduled_count,
      COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited_count,
      COUNT(*) AS total_count
    FROM emails
    ${whereSql};
  `;

  const res = await query<{
    scheduled_count: string;
    sent_count: string;
    failed_count: string;
    rate_limited_count: string;
    total_count: string;
  }>(sql, params);

  const row = res.rows[0];
  return {
    scheduled: parseInt(row?.scheduled_count || '0', 10),
    sent: parseInt(row?.sent_count || '0', 10),
    failed: parseInt(row?.failed_count || '0', 10),
    rateLimited: parseInt(row?.rate_limited_count || '0', 10),
    total: parseInt(row?.total_count || '0', 10),
  };
}

export async function deleteScheduledEmail(id: string, userId?: string): Promise<boolean> {
  const params: any[] = [id];
  let userClause = '';
  if (userId) {
    userClause = 'AND user_id = $2';
    params.push(userId);
  }

  const res = await query(
    `DELETE FROM emails WHERE id = $1 AND status IN ('pending', 'rate_limited') ${userClause}`,
    params
  );

  return (res.rowCount ?? 0) > 0;
}
