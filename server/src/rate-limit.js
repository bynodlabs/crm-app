import { config } from './config.js';

const buckets = new Map();

const getBucketKey = (req, scope = 'global') => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();
  return `${scope}:${ip}`;
};

export const consumeRateLimit = (req, scope = 'global') => {
  const now = Date.now();
  const key = getBucketKey(req, scope);
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    const fresh = {
      count: 1,
      resetAt: now + config.authRateWindowMs,
    };
    buckets.set(key, fresh);
    return { allowed: true, remaining: config.authRateLimit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= config.authRateLimit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { allowed: true, remaining: Math.max(0, config.authRateLimit - existing.count), resetAt: existing.resetAt };
};

export const clearRateLimit = (req, scope = 'global') => {
  buckets.delete(getBucketKey(req, scope));
};
