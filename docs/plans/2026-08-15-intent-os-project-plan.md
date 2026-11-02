# Intent OS Full Project Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and validate Intent OS as a constrained, agent-optimized ecommerce framework whose application surface is semantic HTML and small domain declarations while the framework owns routing, rendering, data access, security, payments, and repetitive interaction behavior.

**Architecture:** The project progresses from a browser-only runtime laboratory to a real full-stack framework. The public application surface is made of filesystem-routed pages, semantic HTML, resource declarations, `data-action` mutations, `data-fragment` targets, and a small schema/config layer. The framework owns compilation, server rendering, HTML fragment responses, sessions, validation, SQLite access, payment integration, and acceptance behavior.

**Tech Stack:** JavaScript/Node.js, semantic HTML, vanilla browser runtime, SQLite, server-rendered HTML fragments, Stripe-hosted Checkout, native browser APIs, and an automated acceptance suite. The implementation should avoid introducing React, Tailwind, a client state framework, or a general-purpose component framework into the agent-facing surface.

**Source specification:** `deep-research-report.md`

---

## Product thesis

Intent OS succeeds only if it makes serious ecommerce easier for coding agents without hiding correctness requirements.

The target application authoring surface is approximately:

```html
<x-list of="Product" as="p" page="24">
  <article>
    <a href="/products/{{p.slug}}">
      <h2>{{p.name}}</h2>
    </a>
    <x-money value="{{p.price}}"></x-money>
    <button data-action="cart.add({{p.id}})">Add</button>
  </article>
</x-list>
```

The agent should not need to author:

- SQL
- Fetch calls
- JSON serializers
- client-side global stores
- loading-state plumbing
- routing boilerplate
- payment secret handling
- webhook verification
- CSRF implementation
- cart pricing logic
- DOM fragment synchronization

---

## Complete target architecture

```text
intent-os/
├─ pages/
│  ├─ index.html
│  ├─ products/
│  │  ├─ index.html
│  │  └─ [slug].html
│  ├─ cart.html
│  ├─ checkout/
│  │  └─ success.html
│  ├─ account.html
│  └─ orders/
│     └─ [id].html
│
├─ schema.js
├─ schema.sql                 # generated
├─ app.config.js
├─ theme.css
├─ package.json
├─ server.js
├─ migrations/
│
├─ framework/
│  ├─ server.js
│  ├─ router.js
│  ├─ compiler.js
│  ├─ renderer.js
│  ├─ fragments.js
│  ├─ app.js
│  ├─ actions.js
│  ├─ validation.js
│  ├─ auth.js
│  ├─ csrf.js
│  ├─ recovery.js
│  ├─ db/
│  │  ├─ adapter.js
│  │  └─ sqlite.js
│  └─ payments/
│     └─ stripe.js
│
├─ public/
│  └─ app.js
├─ tests/
│  ├─ compiler.test.js
│  ├─ router.test.js
│  ├─ db.test.js
│  ├─ actions.test.js
│  ├─ security.test.js
│  ├─ payments.test.js
│  └─ browser.test.js
│
└─ docs/
   ├─ plans/
   └─ architecture.md
```

Ownership must remain explicit:

| Area | Owner | Application author edits it? |
|---|---|---:|
| `pages/*.html` | Application | Yes |
| `schema.js` | Application/schema | Sometimes |
| `app.config.js` | Application | Small config only |
| `theme.css` | Application | Variables/layout exceptions |
| `framework/*` | Framework | No, except framework development |
| `schema.sql` | Generated | No |
| `public/app.js` | Framework | No |
| Stripe adapter | Framework | No |

---

## Phase 1 — Atomic runtime laboratory

**Purpose:** Make the architecture understandable and testable through a browser-only playground.

**Plan:** [2026-08-15-phase-1-runtime-lab.md](./2026-08-15-phase-1-runtime-lab.md)

Must deliver:

- Atomic frontend structure
- Live product surface
- `cart.add(...)` local action
- Cart fragments and request trace
- Layout, density, theme, and runtime variants
- Source-code viewer
- Accessible controls
- Run instructions
- Honest local-runtime labeling

Must not claim:

- secure server state
- persistence
- real payments
- server-side validation
- production security

