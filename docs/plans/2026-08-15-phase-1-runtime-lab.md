# Phase 1: Intent OS Runtime Laboratory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a polished, atomic, browser-only laboratory that makes the Intent OS concepts visible and testable: resources, actions, fragments, forms, layout hints, runtime variants, request tracing, and inspectable source code.

**Architecture:** Phase 1 is a static ES-module application with no build tool and no backend dependency. The UI is composed from atomic JavaScript render functions, the local runtime owns deterministic demo state, and the playground displays the relationship between declarative intent, runtime behavior, DOM fragments, and source files. The local runtime must be clearly labeled as a simulation; server authority, SQLite, sessions, compiler behavior, payments, and security enforcement belong to later phases.

**Tech Stack:** Semantic HTML, vanilla ES modules, CSS custom properties, browser DOM APIs, native form controls, Python’s static HTTP server for local development.

**Scope boundary:** This phase proves the product experience and the agent-facing mental model. It does not claim to implement production ecommerce infrastructure.

---

## Phase 1 success criteria

The phase is complete when a user can:

1. Open the project with one documented local command.
2. See the major Intent OS parts represented in the interface.
3. Change layout, density, theme, and runtime display variants.
4. Trigger `cart.add(productId)` from the live product surface.
5. See the cart count, total, summary, and request trace update together.
6. Reset the local runtime to its initial state.
7. Select a capability and inspect the source file and representative code behind it.
8. Copy the displayed code.
9. Use the playground with keyboard navigation and readable focus states.
10. Understand which behaviors are simulated locally and which are future server responsibilities.

## Explicitly deferred to later phases

- Filesystem routing and multiple server-rendered pages
- `<x-list>`, `<x-record>`, `<x-money>`, interpolation, and a real template compiler
- Node/server runtime
- SQLite schema, migrations, prepared queries, and transactions
- Server sessions, authorization, CSRF, and authoritative validation
- Search, filters, pagination, product detail, accounts, and orders
- Stripe Checkout, signed webhooks, idempotency, and fulfillment
- Next.js comparison benchmark
- Production deployment and persistent storage

---

## Target file structure

```text
index.html
styles.css
docs/
  plans/
    2026-08-15-phase-1-runtime-lab.md
src/
  main.js
  data/
    products.js
    capabilities.js
  state/
    playground-state.js
    cart-store.js
  runtime/
    local-runtime.js
    trace.js
  atoms/
    brand.js
    eyebrow.js
    button.js
    status-dot.js
    code-tab.js
  molecules/
    product-meta.js
    cart-pill.js
    trace-step.js
    variant-control.js
  organisms/
    product-card.js
    product-grid.js
    control-panel.js
    request-trace.js
    cart-fragment.js
    code-viewer.js
  pages/
    playground-page.js
  styles/
    tokens.css
    base.css
    atoms.css
    molecules.css
    organisms.css
    playground.css
```

During the migration, a single `styles.css` may remain as the browser entry stylesheet. The ownership boundaries above must still be reflected in the code, even if CSS is split in a later cleanup task.

---

## Task 1: Establish the static application shell

**Files:**

- Modify: `index.html`
- Create: `src/main.js`

### Step 1: Keep the document semantic and minimal

`index.html` should contain:

- The document metadata and title
- Font and stylesheet links
- A grain/texture decoration marked `aria-hidden="true"`
- One `<main id="app"></main>` mount point
- One module script pointing to `src/main.js`

Application content must be rendered from the page module rather than duplicated in `index.html`.

### Step 2: Add the page bootstrap

`src/main.js` should:

- Import fixture data, state, runtime, and page renderer
- Create the local runtime once
- Render the page into `#app`
- Bind event handlers after each render
- Keep all event delegation scoped to the app mount

### Step 3: Verify the shell

Run:

```bash
node --check src/main.js
python3 -m http.server 4173
```

Expected result: the page loads at `http://localhost:4173` without a module error.

---

## Task 2: Define stable fixture data and capability metadata

**Files:**

- Create: `src/data/products.js`
- Create: `src/data/capabilities.js`

### Step 1: Add product fixtures

Each product should have:

```js
{
  id,
  name,
  detail,
  price,
  color
}
```

Use at least three products with distinct visual treatments so layout changes are obvious.

### Step 2: Define inspectable capabilities

The capability registry should describe at least:

