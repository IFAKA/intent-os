import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function createCsrfSecret() {
  return randomBytes(32).toString('hex');
}

export function createCsrfToken(sessionId, secret) {
  if (!sessionId || !secret) throw new TypeError('A session and secret are required');
  return createHmac('sha256', secret).update(String(sessionId)).digest('hex');
}

export function verifyCsrfToken(token, sessionId, secret) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = createCsrfToken(sessionId, secret);
  return timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expected, 'utf8'));
}