**Exit gate:** A user can change variants, trigger the canonical action, inspect the code path, see synchronized fragments, and reset the runtime.

---

## Phase 2 — Hypermedia core and server shell

**Purpose:** Replace the browser-only simulation with a minimal server that renders full HTML and targeted HTML fragments.

### Deliverables

- `package.json` with development and test scripts
- `server.js` entry point
- `framework/server.js`
- `framework/router.js`
- `framework/renderer.js`
- `framework/fragments.js`
- `framework/app.js`
- `public/app.js`
- Filesystem routing for `pages/`
- Normal full-page GET responses
- Enhanced GET navigation when JavaScript is enabled
- Ordinary HTML fallback when JavaScript is unavailable
- `data-fragment` targeting and replacement
- Pending, success, error, and recovery UI states

### Required behavior

```text
GET /                         → pages/index.html
GET /products                 → pages/products/index.html
GET /products/red-shoe        → pages/products/[slug].html
GET /cart                     → pages/cart.html
GET /products?category=shoe   → filtered full HTML
X-App-Request: fragment       → requested HTML fragment response
```

### Tests

- Filesystem route resolution
- Dynamic slug resolution
- Full document rendering
- Fragment-only rendering
- Missing route handling
- Browser navigation fallback
- Fragment replacement without JSON

**Exit gate:** A browser can navigate between server-rendered pages and update a named fragment without requiring a client framework.

---

## Phase 3 — Declarative resource compiler

**Purpose:** Make resource declarations compile into server-authoritative queries and HTML.

### Deliverables

- `framework/compiler.js`
- Resource registry
- `<x-list>` support
- `<x-record>` support
- `<x-money>` support
- Interpolation such as `{{p.name}}`
- Conditionals and loops needed by ecommerce pages
- Pagination with URL-addressable cursor state
- Resource filters and sorting
- Explicit `data-layout` vocabulary:
  - `grid`
  - `split`
  - `row`
  - `sidebar`

### Compiler constraints

- No arbitrary client-side expressions
- No direct SQL in application pages
- No npm imports in application HTML
- No per-component application JavaScript
- No hidden network calls generated by presentation markup

### Tests

- Product list compilation
- Product detail compilation
- Missing interpolation value handling
- Escaping and output safety
- Pagination query interpretation
- Filter and sort interpretation
- Generated markup contains no custom compiler tags

**Exit gate:** The canonical `<x-list>` input produces server-rendered product HTML with URLs, formatted money, and `data-action` attributes.

---

## Phase 4 — Schema IR and SQLite adapter

**Purpose:** Make resources and domain actions execute against a real relational database while keeping SQL private to the framework.

### Deliverables

- `schema.js`
- `framework/db/adapter.js`
- `framework/db/sqlite.js`
- Generated `schema.sql`
- Migration runner
- SQLite database file for local development
- Prepared queries
- Transactions
- Busy/retry handling
- Seed data
- Product, category, cart, customer, order, payment, and webhook event tables

### Minimum schema concepts

```text
products
categories
product_categories
carts
cart_items
customers
orders
order_items
payments
webhook_events
sessions
```

### Adapter contract

The public framework API should expose resource and action operations, not SQLite-specific operations.

The adapter must own:

- Prepared statements
- Transactions
- Constraint errors
- Cursor pagination lowering
- Money integer handling
- Concurrent writer behavior

### Tests

- Schema generation
- Migration application
- Product reads
- Cursor pagination
- Transaction commit
- Transaction rollback
- Concurrent cart mutation behavior
- Prepared query parameterization
- Adapter conformance contract

**Exit gate:** The canonical mapping test resolves `<x-list>` to a real SQLite query and returns HTML from database truth.

---

## Phase 5 — Action layer and authoritative fragments

**Purpose:** Turn declarative `data-action` values into validated domain mutations and HTML fragment responses.

### Deliverables

- `framework/actions.js`
- Action registry
- `cart.add`
- `cart.remove`
- `cart.update`
- Cart fragment renderer
- Cart count fragment
- Toast fragment
- Form-error fragment
- Pending state
- Success state
- Error state
- Focus restoration
- Duplicate-click protection
- Recovery/refetch after failed optimistic updates

