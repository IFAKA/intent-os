#!/usr/bin/env node
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] || 'help';

const templates = {
  'app.config.js': `export default {\n  database: 'sqlite',\n  payments: 'stripe',\n  auth: 'session',\n};\n`,
  'schema.js': `export default {\n  version: 1,\n  tables: {\n    products: {\n      columns: {\n        id: { type: 'TEXT', primaryKey: true },\n        name: { type: 'TEXT', notNull: true },\n        price_minor: { type: 'INTEGER', notNull: true, check: 'price_minor >= 0' },\n        active: { type: 'INTEGER', notNull: true, default: '1' },\n      },\n    },\n  },\n};\n`,
  'theme.css': `:root { font-family: system-ui, sans-serif; color: #1f2937; background: #f8fafc; }\nbody { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem; }\n.product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }\n.product-card { padding: 1rem; background: white; border: 1px solid #e5e7eb; border-radius: .75rem; }\n`,
  'pages/index.html': `<main>\n  <h1>Intent OS store</h1>\n  <p>Edit <code>pages/</code>, <code>schema.js</code>, and <code>theme.css</code> to shape your store.</p>\n  <p><a href="/products">Browse products</a> · <a href="/cart">View cart</a></p>\n</main>\n`,
  'pages/products/index.html': `<main>\n  <h1>Products</h1>\n  <section class="product-grid">\n    <x-list of="Product" as="product">\n      <article class="product-card">\n        <h2>{{product.name}}</h2>\n        <p>{{product.description}}</p>\n        <x-money value="{{product.price}}" currency="EUR" />\n        <form method="post" action="/_app/action/cart.add"><input type="hidden" name="productId" value="{{product.id}}"><button type="submit">Add to cart</button></form>\n      </article>\n    </x-list>\n  </section>\n</main>\n`,
  'pages/cart.html': `<main>\n  <h1>Your cart</h1>\n  <p data-fragment="cart-summary">Your cart is ready for products.</p>\n  <a href="/products">Continue shopping</a>\n</main>\n`,
  'src/data/products.js': `export default [\n  { id: 'example-product', name: 'Example product', description: 'Replace this with your catalog.', price: 19, active: true },\n];\n`,
  'public/app.js': '',
  'README.md': "# Intent OS store\n\nApplication-owned starter files for an Intent OS store.\n\nRun `npx intent-os dev` to start the server and `npx intent-os test` to verify it.\n\nEdit `pages/`, `schema.js`, `app.config.js`, `theme.css`, and `src/`; framework infrastructure remains outside this app surface.\n",
};

function run(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, INTENT_OS_APP_ROOT: process.cwd() },
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

async function create(target = '.') {
  const destination = path.resolve(process.cwd(), target);
  await mkdir(destination, { recursive: true });
  for (const [relative, contents] of Object.entries(templates)) {
    const file = path.join(destination, relative);
    await mkdir(path.dirname(file), { recursive: true });
    try { await access(file); } catch {
      const starterContents = relative === 'schema.js'
        ? (await readFile(path.join(packageRoot, 'schema.js'), 'utf8')).replace("export { generateSchemaSql } from './framework/db/schema-generator.js';\n", '')
        : relative === 'public/app.js'
          ? await readFile(path.join(packageRoot, 'public/app.js'), 'utf8')
        : contents;
      await writeFile(file, starterContents);
    }
  }
  console.log(`Intent OS starter created at ${destination}`);
}

async function generateSchema(check = false) {
  const appRoot = process.cwd();
  const schemaPath = path.join(appRoot, 'schema.js');
  const outputPath = path.join(appRoot, 'schema.sql');
  const { default: definition } = await import(`${pathToFileURL(schemaPath).href}?intent-os=${Date.now()}`);
  const { generateSchemaSql } = await import(pathToFileURL(path.join(packageRoot, 'framework/db/schema-generator.js')).href);
  const generated = generateSchemaSql(definition);

  let current = null;
  try { current = await readFile(outputPath, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (check) {
    if (current !== generated) {
      console.error(`Schema is out of date: ${path.relative(appRoot, outputPath)}`);
      process.exitCode = 1;
      return;
    }
    console.log('Schema is up to date.');
    return;
  }

  await writeFile(outputPath, generated);
  console.log(`Generated ${path.relative(appRoot, outputPath)}`);
}

async function generateMigration(name) {
  if (!name) throw new Error('Migration name is required, for example: generate migration add-customer-phone');
  const appRoot = process.cwd();
  const schemaPath = path.join(appRoot, 'schema.js');
  const baselinePath = path.join(appRoot, 'schema.sql');
  const { default: definition } = await import(`${pathToFileURL(schemaPath).href}?intent-os=${Date.now()}`);
  const { generateSchemaSql } = await import(pathToFileURL(path.join(packageRoot, 'framework/db/schema-generator.js')).href);
  const { generateMigrationSql } = await import(pathToFileURL(path.join(packageRoot, 'framework/db/migration-generator.js')).href);
  const previous = await readFile(baselinePath, 'utf8');
  const migration = generateMigrationSql(previous, generateSchemaSql(definition));
  if (!migration) { console.log('Schema is unchanged; no migration generated.'); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'change';
  const directory = path.join(appRoot, 'migrations');
  await mkdir(directory, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${slug}.sql`;
  const outputPath = path.join(directory, filename);
  await writeFile(outputPath, migration);
  console.log(`Generated ${path.relative(appRoot, outputPath)}`);
}

if (command === 'create') await create(process.argv[3]);
else if (command === 'dev') run('dev', ['server.js']);
else if (command === 'test') run('test', ['--test',
  'tests/actions.test.mjs', 'tests/application-runtime.test.mjs', 'tests/benchmark.test.mjs',
  'tests/cli.test.mjs', 'tests/compiler.test.mjs', 'tests/db.test.mjs', 'tests/payments.test.mjs',
  'tests/schema-cli.test.mjs', 'tests/security.test.mjs', 'tests/server.test.mjs',
  'tests/session-persistence.test.mjs', 'tests/standalone.test.mjs']);
else if (command === 'generate' && process.argv[3] === 'schema') await generateSchema(process.argv.includes('--check'));
else if (command === 'generate' && process.argv[3] === 'migration') await generateMigration(process.argv[4]);
else {
  console.log('Usage: intent-os <create [directory] | dev | test | generate schema [--check] | generate migration <name>>');
  if (command !== 'help') process.exitCode = 1;
}
