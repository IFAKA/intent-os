# Intent OS Runtime Lab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the thesis landing page into an atomic, inspectable Intent OS playground where users can test UI/runtime variants and see the source code and request trace behind each behavior.

**Architecture:** Keep the project dependency-free and browser-native. Move the page into ES module files grouped by atoms, components, runtime, and data; render the playground from a small application shell; keep the server-authoritative behavior represented by a deterministic local runtime with explicit boundaries.

**Tech Stack:** Semantic HTML, CSS custom properties, vanilla ES modules, browser History/DOM APIs.

---

### Task 1: Establish the atomic project shell

**Files:**
- Modify: `index.html`
- Create: `src/main.js`
- Create: `src/data/products.js`
- Create: `src/runtime/store.js`

Add a single app mount, module entrypoint, product fixtures, and a small observable cart store.

### Task 2: Create atomic UI components

**Files:**
- Create: `src/components/atoms.js`
- Create: `src/components/product-card.js`
- Create: `src/components/request-trace.js`
- Create: `src/components/code-viewer.js`
- Create: `src/components/playground.js`

Make each visual concern independently renderable and expose data attributes for the runtime to update.

### Task 3: Add the runtime laboratory interactions

**Files:**
- Modify: `src/main.js`
- Create: `src/runtime/intent-runtime.js`

Implement variant controls for layout, density, visual theme, and render mode; wire cart actions into the trace and source viewer; make reset and copy actions functional.

### Task 4: Replace the stylesheet with a lab-specific design system

**Files:**
- Modify: `styles.css`

Define tokens, responsive layouts, atomic component styling, trace states, code viewer, and deliberate motion while preserving the editorial Intent OS identity.

### Task 5: Verify the project

**Files:**
- No new files

Run JavaScript syntax checks and serve the static project locally, confirming the entry document returns successfully.

