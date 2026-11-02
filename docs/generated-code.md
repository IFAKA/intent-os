# Generated-code ownership

Generated files are framework output, not application source.

- Application source: `pages/`, `schema.js`, `app.config.js`, `theme.css`, and `src/`.
- Framework source: `framework/` and the CLI implementation.
- Generated runtime artifacts: local database files and future migration output.

Generate `schema.sql` with `npx intent-os generate schema`; `--check` verifies that the checked-in artifact matches `schema.js`. For additive changes, run `npx intent-os generate migration <name>` after regenerating the schema definition. The command emits new tables and columns, and rejects removals, changed columns, and unsafe non-null columns. At runtime, existing SQLite databases apply pending files in `migrations/` transactionally and record each filename in `_intent_os_migrations`; fresh databases mark migrations already represented by the current schema as applied. Never edit generated database artifacts by hand to change application behavior: edit `schema.js`, generate the migration, then test it against a fresh and an existing database.

The `intent-os create` command is deliberately non-destructive: it creates missing starter files and leaves existing files untouched. The published `intent-os` package owns the runtime under `framework/`; an application owns its `pages/`, `public/`, `src/data/products.js`, configuration, schema source, and migrations. `intent-os dev` loads those application paths through `INTENT_OS_APP_ROOT`, so the package does not need to be copied into the application.
