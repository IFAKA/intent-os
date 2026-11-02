# Intent OS architecture

Intent OS has two ownership layers.

## Framework-owned

`framework/` owns routing, rendering, actions, validation, CSRF, sessions, database access, inventory, orders, payments, and server startup. These modules enforce the authority boundaries that application pages should not reimplement.

## Application-owned

The application author edits `pages/`, `schema.js`, `app.config.js`, `theme.css`, and domain data/components under `src/`. Pages declare the surface and actions; the framework resolves data and executes mutations server-side.

The application schema and configuration are loaded from `INTENT_OS_APP_ROOT` at startup. The normal flow is:

`request → router → page compiler → framework action/database → rendered page or fragment`

The current production topology is deliberately constrained: one Node process, one persistent SQLite volume, and one writer host. Production startup requires `NODE_ENV=production` and a stable `INTENT_OS_SESSION_SECRET`; identity-provider integration, distributed rate limiting, backups, and multi-replica database operation remain deployment responsibilities.

The starter generator creates application-owned files only. A production package can provide the framework as a dependency while keeping this same authoring surface.