- `resource`: the declarative product listing
- `action`: `cart.add(productId)`
- `fragment`: cart count, cart summary, and request trace
- `form`: native controls used by the variant panel
- `layout`: cards/list layout hints
- `runtime`: local state transition and trace generation

Each capability should include:

```js
{
  id,
  label,
  file,
  title,
  code,
  explanation
}
```

The code displayed in the viewer must correspond to the actual conceptual source file names in the project. Avoid presenting simulated code as if it were a production server implementation.

---

## Task 3: Implement the atomic state layer

**Files:**

- Create: `src/state/playground-state.js`
- Create: `src/state/cart-store.js`

### Step 1: Define playground state

Use explicit state with these defaults:

```js
{
  layout: "cards",
  density: "roomy",
  theme: "paper",
  activeCapability: "resource",
  trace: []
}
```

State updates must be narrow and predictable. Variant state must not be mixed with cart state.

### Step 2: Implement the local cart store

The store must support:

- `subscribe(listener)`
- `add(productId)`
- `reset()`
- `entries()`

The store is intentionally in-memory and local to the browser. Add a comment and visible UI label explaining that this is not authoritative ecommerce state.

### Step 3: Define derived cart values

Compute these values from fixture data and cart quantities:

- Total quantity
- Total price
- Human-readable item summary

Never accept a price from a button attribute or a client-supplied total.

---

## Task 4: Build the atomic UI layer

**Files:**

- Create: `src/atoms/brand.js`
- Create: `src/atoms/eyebrow.js`
- Create: `src/atoms/button.js`
- Create: `src/atoms/status-dot.js`
- Create: `src/atoms/code-tab.js`
- Create: `src/molecules/product-meta.js`
- Create: `src/molecules/cart-pill.js`
- Create: `src/molecules/trace-step.js`
- Create: `src/molecules/variant-control.js`

### Step 1: Keep atoms single-purpose

Atoms should return one small semantic element or control. They must not read global state or attach event listeners.

### Step 2: Build molecules from atoms

Molecules should compose related atoms but remain reusable. Examples:

- `product-meta`: product name, detail, and price
- `cart-pill`: cart label and quantity
- `trace-step`: sequence number, code, and status
- `variant-control`: a labeled radio group option with a short explanation

### Step 3: Add accessibility contracts

- Buttons must be real `<button>` elements.
- Variant choices must use `<fieldset>` and `<legend>`.
- Code tabs must expose selected state using `aria-selected`.
- Status updates must live inside an `aria-live="polite"` region.
- Decorative product art must be `aria-hidden="true"`.

---

## Task 5: Build the live product and fragment organisms

**Files:**

- Create: `src/organisms/product-card.js`
- Create: `src/organisms/product-grid.js`
- Create: `src/organisms/cart-fragment.js`
- Create: `src/organisms/request-trace.js`

### Step 1: Render the product card

Each card must show:

- Stable product identity
- Product name and detail
- Server-shaped formatted price from fixture truth
- A `data-action="cart.add(ID)"` attribute
- A clear pressed/added visual state after interaction

### Step 2: Support layout variants

The product grid must support:

- `cards`: three-column desktop grid, responsive two/one-column fallback
- `list`: one-column product rows

The variant should be expressed as a layout class or `data-layout` value, not by changing product data.

### Step 3: Render the cart fragment

The cart fragment must expose independent patch targets:

```html
<span data-fragment="cart-count"></span>
<strong data-fragment="cart-total"></strong>
<p data-fragment="cart-summary"></p>
```

### Step 4: Render the request trace

Initial state:

```text
Add a product to watch the mapping happen.
```

After an action:

```text
01 cart.add(01)        received
02 product.price       resolved from fixture truth
03 cart fragment       patched
```

The trace must visibly identify itself as a local simulation.

---

## Task 6: Build the playground controls and source viewer

**Files:**

- Create: `src/organisms/control-panel.js`
- Create: `src/organisms/code-viewer.js`
- Create: `src/pages/playground-page.js`

### Step 1: Add the control panel

Provide controls for:

- Layout: cards/list
- Density: roomy/tight
- Theme: paper/ink
- Reset playground

Every control must update only the relevant state key and preserve the cart unless reset is explicitly requested.

### Step 2: Add the source viewer

The source viewer must provide tabs for:

- Resource
- Action/runtime
- Fragment
- Variant/layout

Each tab must show:

- File path
- Capability title
- Representative source
- One-sentence explanation
- Copy button

