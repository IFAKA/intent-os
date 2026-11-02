import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'bin', 'intent-os.js');
const serverEntry = path.join(root, 'server.js');

test('published runtime serves an application-owned catalog from its app root', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-standalone-'));
  const database = path.join(directory, 'store.sqlite');
  const child = spawn(process.execPath, [cli, 'create', '.'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`create failed: ${code}`))); child.once('error', reject); });
  await writeFile(path.join(directory, 'src/data/products.js'), `export default [{ id: 'custom', slug: 'custom', name: 'Custom Catalog Item', description: 'App-owned', price: 7, active: true }];\n`);

  const server = spawn(process.execPath, [serverEntry], {
    cwd: directory,
    env: { ...process.env, INTENT_OS_APP_ROOT: directory, INTENT_OS_DATABASE: database, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    const address = await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        output += chunk;
        const match = output.match(/Intent OS listening on http:\/\/localhost:(\d+)/);
        if (match) { server.stdout.off('data', onData); resolve(match[1]); }
      };
      server.stdout.on('data', onData);
      server.stderr.on('data', (chunk) => { output += chunk; });
      server.once('error', reject);
      server.once('exit', (code) => reject(new Error(`server exited ${code}: ${output}`)));
    });
    const response = await fetch(`http://127.0.0.1:${address}/products`);
    const markup = await response.text();
    assert.equal(response.status, 200);
    assert.match(markup, /Custom Catalog Item/);
    assert.doesNotMatch(markup, /Field Notes/);
    assert.match(await readFile(database, 'utf8'), /SQLite format 3/);
  } finally {
    const stopped = new Promise((resolve) => server.once('close', resolve));
    server.kill('SIGTERM');
    await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});
