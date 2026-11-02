import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRouter } from './router.js';
import { createApp } from './app.js';
import { openSqlite } from './db/sqlite.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.INTENT_OS_APP_ROOT || packageRoot);
const configModule = await import(pathToFileURL(path.join(root, 'app.config.js')).href);
const config = { database: 'sqlite', payments: 'stripe', auth: 'session', ...(configModule.default || configModule.config || {}) };
if (config.database !== 'sqlite') throw new Error(`Unsupported database adapter: ${config.database}`);
if (!['session', 'none'].includes(config.auth)) throw new Error(`Unsupported auth mode: ${config.auth}`);
if (process.env.NODE_ENV === 'production' && !process.env.INTENT_OS_SESSION_SECRET) throw new Error('INTENT_OS_SESSION_SECRET is required in production.');
const schemaModule = await import(pathToFileURL(path.join(root, 'schema.js')).href);
const applicationSchema = schemaModule.default || schemaModule.schema;
const productModule = await import(pathToFileURL(path.join(root, 'src/data/products.js')).href);
const appProducts = productModule.default || productModule.products || [];
const database = config.database === 'sqlite' ? openSqlite(process.env.INTENT_OS_DATABASE || ':memory:', { schema: applicationSchema, seedProducts: appProducts, migrationsPath: path.join(root, 'migrations') }) : null;
const app = createApp({ config, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public'), database, resources: database ? new Map([
  ['Product', database.resource('Product')],
]) : undefined });

export function startServer(port = (process.env.PORT === undefined ? 3000 : Number(process.env.PORT))) {
  const server = http.createServer((request, response) => app(request, response));
  const shutdown = () => server.close(() => database?.close());
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server.listen(port, () => console.log(`Intent OS listening on http://localhost:${server.address().port}`));
}
