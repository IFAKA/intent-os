# Intent OS Runtime Lab

Intent OS is an agent-oriented ecommerce framework in progress. The framework owns server authority and infrastructure while application authors shape a store through a small set of files.

## Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. The equivalent package CLI is `npx intent-os dev`.

Open <http://localhost:3000/docs> for the developer portal: quick start, the Intent OS ownership model, project anatomy, included runtime capabilities, and the explicit production-readiness boundary.

## Verify

```bash
npm test
```

Create a starter application with `npx intent-os create my-store`, then edit its `pages/`, `schema.js`, `app.config.js`, `theme.css`, and `src/` files. Existing files are preserved by the generator.

Generate the database artifact with `npx intent-os generate schema`; use `npx intent-os generate schema --check` in CI to detect schema drift.

For a file-backed database, set `INTENT_OS_DATABASE=./store.sqlite`; account sessions are stored in SQLite and survive server restarts. The local account screen is an identity scaffold, not a production identity provider.

For production, set `NODE_ENV=production`, `INTENT_OS_SESSION_SECRET`, `INTENT_OS_DATABASE` on a persistent single-host volume, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Run `npm run check` before deployment. SQLite is intentionally single-host/single-writer; use a managed database adapter before running multiple application replicas.

Run the falsification harness after preparing two separate agent outputs with the scoped command in `benchmark/acceptance-spec.md`.

The lab acceptance flow is: change layout, density, and theme; add products; inspect the request trace and source tabs; copy source when the Clipboard API is available; change variants without losing cart state; then reset.

## Scope boundary

See [the architecture guide](docs/architecture.md) and [generated-code ownership](docs/generated-code.md) for the framework/application boundary and migration expectations. The remaining roadmap is in `docs/plans/2026-08-15-intent-os-project-plan.md`.

## Support

If this project is useful to you, you can support my work:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/zfaka)