Copy failure must not break the page when the Clipboard API is unavailable.

### Step 3: Add the parts index

Show the five conceptual parts in the page:

```text
Resource · Action · Fragment · Form · Layout hint
```

Each item should link to or activate the relevant source viewer capability.

### Step 4: Compose the page

`playground-page.js` should compose:

- Header/navigation
- Lab introduction
- Control panel
- Live product surface
- Cart fragment
- Request trace
- Source viewer
- Parts index
- Footer

It should not contain cart mutation logic or fixture definitions.

---

## Task 7: Implement the local intent runtime

**Files:**

- Create: `src/runtime/trace.js`
- Create: `src/runtime/local-runtime.js`
- Modify: `src/main.js`

### Step 1: Parse declarative actions

Read actions from `data-action` attributes. The first supported action is:

```text
cart.add(productId)
```

Unknown actions must fail safely without mutating state.

### Step 2: Dispatch the action

The local runtime must:

1. Resolve the product by ID.
2. Add the product to the local cart store.
3. Derive the cart values from fixture truth.
4. Generate the request trace.
5. Set the active source capability to `action` or `runtime`.
6. Re-render or patch the affected regions.

### Step 3: Preserve usable interaction state

After a render:

- Keep the selected variant controls selected.
- Restore focus to the activated button when possible.
- Do not lose existing cart quantities during variant changes.
- Mark the updated region for screen readers.

### Step 4: Implement reset

Reset must clear cart state, trace state, and active source state while restoring the default visual variant.

---

## Task 8: Implement the visual system

**Files:**

- Modify: `styles.css`
- Optional later split: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/atoms.css`, `src/styles/molecules.css`, `src/styles/organisms.css`, `src/styles/playground.css`

### Step 1: Define design tokens

Include tokens for:

- Ink, paper, white, muted, acid, orange
- Borders and surfaces
- Typography families
- Spacing and radii where useful
- Focus ring color

### Step 2: Style the lab hierarchy

The visual direction is editorial/utilitarian:

- Large serif/italic thesis headlines
- Monospace system labels
- Dense black trace panel
- Acid green as the runtime signal
- Orange as the action signal
- Strong borders and asymmetric columns

### Step 3: Add meaningful interaction states

Implement visible states for:

- Hover
- Focus-visible
- Selected variant
- Added product
- Active code tab
- Fresh fragment
- Reduced motion

### Step 4: Test responsive layouts

Verify at approximately:

- 1440px desktop
- 1024px tablet
- 720px mobile
- 390px narrow mobile

The control panel, live canvas, trace, and source viewer must remain understandable in every layout.

---

## Task 9: Add Phase 1 verification

**Files:**

- Create: `tests/phase-1-checks.mjs` or document manual checks in `README.md`
- Create: `README.md`

### Step 1: Document local development

README must include:

```bash
python3 -m http.server 4173
```

and the URL:

```text
http://localhost:4173
```

It must state that Phase 1 is browser-only and uses simulated local state.

### Step 2: Run syntax checks

Run `node --check` against every JavaScript module.

Expected result: no syntax errors.

### Step 3: Run the manual acceptance flow

1. Load the playground.
2. Select list layout.
3. Select tight density.
4. Select ink theme.
5. Add two different products.
6. Confirm cart quantity and total update.
7. Confirm the trace shows three steps.
8. Open Action, Fragment, and Variant source tabs.
9. Copy source code.
10. Change a variant and confirm cart state remains.
11. Reset and confirm defaults return.
12. Tab through all interactive controls and confirm visible focus.
13. Enable reduced motion and confirm no essential information disappears.

### Step 4: Run the static server check

```bash
python3 -m http.server 4173
curl -I http://127.0.0.1:4173/index.html
```

Expected result: HTTP 200.

### Step 5: Verify scope honesty

Check that the UI labels the runtime as local/simulated and does not claim that browser state is a secure cart, payment system, or server-authoritative database.

---

## Phase 1 handoff

At completion, the handoff should include:

- A clickable local playground
- A documented atomic file structure
- A working variant matrix
- A working cart action demonstration
- A visible fragment/request trace
- Source inspection for every Phase 1 capability
- A README with run instructions and scope boundaries
- A verification record showing syntax checks and HTTP 200

The next plan should begin Phase 2 with the real hypermedia core: filesystem routing, server rendering, fragment replacement, and the first `<x-list>` mapping test.

