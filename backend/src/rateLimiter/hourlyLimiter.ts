import Redis from 'ioredis';
import { config } from '../config';

export const redis = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function checkAndIncrementRateLimit(
  sender: string,
  maxPerHour: number = config.worker.maxEmailsPerHour
): Promise<{ allowed: boolean; currentCount: number; msUntilNextWindow: number }> {
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const nextHourStart = (hourWindow + 1) * 3600000;
  const msUntilNextWindow = Math.max(1000, nextHourStart - now + 1000);

  const key = `rate:${sender}:${hourWindow}`;

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) || 1;
  const ttl = (results?.[1]?.[1] as number) || -1;

  if (ttl === -1) {
    await redis.expire(key, 3600);
  }

  if (count > maxPerHour) {
    return {
      allowed: false,
      currentCount: count,
      msUntilNextWindow,
    };
  }

  return {
    allowed: true,
    currentCount: count,
    msUntilNextWindow: 0,
  };
}

export async function getRateLimitStatus(sender: string, maxPerHour: number = config.worker.maxEmailsPerHour) {
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const key = `rate:${sender}:${hourWindow}`;
  const raw = await redis.get(key);
  const currentCount = raw ? parseInt(raw, 10) : 0;
  return {
    currentCount,
    maxPerHour,
    remaining: Math.max(0, maxPerHour - currentCount),
  };
}
