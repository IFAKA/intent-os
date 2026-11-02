import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openSqlite } from '../framework/db/sqlite.js';
import { createRouter } from '../framework/router.js';
import { createApp } from '../framework/app.js';
import { createCsrfToken } from '../framework/csrf.js';
import http from 'node:http';

test('SQLite boots from the application schema rather than the package schema', () => {
  const schema = { version: 1, tables: { notes: { columns: { id: { type: 'TEXT', primaryKey: true } } } } };
  const database = openSqlite(':memory:', { schema, seed: false });
  try {
    assert.equal(database.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get()?.name, 'notes');
    assert.equal(database.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get(), undefined);
  } finally { database.close(); }
});

test('router discovers application-owned dynamic pages', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-routes-'));
  try {
    await mkdir(path.join(directory, 'orders'));
    await writeFile(path.join(directory, 'orders', '[id].html'), '<main>{{id}}</main>');
    const route = createRouter(directory).resolve('/orders/order-7');
    assert.equal(route.params.id, 'order-7');
    assert.match(route.filePath, /orders[\\/]\[id\]\.html$/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('ordinary invalid action requests return a complete HTML document', async () => {
  const database = openSqlite();
  const secret = 'application-runtime-test';
  const app = createApp({ database, sessionSecret: secret, router: createRouter(path.resolve('pages')), publicDirectory: path.resolve('public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const page = await fetch(`http://127.0.0.1:${server.address().port}/cart`);
    const cookie = page.headers.get('set-cookie');
    const sessionId = decodeURIComponent(cookie.match(/intent_session=([^;]+)/)[1]);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/_app/action/cart.add`, {
      method: 'POST',
      body: new URLSearchParams({ productId: '01', quantity: '0', csrfToken: createCsrfToken(sessionId, secret) }),
      headers: { cookie },
    });
    const markup = await response.text();
    assert.equal(response.status, 400);
    assert.match(markup, /^<!doctype html>/);
    assert.match(markup, /form-error/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('customer-owned order survives session identity and canceled inventory is released', () => {
  const database = openSqlite();
  try {
    const customer = database.findOrCreateCustomer('owner@example.com');
    database.cartAdd({ sessionId: 'customer-session', productId: '01', quantity: 1 });
    const order = database.createOrderDraft({ sessionId: 'customer-session', customerId: customer.id });
    assert.equal(database.orderState(order.id, 'other-session', customer.id).id, order.id);
    database.transitionOrder({ orderId: order.id, sessionId: 'other-session', customerId: customer.id, status: 'canceled' });
    assert.equal(database.resource('Product').find({ id: '01' }).inventory_count, 10);
  } finally { database.close(); }
});
