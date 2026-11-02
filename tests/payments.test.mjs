import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPaymentService, verifyStripeSignature } from '../framework/payments/stripe.js';
import { openSqlite } from '../framework/db/sqlite.js';
import { createApp } from '../framework/app.js';
import { createRouter } from '../framework/router.js';
import { createCsrfToken } from '../framework/csrf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function signed(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

function orderWithCart(database, sessionId = 'payment-session') {
  database.cartAdd({ sessionId, productId: '01', quantity: 1 });
  return database.createOrderDraft({ sessionId });
}

test('Stripe signatures require the raw body and reject forged or stale requests', () => {
  const secret = 'whsec_test';
  const body = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(body, signed(body, secret), secret), true);
  assert.equal(verifyStripeSignature('{"id":"evt_2"}', signed(body, secret), secret), false);
  assert.equal(verifyStripeSignature(body, signed(body, secret, 1), secret), false);
});

test('checkout uses the server order total and the Stripe client never reaches browser markup', async () => {
  const database = openSqlite();
  try {
    const order = orderWithCart(database);
    const calls = [];
    const service = createPaymentService({ database, webhookSecret: 'whsec_test', stripeClient: { createCheckoutSession: async (input) => { calls.push(input); return { id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }; } } });
    const checkout = await service.createCheckout({ orderId: order.id, sessionId: 'payment-session' });
    assert.equal(checkout.url, 'https://checkout.stripe.test/cs_test');
    assert.equal(calls[0].order.total_minor, 1800);
    assert.equal(calls[0].order.total_minor, database.orderState(order.id, 'payment-session').total_minor);
    assert.equal(calls[0].clientSecret, undefined);
    assert.equal(database.orderState(order.id, 'payment-session').status, 'checkout_pending');
  } finally { database.close(); }
});

test('return flow does not mark an order paid; a valid webhook fulfills it once', async () => {
  const database = openSqlite();
  try {
    const order = orderWithCart(database, 'webhook-session');
    const service = createPaymentService({ database, webhookSecret: 'whsec_test', stripeClient: { createCheckoutSession: async () => ({ id: 'cs_webhook', url: 'https://checkout.stripe.test/cs_webhook' }) } });
    await service.createCheckout({ orderId: order.id, sessionId: 'webhook-session' });
    assert.equal(database.orderState(order.id, 'webhook-session').status, 'checkout_pending');
    const body = JSON.stringify({ id: 'evt_webhook_1', type: 'checkout.session.completed', data: { object: { id: 'cs_webhook', amount_total: 1800, currency: 'eur' } } });
    assert.deepEqual(service.handleWebhook(body, signed(body, 'whsec_test')), { duplicate: false, eventId: 'evt_webhook_1', handled: true, orderId: order.id, status: 'fulfilled' });
    assert.equal(database.orderState(order.id, 'webhook-session').status, 'fulfilled');
    assert.deepEqual(service.handleWebhook(body, signed(body, 'whsec_test')), { duplicate: true, eventId: 'evt_webhook_1' });
    assert.equal(database.paymentForOrder(order.id).status, 'paid');
  } finally { database.close(); }
});

test('mismatched webhook amounts are rejected and do not fulfill the order', async () => {
  const database = openSqlite();
  try {
    const order = orderWithCart(database, 'mismatch-session');
    const service = createPaymentService({ database, webhookSecret: 'whsec_test', stripeClient: { createCheckoutSession: async () => ({ id: 'cs_mismatch', url: 'https://checkout.stripe.test/cs_mismatch' }) } });
    await service.createCheckout({ orderId: order.id, sessionId: 'mismatch-session' });
    const body = JSON.stringify({ id: 'evt_mismatch', type: 'checkout.session.completed', data: { object: { id: 'cs_mismatch', amount_total: 1, currency: 'eur' } } });
    assert.throws(() => service.handleWebhook(body, signed(body, 'whsec_test')), /does not match/);
    assert.equal(database.orderState(order.id, 'mismatch-session').status, 'checkout_pending');
  } finally { database.close(); }
});

test('HTTP checkout action redirects to Stripe and webhook route accepts only signed raw payloads', async () => {
  const database = openSqlite();
  const secret = 'test-session-secret';
  const app = createApp({ database, sessionSecret: secret, stripeWebhookSecret: 'whsec_http', stripeClient: { createCheckoutSession: async () => ({ id: 'cs_http', url: 'https://checkout.stripe.test/cs_http' }) }, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const page = await fetch(`http://127.0.0.1:${port}/cart`);
    const cookie = page.headers.get('set-cookie');
    const sessionId = decodeURIComponent(cookie.match(/intent_session=([^;]+)/)[1]);
    const csrfToken = createCsrfToken(sessionId, secret);
    await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, { method: 'POST', body: new URLSearchParams({ productId: '01', quantity: '1', csrfToken }), headers: { cookie } });
    const draft = await fetch(`http://127.0.0.1:${port}/_app/action/order.create`, { method: 'POST', body: new URLSearchParams({ csrfToken }), headers: { cookie }, redirect: 'manual' });
    const orderId = new URL(`http://localhost${draft.headers.get('location')}`).searchParams.get('order');
    const checkout = await fetch(`http://127.0.0.1:${port}/_app/action/checkout.create`, { method: 'POST', body: new URLSearchParams({ orderId, csrfToken }), headers: { cookie }, redirect: 'manual' });
    assert.equal(checkout.status, 303);
    assert.equal(checkout.headers.get('location'), 'https://checkout.stripe.test/cs_http');
    const body = JSON.stringify({ id: 'evt_http', type: 'checkout.session.completed', data: { object: { id: 'cs_http', amount_total: 1800, currency: 'eur' } } });
    const webhook = await fetch(`http://127.0.0.1:${port}/_app/webhooks/stripe`, { method: 'POST', body, headers: { 'stripe-signature': signed(body, 'whsec_http') } });
    assert.equal(webhook.status, 200);
    assert.equal(database.orderState(orderId, sessionId).status, 'fulfilled');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});
