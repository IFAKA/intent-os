import { randomUUID } from 'node:crypto';

export function createSessionManager({ secure = false, sameSite = 'Lax', maxAge = 60 * 60 * 24 * 30, store = null } = {}) {
  const sessions = new Map();
  const newSession = (customerId = null) => {
    const id = randomUUID();
    const session = { id, customerId };
    sessions.set(id, session);
    store?.saveSession(session, Date.now() + maxAge * 1000);
    return sessions.get(id);
  };
  const rotate = (session, customerId = session?.customerId ?? null) => {
    if (session?.id) { sessions.delete(session.id); store?.deleteSession(session.id); }
    return newSession(customerId);
  };
  const login = (session, customerId) => rotate(session, customerId);
  const logout = (session) => {
    if (session?.id) { sessions.delete(session.id); store?.deleteSession(session.id); }
    return null;
  };
  const get = (id) => {
    if (!id) return null;
    const memorySession = sessions.get(id);
    if (memorySession) return memorySession;
    const persisted = store?.getSession(id);
    if (!persisted) return null;
    sessions.set(id, persisted);
    return persisted;
  };
  const cookie = (sessionId, { clear = false } = {}) => [
    `intent_session=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${clear ? 0 : maxAge}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  return { newSession, rotate, login, logout, get, cookie };
}

export function assertOwner(record, ownerId, field = 'customer_id') {
  if (!record || record[field] !== ownerId) throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
  return record;
}

export function createRateLimiter({ limit = 30, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return {
    check(key) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.startedAt >= windowMs) { buckets.set(key, { startedAt: now, count: 1 }); return true; }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
  };
}
