import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'bin', 'intent-os.js');

function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

test('create generates a small application surface and preserves existing files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'intent-os-'));
  try {
    const first = await runCli(['create', '.'], directory);
    assert.equal(first.code, 0);
    assert.match(await readFile(path.join(directory, 'app.config.js'), 'utf8'), /database: 'sqlite'/);
    assert.match(await readFile(path.join(directory, 'pages/products/index.html'), 'utf8'), /x-list/);
    assert.match(await readFile(path.join(directory, 'README.md'), 'utf8'), /framework infrastructure/);
    const config = path.join(directory, 'app.config.js');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(config, 'custom config\n'));
    await runCli(['create', '.'], directory);
    assert.equal(await readFile(config, 'utf8'), 'custom config\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
