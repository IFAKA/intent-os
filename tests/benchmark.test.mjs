import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectMetrics, compareMetrics } from '../scripts/benchmark.mjs';

test('benchmark reports comparable source and browser-surface metrics', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'intent-os-benchmark-'));
  try {
    await writeFile(path.join(root, 'page.html'), '<form data-action="cart.add"><section data-fragment="cart"></section></form>\n');
    await writeFile(path.join(root, 'app.js'), 'fetch("/_app/action/cart.add");\n');
    const metrics = await collectMetrics(root);
    assert.equal(metrics.filesTouched, 2);
    assert.equal(metrics.authoredLoc, 2);
    assert.equal(metrics.distinctConceptsInvoked.serverActions, true);
    assert.equal(metrics.distinctConceptsInvoked.fragments, true);
    assert.equal(compareMetrics(metrics, metrics).authoredLocRatio, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
