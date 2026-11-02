import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateSchemaSql, schema } from '../schema.js';
import { openSqlite } from '../framework/db/sqlite.js';

test('schema IR generates all ecommerce tables', () => {
  const sql = generateSchemaSql(schema);
  for (const table of ['products', 'categories', 'product_categories', 'carts', 'cart_items', 'customers', 'orders', 'order_items', 'payments', 'webhook_events', 'sessions']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(sql, /price_minor INTEGER NOT NULL/);
});

test('checked-in schema.sql matches the schema IR output', async () => {
  assert.equal(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'), generateSchemaSql(schema));
});

test('SQLite migration and seed expose high-level product reads', () => {
  const db = openSqlite();
  try {
    assert.equal(db.resource('Product').find({ slug: 'field-notes' }).price, 18);
    assert.deepEqual(db.resource('Product').list({ limit: 2 }).items.map((item) => item.slug), ['field-notes', 'signal-mug']);
    assert.equal(db.resource('Product').list({ limit: 2 }).hasNext, true);
  } finally { db.close(); }
});

test('runtime applies pending migration files once for existing databases', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-runtime-migrations-'));
  const databasePath = path.join(directory, 'app.sqlite');
  const migrationsPath = path.join(directory, 'migrations');
  const first = openSqlite(databasePath, { seed: false, migrationsPath });
  first.close();

  await mkdir(migrationsPath);
  await writeFile(migrationsPath + '/20260815-add-note.sql', 'ALTER TABLE payments ADD COLUMN migration_note TEXT;\n', { flag: 'w' });
  const second = openSqlite(databasePath, { seed: false, migrationsPath });
  try {
    assert.match(second.database.prepare('PRAGMA table_info(payments)').all().map((column) => column.name).join(','), /migration_note/);
    assert.equal(second.database.prepare('SELECT COUNT(*) AS count FROM _intent_os_migrations').get().count, 1);
  } finally { second.close(); }

  const third = openSqlite(databasePath, { seed: false, migrationsPath });
  try { assert.equal(third.database.prepare('SELECT COUNT(*) AS count FROM _intent_os_migrations').get().count, 1); } finally { third.close(); }
});

test('cursor pagination and prepared parameters are enforced by the adapter', () => {
  const db = openSqlite();
  try {
    const first = db.resource('Product').list({ limit: 1 });
    const second = db.resource('Product').list({ limit: 1, after: first.nextCursor });
    assert.equal(second.items[0].slug, 'signal-mug');
    assert.equal(db.resource('Product').find({ slug: "' OR 1=1 --" }), undefined);
  } finally { db.close(); }
});

test('transactions commit and rollback as one unit', () => {
  const db = openSqlite();
  try {
    db.transaction(({ resource }) => resource('Cart').create({ id: 'cart-1', session_id: 'session-1', created_at: 1, updated_at: 1 }));
    assert.equal(db.resource('Cart').find({ id: 'cart-1' }).session_id, 'session-1');
    assert.throws(() => db.transaction(({ resource }) => {
      resource('Cart').create({ id: 'cart-2', session_id: 'session-2', created_at: 1, updated_at: 1 });
      resource('Cart').create({ id: 'cart-2', session_id: 'session-3', created_at: 1, updated_at: 1 });
    }));
    assert.equal(db.resource('Cart').find({ id: 'cart-2' }), undefined);
  } finally { db.close(); }
});

test('order drafts reserve inventory and convert the source cart atomically', () => {
  const db = openSqlite();
  try {
    db.cartAdd({ sessionId: 'order-session', productId: '01', quantity: 2 });
    const order = db.createOrderDraft({ sessionId: 'order-session' });
    assert.equal(order.status, 'draft');
    assert.equal(order.total_minor, 3600);
    assert.equal(order.items[0].priceMinor, 1800);
    assert.equal(db.resource('Product').find({ id: '01' }).inventory_count, 8);
    assert.equal(db.cartSummary('order-session').count, 0);
  } finally { db.close(); }
});

test('inventory conflicts roll back reservation and reject unowned orders', () => {
  const db = openSqlite();
  try {
    db.cartAdd({ sessionId: 'conflict-session', productId: '02', quantity: 11 });
    assert.throws(() => db.createOrderDraft({ sessionId: 'conflict-session' }), /no longer available/);
    assert.equal(db.resource('Product').find({ id: '02' }).inventory_count, 10);

    db.cartAdd({ sessionId: 'owner-session', productId: '03', quantity: 1 });
    const order = db.createOrderDraft({ sessionId: 'owner-session' });
    assert.throws(() => db.orderState(order.id, 'other-session'), /Order not found/);
    const pending = db.transitionOrder({ orderId: order.id, sessionId: 'owner-session', status: 'checkout_pending' });
    assert.equal(pending.status, 'checkout_pending');
    assert.throws(() => db.transitionOrder({ orderId: order.id, sessionId: 'owner-session', status: 'draft' }), /Cannot move/);
  } finally { db.close(); }
});
