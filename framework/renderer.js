import { readFile } from 'node:fs/promises';
import { compileTemplate, createResourceRegistry } from './compiler.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export async function renderPage(route, { query = new URLSearchParams(), resources = createResourceRegistry() } = {}) {
  const source = await readFile(route.filePath, 'utf8');
  return compileTemplate(source, { resources, params: route.params, query });
}

export function renderFragmentTarget(body, targetName) {
  const escapedTarget = String(targetName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetPattern = new RegExp(`<([a-z][\\w-]*)\\b[^>]*data-fragment=["']${escapedTarget}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
  return body.match(targetPattern)?.[0] ?? null;
}

export function renderDocument(body, { title = 'Intent OS' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/theme.css"><title>${escapeHtml(title)}</title></head><body>${body}<script type="module" src="/app.js"></script></body></html>`;
}
