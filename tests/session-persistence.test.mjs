import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../framework/app.js';
import { createCsrfToken } from '../framework/csrf.js';
import { openSqlite } from '../framework/db/sqlite.js';
import { createRouter } from '../framework/router.js';

const root = path.resolve(import.meta.dirname, '..');
const secret = 'restart-session-secret';

async function start(database) {
  const app = createApp({ database, sessionSecret: secret, router: createRouter(path.join(root, 'pages')), publicDirectory: path.join(root, 'public') });
  const server = http.createServer((request, response) => app(request, response));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, port: server.address().port };
}

test('signed-in account survives a server restart with the same SQLite database', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-session-restart-'));
  const filename = path.join(directory, 'store.sqlite');
  let database = openSqlite(filename);
  let running = await start(database);
  try {
    const page = await fetch(`http://127.0.0.1:${running.port}/account`);
    const cookie = page.headers.get('set-cookie');
    const sessionId = decodeURIComponent(cookie.match(/intent_session=([^;]+)/)[1]);
    const login = await fetch(`http://127.0.0.1:${running.port}/_app/action/auth.login`, {
      method: 'POST',
      redirect: 'manual',
      body: new URLSearchParams({ email: 'restart@example.com', csrfToken: createCsrfToken(sessionId, secret) }),
      headers: { cookie },
    });
    assert.equal(login.status, 303);
    const signedInCookie = login.headers.get('set-cookie');
    await new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
    database.close();

    database = openSqlite(filename);
    running = await start(database);
    const account = await fetch(`http://127.0.0.1:${running.port}/account`, { headers: { cookie: signedInCookie } });
    assert.match(await account.text(), /Signed in/);
  } finally {
    await new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
