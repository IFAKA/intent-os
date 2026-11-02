import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(new URL('..', import.meta.url).pathname);
const cli = path.join(root, 'bin', 'intent-os.js');

test('generate schema writes schema.sql and check detects drift', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-schema-'));
  await writeFile(path.join(directory, 'schema.js'), `
    export default {
      version: 1,
      tables: { notes: { columns: { id: { type: 'TEXT', primaryKey: true }, body: { type: 'TEXT', notNull: true } } } },
    };
  `);

  await run(process.execPath, [cli, 'generate', 'schema'], { cwd: directory });
  assert.match(await readFile(path.join(directory, 'schema.sql'), 'utf8'), /CREATE TABLE IF NOT EXISTS notes/);
  await run(process.execPath, [cli, 'generate', 'schema', '--check'], { cwd: directory });

  await writeFile(path.join(directory, 'schema.sql'), 'stale\n');
  await assert.rejects(run(process.execPath, [cli, 'generate', 'schema', '--check'], { cwd: directory }), /Schema is out of date/);
});

test('generate migration emits additive changes and rejects destructive changes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-migration-'));
  await writeFile(path.join(directory, 'schema.js'), `
    export default {
      version: 2,
      tables: { notes: { columns: {
        id: { type: 'TEXT', primaryKey: true },
        body: { type: 'TEXT', notNull: true },
        label: { type: 'TEXT', default: "''" },
      } } },
    };
  `);
  await writeFile(path.join(directory, 'schema.sql'), `CREATE TABLE IF NOT EXISTS notes (\n  id TEXT PRIMARY KEY,\n  body TEXT NOT NULL\n);\n`);

  await run(process.execPath, [cli, 'generate', 'migration', 'add-label'], { cwd: directory });
  const files = await readdir(path.join(directory, 'migrations'));
  assert.equal(files.length, 1);
  assert.match(await readFile(path.join(directory, 'migrations', files[0]), 'utf8'), /ALTER TABLE notes ADD COLUMN label TEXT DEFAULT '';/);

  await writeFile(path.join(directory, 'schema.js'), `
    export default { version: 3, tables: { notes: { columns: { id: { type: 'TEXT', primaryKey: true } } } } };
  `);
  await assert.rejects(run(process.execPath, [cli, 'generate', 'migration', 'remove-body'], { cwd: directory }), /Destructive schema change/);
});

test('created starter can generate its schema artifact', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-starter-'));
  await mkdir(directory, { recursive: true });
  await run(process.execPath, [cli, 'create', '.'], { cwd: directory });
  await run(process.execPath, [cli, 'generate', 'schema'], { cwd: directory });
  assert.match(await readFile(path.join(directory, 'schema.sql'), 'utf8'), /CREATE TABLE IF NOT EXISTS products/);
});
