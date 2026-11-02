import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActionRegistry } from '../framework/actions.js';
import { createApp } from '../framework/app.js';
import { openSqlite } from '../framework/db/sqlite.js';
import { createRouter } from '../framework/router.js';
import { createCsrfToken } from '../framework/csrf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sessionSecret = 'test-session-secret';

async function securityContext(port) {
  const page = await fetch(`http://127.0.0.1:${port}/cart`);
  const cookie = page.headers.get('set-cookie');
  const sessionId = decodeURIComponent(cookie.match(/intent_session=([^;]+)/)[1]);
  return { cookie, csrfToken: createCsrfToken(sessionId, sessionSecret) };
}

test('cart actions validate input and return authoritative totals', async () => {
  const database = openSqlite();
  const actions = createActionRegistry({ database });
  try {
    const added = await actions.run('cart.add', { sessionId: 'action-test', input: { productId: '01', quantity: '2' } });
    assert.equal(added.count, 2);
    assert.equal(added.total, 36);
    assert.match(added.summary, /Field Notes × 2/);

    await assert.rejects(() => actions.run('cart.add', { sessionId: 'action-test', input: { productId: 'missing', quantity: '1' } }), /Unknown product/);
    await assert.rejects(() => actions.run('cart.update', { sessionId: 'action-test', input: { productId: '01', quantity: '0' } }), /whole number/);
    assert.equal(database.cartSummary('action-test').count, 2);
  } finally {
    database.close();
  }
});

test('action endpoint emits multiple authoritative fragments', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const context = await securityContext(port);
    const response = await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, {
      method: 'POST',
      body: new URLSearchParams({ productId: '02', quantity: '1', csrfToken: context.csrfToken }),
      headers: { 'X-App-Request': 'fragment', cookie: context.cookie },
    });
    const markup = await response.text();
    assert.equal(response.status, 200);
    assert.match(markup, /data-fragment="cart-count">1/);
    assert.match(markup, /data-fragment="cart-total">€24\.00/);
    assert.match(markup, /data-fragment="toast"[^>]*>Added to cart\./);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('unknown action returns a structured form error fragment', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const context = await securityContext(port);
    const response = await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, { method: 'POST', body: new URLSearchParams({ productId: '01', quantity: '0', csrfToken: context.csrfToken }), headers: { cookie: context.cookie } });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /data-fragment="form-error"/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('action endpoint rejects mutations without a valid CSRF token', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, { method: 'POST', body: new URLSearchParams({ productId: '01', quantity: '1' }) });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /Invalid CSRF token/);
    assert.equal(database.cartSummary('anonymous').count, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('ordinary form submission falls back to the cart route', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const context = await securityContext(port);
    const response = await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ productId: '03', quantity: '1', csrfToken: context.csrfToken }), headers: { cookie: context.cookie } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/cart');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('account login normalizes email, rotates the session, and logout clears identity', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const page = await fetch(`http://127.0.0.1:${port}/account`);
    const cookie = page.headers.get('set-cookie');
    const sessionId = decodeURIComponent(cookie.match(/intent_session=([^;]+)/)[1]);
    const csrfToken = createCsrfToken(sessionId, sessionSecret);
    const login = await fetch(`http://127.0.0.1:${port}/_app/action/auth.login`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ email: '  PERSON@Example.COM ', csrfToken }), headers: { cookie } });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/account');
    const signedInCookie = login.headers.get('set-cookie');
    assert.notEqual(signedInCookie, cookie);
    const account = await fetch(`http://127.0.0.1:${port}/account`, { headers: { cookie: signedInCookie } });
    assert.match(await account.text(), /Signed in/);
    const rotatedId = decodeURIComponent(signedInCookie.match(/intent_session=([^;]+)/)[1]);
    const logout = await fetch(`http://127.0.0.1:${port}/_app/action/auth.logout`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ csrfToken: createCsrfToken(rotatedId, sessionSecret) }), headers: { cookie: signedInCookie } });
    assert.equal(logout.status, 303);
    assert.equal(database.resource('Customer').find({ email: 'person@example.com' }).email, 'person@example.com');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('order creation returns an owned draft and redirects ordinary forms to checkout', async () => {
  const database = openSqlite();
  const app = createApp({ database, sessionSecret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const context = await securityContext(port);
    const add = await fetch(`http://127.0.0.1:${port}/_app/action/cart.add`, { method: 'POST', body: new URLSearchParams({ productId: '01', quantity: '1', csrfToken: context.csrfToken }), headers: { cookie: context.cookie, 'X-App-Request': 'fragment' } });
    assert.equal(add.status, 200);
    const create = await fetch(`http://127.0.0.1:${port}/_app/action/order.create`, { method: 'POST', body: new URLSearchParams({ csrfToken: context.csrfToken }), headers: { cookie: context.cookie }, redirect: 'manual' });
    assert.equal(create.status, 303);
    assert.match(create.headers.get('location'), /^\/checkout\?order=order-/);
    const orderId = new URL(`http://localhost${create.headers.get('location')}`).searchParams.get('order');
    const checkout = await fetch(`http://127.0.0.1:${port}/checkout?order=${encodeURIComponent(orderId)}`, { headers: { cookie: context.cookie } });
    assert.equal(checkout.status, 200);
    assert.match(await checkout.text(), new RegExp(`data-order-id>${orderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});
