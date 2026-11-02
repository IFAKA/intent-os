import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.md']);
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'coverage']);
const CONCEPTS = {
  serverActions: /data-action|_app\/action/g,
  fragments: /data-fragment|renderFragment/g,
  schemaValidation: /createSchema|validation|schema/g,
  csrf: /csrf|CSRF/g,
  sessions: /session|auth\.login|auth\.logout/g,
  payments: /stripe|webhook|checkout/g,
};

function inScope(root, file, scope) {
  if (!scope?.length) return true;
  const relative = path.relative(root, file);
  return scope.some((entry) => relative === entry || relative.startsWith(`${entry}/`));
}

async function filesIn(root, scope = [], directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(root, scope, file));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && inScope(root, file, scope)) files.push(file);
  }
  return files;
}

export async function collectMetrics(root, { scope = [] } = {}) {
  const files = await filesIn(root, scope);
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  const source = contents.join('\n');
  const count = (pattern) => (source.match(pattern) || []).length;
  const browserJs = files.reduce((sum, file, index) => sum + (/(^|\/)(public|src)\/.*\.(?:js|mjs)$/.test(file) ? contents[index].length : 0), 0);
  const browserCss = files.reduce((sum, file, index) => sum + (file.endsWith('.css') ? contents[index].length : 0), 0);
  return {
    root,
    filesTouched: files.length,
    authoredLoc: contents.reduce((sum, value) => sum + value.split(/\r?\n/).filter((line) => line.trim()).length, 0),
    generatedTokensEstimate: Math.ceil(source.length / 4),
    browserJavaScriptBytes: browserJs,
    browserCssBytes: browserCss,
    distinctConceptsInvoked: Object.fromEntries(Object.entries(CONCEPTS).map(([name, pattern]) => [name, count(pattern) > 0])),
  };
}

export function compareMetrics(intentOs, baseline) {
  const ratio = (key) => baseline[key] ? Number((intentOs[key] / baseline[key]).toFixed(3)) : null;
  return {
    authoredLocRatio: ratio('authoredLoc'),
    generatedTokensRatio: ratio('generatedTokensEstimate'),
    filesTouchedRatio: ratio('filesTouched'),
    browserJavaScriptBytes: { intentOs: intentOs.browserJavaScriptBytes, baseline: baseline.browserJavaScriptBytes },
    browserCssBytes: { intentOs: intentOs.browserCssBytes, baseline: baseline.browserCssBytes },
    targets: {
      threeTimesLessLoc: baseline.authoredLoc >= intentOs.authoredLoc * 3,
      fiftyPercentFewerTokens: baseline.generatedTokensEstimate >= intentOs.generatedTokensEstimate * 2,
      fiftyPercentFewerFiles: baseline.filesTouched >= intentOs.filesTouched * 2,
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--')) args[argv[index].slice(2)] = argv[index + 1]?.startsWith('--') ? true : argv[++index];
  }
  return args;
}

function parseScope(value) {
  return value ? String(value).split(',').map((item) => item.trim()).filter(Boolean) : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.intent || !args.baseline) {
    console.error('Usage: node scripts/benchmark.mjs --intent <dir> --baseline <dir> [--metadata <file>]');
    process.exitCode = 2;
  } else {
    const intentOs = await collectMetrics(path.resolve(args.intent), { scope: parseScope(args['intent-scope']) });
    const baseline = await collectMetrics(path.resolve(args.baseline), { scope: parseScope(args['baseline-scope']) });
    const result = { intentOs, baseline, comparison: compareMetrics(intentOs, baseline) };
    if (args.metadata) result.runMetadata = JSON.parse(await readFile(path.resolve(args.metadata), 'utf8'));
    console.log(JSON.stringify(result, null, 2));
  }
}
