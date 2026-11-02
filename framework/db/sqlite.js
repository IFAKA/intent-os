import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateSchemaSql, schema } from '../../schema.js';
import { products as defaultProducts } from '../../src/data/products.js';
import { createAdapter } from './adapter.js';

const sleep = (ms) => { const buffer = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(buffer), 0, 0, ms); };

function withBusyRetry(operation, attempts = 4) {
  for (let attempt = 0; ; attempt += 1) {
    try { return operation(); } catch (error) {
      if (!String(error.code || error.message).includes('BUSY') || attempt >= attempts - 1) throw error;
      sleep(10 * (attempt + 1));
    }
  }
}

function migrationFiles(directory) {
  try {
    return readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => ({ file, sql: readFileSync(path.join(directory, file), 'utf8') }));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function applyMigrations(database, directory, { markOnly = false } = {}) {
  const files = migrationFiles(directory);
  if (!files.length) return;
  database.exec('CREATE TABLE IF NOT EXISTS _intent_os_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);');
  const applied = new Set(database.prepare('SELECT name FROM _intent_os_migrations').all().map(({ name }) => name));
  const pending = files.filter(({ file }) => !applied.has(file));
  for (const migration of pending) {
    withBusyRetry(() => {
      database.exec('BEGIN IMMEDIATE');
      try {
        if (!markOnly) database.exec(migration.sql);
        database.prepare('INSERT INTO _intent_os_migrations (name, applied_at) VALUES (?, ?)').run(migration.file, Date.now());
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw new Error(`Migration ${migration.file} failed: ${error.message}`, { cause: error });
      }
    });
  }
}

export function openSqlite(filename = ':memory:', { seed = true, migrationsPath = path.join(process.cwd(), 'migrations'), seedProducts = defaultProducts, schema: schemaDefinition = schema } = {}) {
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1000;');
  if (filename !== ':memory:') database.exec('PRAGMA journal_mode = WAL;');
  database.exec('CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);');
  const current = database.prepare('SELECT MAX(version) AS version FROM _migrations').get()?.version || 0;
  const bootstrapped = current === 0;
  if (current < schemaDefinition.version) {
    withBusyRetry(() => { database.exec('BEGIN IMMEDIATE'); try { database.exec(generateSchemaSql(schemaDefinition)); database.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(schemaDefinition.version, Date.now()); database.exec('COMMIT'); } catch (error) { database.exec('ROLLBACK'); throw error; } });
  }
  applyMigrations(database, migrationsPath, { markOnly: bootstrapped });
  const driver = {
    all(sql, params) { return withBusyRetry(() => database.prepare(sql).all(...params)); },
    get(sql, params) { return withBusyRetry(() => database.prepare(sql).get(...params)); },
    run(sql, params) { return withBusyRetry(() => database.prepare(sql).run(...params)); },
    transaction(callback) { return withBusyRetry(() => { database.exec('BEGIN IMMEDIATE'); try { const result = callback(); database.exec('COMMIT'); return result; } catch (error) { database.exec('ROLLBACK'); throw error; } }); },
  };
  const adapter = createAdapter(driver);
  if (seed) seedDatabase(adapter, seedProducts);
  return { ...adapter, database, close: () => database.close(), schemaSql: generateSchemaSql(schemaDefinition) };
}

function seedDatabase(adapter, seedProducts = defaultProducts) {
  if (adapter.resource('Product').list({ limit: 1 }).items.length) return;
  const now = Date.now();
  adapter.transaction(({ resource }) => {
    resource('Category').create({ id: 'stationery', slug: 'stationery', name: 'Stationery' });
    resource('Category').create({ id: 'home', slug: 'home', name: 'Home' });
    resource('Category').create({ id: 'apparel', slug: 'apparel', name: 'Apparel' });
    for (const [index, product] of seedProducts.entries()) {
      const id = String(product.id);
      const price = Number(product.price_minor ?? Math.round(Number(product.price ?? 0) * 100));
      resource('Product').create({ id, slug: product.slug || id, name: product.name, description: product.description || '', image: product.image || null, price_minor: price, inventory_count: Number(product.inventory_count ?? 10), currency: product.currency || 'EUR', active: product.active === false ? 0 : 1, created_at: Number(product.created_at ?? product.createdAt ?? seedProducts.length - index) });
      if (product.category) {
        const categoryId = String(product.category);
        try { resource('Category').create({ id: categoryId, slug: categoryId, name: categoryId }); } catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
        resource('ProductCategory').create({ product_id: id, category_id: categoryId });
      }
    }
    resource('Cart').create({ id: 'seed-cart', session_id: 'seed-session', created_at: now, updated_at: now });
    const firstProduct = seedProducts[0];
    if (firstProduct) {
      const firstProductId = String(firstProduct.id);
      const firstProductPrice = Number(firstProduct.price_minor ?? Math.round(Number(firstProduct.price ?? 0) * 100));
      resource('CartItem').create({ cart_id: 'seed-cart', product_id: firstProductId, quantity: 1, price_minor: firstProductPrice });
    }
  });
}