### Canonical mutation flow

```text
data-action="cart.add"
        ↓
POST /_app/action/cart.add
        ↓
session + schema validation
        ↓
database transaction
        ↓
authoritative cart and price lookup
        ↓
HTML fragments
        ↓
DOM patch + toast + focus restore
```

### Tests

- Valid cart add
- Unknown product
- Invalid quantity
- Duplicate click
- Cart count fragment
- Cart total fragment
- Toast fragment
- Multiple fragments in one response
- No-JavaScript form fallback

**Exit gate:** Cart behavior works through ordinary server mechanics and through enhanced fragment updates.

---

## Phase 6 — Production interaction and security

**Purpose:** Make the framework safe enough to handle authenticated ecommerce state.

### Deliverables

- `framework/auth.js`
- `framework/csrf.js`
- `framework/validation.js`
- Session cookies
- HttpOnly/Secure/SameSite configuration
- Login/logout actions
- Ownership checks
- Server-side action schemas
- CSRF tokens for forms and mutations
- Structured validation errors
- Safe output escaping
- Rate-limited sensitive actions where needed

### Required security behavior

- Browser validation is only a UX enhancement.
- Every mutation is independently validated server-side.
- The server derives product prices.
- The browser cannot choose the checkout amount.
- Unowned orders cannot be read.
- CSRF requests without valid tokens are rejected.
- Secrets never enter browser HTML or JavaScript.

### Tests

- CSRF rejection
- Invalid schema rejection
- Price tampering rejection
- Quantity limits
- Session fixation protection
- Unowned order rejection
- Cookie attribute checks
- Output escaping
- SQL injection resistance

**Exit gate:** Security tests pass without requiring application authors to implement security plumbing in each page.

---

## Phase 7 — Ecommerce core

**Purpose:** Complete the domain flow from catalog to order draft.

### Deliverables

- Product detail page
- Search
- Category filtering
- Cursor pagination
- Cart page
- Quantity controls
- Remove action
- Customer/account page
- Order draft creation
- Order state machine
- Inventory reservation rules
- Empty/loading/error states

### Required flow

```text
catalog → product detail → cart → order draft → checkout
```

### Tests

- Search query
- Category persistence through navigation
- Pagination URL state
- Product slug lookup
- Cart quantity updates
- Empty cart
- Inventory conflict
- Order ownership
- Order state transitions

**Exit gate:** A user can complete the pre-payment ecommerce flow with server-rendered pages and fragment-enhanced actions.

---

## Phase 8 — Stripe payments and fulfillment

**Purpose:** Add hosted payment handling without exposing payment secrets or trusting browser return pages.

### Deliverables

- `framework/payments/stripe.js`
- Stripe Checkout Session creation
- Server-side order amount calculation
- Redirect to Stripe-hosted Checkout
- Return/success page
- Signed webhook endpoint
- Raw-body signature verification
- Idempotent webhook event storage
- Payment and fulfillment state updates
- Retry-safe fulfillment
- Stripe idempotency keys

### Authority rules

- Stripe secret keys remain server-only.
- The success/return page does not mark an order paid.
- Payment state changes only after a verified webhook.
- Duplicate webhook delivery cannot double-fulfill.
- The framework owns Stripe integration; application pages declare intent only.

### Tests

- Checkout amount ignores client manipulation
- Stripe secret absent from browser output
- Forged webhook rejection
- Valid webhook acceptance
- Duplicate webhook safety
- Concurrent fulfillment safety
- Return page does not mark payment complete

**Exit gate:** A real test payment can progress through Checkout and a verified webhook without moving payment logic into application pages.

**Implementation status (2026-08-15):** Complete for the local acceptance slice. The framework now creates Stripe-hosted Checkout sessions with server-authoritative totals and idempotency keys, exposes a signed raw-body webhook route, stores webhook events idempotently, and moves orders through paid to fulfilled exactly once. A live Stripe test payment still requires deployment credentials and endpoint configuration.

---

## Phase 9 — Agent-facing starter repository

**Purpose:** Package the framework so a coding agent can create a store by editing a small, understandable set of application files.

### Deliverables

