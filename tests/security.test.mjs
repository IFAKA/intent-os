import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsrfSecret, createCsrfToken, verifyCsrfToken } from '../framework/csrf.js';
import { assertOwner, createRateLimiter, createSessionManager } from '../framework/auth.js';
import { cartInput } from '../framework/validation.js';
import { escapeHtml } from '../framework/compiler.js';
import { openSqlite } from '../framework/db/sqlite.js';

test('CSRF tokens are session-bound and reject missing or forged values', () => {
  const secret = createCsrfSecret();
  const token = createCsrfToken('session-a', secret);
  assert.equal(verifyCsrfToken(token, 'session-a', secret), true);
  assert.equal(verifyCsrfToken(token, 'session-b', secret), false);
  assert.equal(verifyCsrfToken('forged', 'session-a', secret), false);
});

test('cart schema rejects unknown fields and enforces quantity limits', () => {
  assert.deepEqual(cartInput({ productId: '01', quantity: '2' }), { productId: '01', quantity: 2 });
  assert.throws(() => cartInput({ productId: '01', quantity: '100' }), /highlighted fields/);
  assert.throws(() => cartInput({ productId: '01', quantity: '1', price: '0' }), /Unexpected field/);
});

test('session rotation prevents fixation and ownership checks deny foreign records', () => {
  const sessions = createSessionManager();
  const original = sessions.newSession();
  const rotated = sessions.login(original, 'customer-1');
  assert.notEqual(rotated.id, original.id);
  assert.equal(sessions.get(original.id), null);
  assert.equal(sessions.get(rotated.id).customerId, 'customer-1');
  sessions.logout(rotated);
  assert.equal(sessions.get(rotated.id), null);
  assert.throws(() => assertOwner({ customer_id: 'customer-2' }, 'customer-1'), /Not found/);
});

test('session cookies expose safe attributes and rate limiter caps bursts', () => {
  const sessions = createSessionManager({ secure: true });
  const session = sessions.newSession();
  const cookie = sessions.cookie(session.id);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), false);
});

test('output escaping prevents markup injection', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('authoritative cart pricing rejects client price fields and injection-shaped IDs', () => {
  const database = openSqlite();
  try {
    assert.throws(() => cartInput({ productId: '01', quantity: '1', price: '0' }), /Unexpected field/);
    assert.throws(() => cartInput({ productId: "01' OR 1=1 --", quantity: '1' }), /valid product/);
    const cart = database.cartAdd({ sessionId: 'security-test', productId: '01', quantity: 1 });
    assert.equal(cart.totalMinor, 1800);
  } finally {
    database.close();
  }
});

test('database-backed sessions survive a new session manager', () => {
  const database = openSqlite();
  try {
    const customer = database.findOrCreateCustomer('persisted@example.com');
    const first = createSessionManager({ store: database });
    const session = first.login(first.newSession(), customer.id);
    const second = createSessionManager({ store: database });
    assert.equal(second.get(session.id).customerId, customer.id);
    second.logout(session);
    assert.equal(second.get(session.id), null);
  } finally {
    database.close();
  }
});
