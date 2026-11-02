import { randomUUID } from 'node:crypto';

const sessions = new Map<string, { customerId: string | null }>();
export function createSession() { const id = randomUUID(); sessions.set(id, { customerId: null }); return id; }
export function rotateSession(id: string, customerId: string | null) { sessions.delete(id); const next = randomUUID(); sessions.set(next, { customerId }); return next; }
export function ownsOrder(orderCustomerId: string | null, customerId: string | null) { return Boolean(customerId && orderCustomerId === customerId); }
