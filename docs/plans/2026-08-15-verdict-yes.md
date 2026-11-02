# IntentOS Verdict-Yes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a fresh IntentOS application genuinely application-owned at runtime and credible for production-oriented intent-first development.

**Architecture:** Load application schema/configuration from `INTENT_OS_APP_ROOT`, discover application routes from `pages/`, and pass authenticated request context through domain actions. Preserve the server-authoritative SQLite/HTML-fragment architecture while adding explicit production safeguards, full-page error rendering, reservation lifecycle handling, and browser acceptance tests.

**Tech Stack:** Node.js ESM, `node:sqlite`, server-rendered HTML, native browser JavaScript, Node test runner, Playwright where available.

---

### Task 1: Add failing ownership and configuration tests

**Files:**
- Create: `tests/application-runtime.test.mjs`
- Modify: `tests/actions.test.mjs`

Test that a generated app schema is used at runtime, app config changes payment/security behavior, custom filesystem routes resolve, normal invalid POSTs return complete HTML, logged-in orders retain customer ownership, and canceled orders release inventory.

### Task 2: Make schema and configuration application-owned

**Files:**
- Modify: `framework/server.js`
- Modify: `framework/db/sqlite.js`
- Modify: `framework/app.js`
- Modify: `bin/intent-os.js`

Load `schema.js` and `app.config.js` from the application root, validate their shape, pass schema into SQLite initialization, and require an explicit stable session secret in production mode.

### Task 3: Implement filesystem route discovery

**Files:**
- Modify: `framework/router.js`
- Modify: `framework/server.js`
- Test: `tests/application-runtime.test.mjs`

Discover `.html` files recursively, translate `[param]` segments into URL parameters, reject route collisions, and retain the existing built-in route behavior through the discovered application pages.

### Task 4: Repair domain ownership and inventory lifecycle

**Files:**
- Modify: `framework/actions.js`
- Modify: `framework/app.js`
- Modify: `framework/db/adapter.js`
- Modify: `schema.js`
- Modify: `schema.sql`
- Test: `tests/actions.test.mjs`, `tests/db.test.mjs`

Pass customer identity into order creation and ownership checks. Add reservation state/timestamps and release inventory for canceled or expired drafts. Make repeated order creation and cancellation safe.

### Task 5: Separate fragment and document error responses

**Files:**
- Modify: `framework/app.js`
- Modify: `framework/fragments.js`
- Modify: `public/app.js`
- Test: `tests/application-runtime.test.mjs`

Return a full rendered document for ordinary form failures and fragments only for enhanced requests. Preserve status, form values, and accessible error regions.

### Task 6: Add production lifecycle and package safeguards

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`

Add engine requirements, production start/check commands, schema drift checks, test execution, package exclusions for generated benchmark artifacts, health behavior, and deployment/session/database requirements.

### Task 7: Add browser acceptance coverage

**Files:**
- Modify: `package.json`
- Modify: `tests/phase-1.spec.mjs`
- Create: `tests/browser-acceptance.spec.mjs`

Exercise JS/no-JS cart behavior, keyboard navigation, mobile rendering, back navigation, invalid input, and fragment recovery. Keep browser tests optional when Playwright is unavailable but make them part of CI when installed.

### Task 8: Run the complete verification suite and update the verdict

Run syntax checks, Node tests, schema check, package dry-run, browser tests, and a fresh generated-app smoke test. Update documentation only where claims now match behavior. Do not claim production readiness for identity/payment/operations that remain explicitly external.