- Starter `pages/` tree
- `schema.js`
- `app.config.js`
- `theme.css`
- Generated schema/migration workflow
- Framework-owned files separated from application-owned files
- One-command dev server
- One-command test suite
- Example product/catalog/cart flow
- Architecture documentation
- Generated-code ownership documentation

### Target application authoring experience

```js
export default {
  database: 'sqlite',
  payments: 'stripe',
  auth: 'session'
};
```

```bash
npx intent-os dev
npx intent-os test
```

**Exit gate:** A fresh application can be generated with a small number of domain files while the framework owns infrastructure behavior.

**Implementation status (2026-08-15):** The local starter slice, standalone package boundary, account surface, and SQLite-backed session persistence are complete: the package declares publishable runtime files and exports, and `intent-os dev` loads application-owned pages, public assets, catalog data, and migrations through `INTENT_OS_APP_ROOT`. `app.config.js`, `theme.css`, architecture and generated-code ownership docs, a non-destructive `intent-os create` scaffold, `intent-os dev`/`intent-os test` commands, `intent-os generate schema [--check]`, and `intent-os generate migration <name>` are present. The checked-in schema artifact can be generated and verified from `schema.js`; additive migration generation emits new tables/columns and rejects destructive or unsafe changes; existing SQLite databases apply pending migration files transactionally and idempotently. `/account` provides CSRF-protected local email identity, session rotation, customer creation, logout, and sessions that survive a server restart when `INTENT_OS_DATABASE` is file-backed. Phase 10 has an executable measurement harness, comparison ratios, acceptance-spec template, and shared agent task. Production identity-provider integration, running the comparison against a separately authored Next.js baseline, and live Stripe deployment validation remain follow-up work.

---

## Phase 10 — Falsification benchmark

**Purpose:** Test whether the framework actually reduces agent effort instead of merely providing attractive syntax.

### Comparison repositories

```text
A: Next.js + Tailwind + shadcn
B: Intent OS
```

Give both agents the identical ecommerce acceptance specification.

### Measure

- Agent-authored LOC
- Generated tokens
- Files touched
- Distinct concepts invoked
- Tool calls
- Repair iterations
- Time to first passing implementation
- Acceptance tests passed
- Security tests passed
- Browser JavaScript shipped
- Server requests

### Target thresholds

- At least 3× less agent-authored LOC
- At least 50% fewer generated tokens
- At least 50% fewer files touched
- No custom application JS for the canonical flow
- No custom application CSS except theme/layout exceptions
- Equal functional and security acceptance-test pass rate

These are falsification targets, not assumed results.

**Exit gate:** The benchmark produces measured evidence for or against the thesis.

**Implementation status (2026-08-15):** A separate Next.js 16.3.1 + Tailwind-style + shadcn-style baseline now exists at `benchmark/next-baseline`, builds successfully, and passes its local security tests. The scoped benchmark has been run and saved to `benchmark/results.json`; the preliminary result does not meet the thesis thresholds and is explicitly non-conclusive because the baseline acceptance matrix is smaller than the full shared specification.

---

## Cross-phase quality requirements

Every phase must preserve:

- Progressive enhancement
- Semantic HTML
- Keyboard accessibility
- Visible focus states
- Reduced-motion support
- Server authority for sensitive state
- HTML fragments instead of JSON for ordinary UI mutations
- Clear ownership between application and framework code
- Tests for behavior, not screenshots only
- Honest documentation of what is simulated versus production-ready

---

## Final project acceptance specification

The project is not complete until all of these are testable:

```text
GET /products renders products
?q=shoe filters search results
category filter survives navigation
pagination is URL-addressable
product detail loads by slug
add-to-cart works without full reload when JS is enabled
add-to-cart works through ordinary server mechanics when enhancement is unavailable
rapid duplicate click cannot corrupt quantity
cart price is server-derived
invalid quantity is rejected server-side
CSRF request is rejected
unowned order cannot be read
checkout amount ignores client manipulation
Stripe secret is never sent to browser
forged webhook is rejected
duplicate valid webhook does not double-fulfill
payment success page alone does not mark order paid
```

The Phase 1 runtime laboratory is a visual and interaction proof. The complete project is validated only when the later server, data, security, payment, and benchmark phases pass this acceptance specification.
