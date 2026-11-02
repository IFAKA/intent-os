# Developer Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a self-contained `/docs` developer portal that explains Intent OS, gets a developer from install to first app, and clearly separates local-ready capabilities from production follow-up work.

**Architecture:** Add one server-rendered documentation page to the existing route table, with content authored in HTML and styling in the existing theme. The portal will link to the demo store and repository documentation, use only local assets, and avoid external identity, payment, or hosting dependencies.

**Tech Stack:** Node.js server, Intent OS HTML templates, semantic HTML, existing CSS, existing route and test harness.

---

### Task 1: Add the documentation route and page — Complete

**Files:**
- Modify: `framework/router.js`
- Create: `pages/docs.html`
- Modify: `pages/index.html`

Add `/docs` to the route table. Build a responsive portal with: a hero explaining the intent-first model, a three-step quick start, an architecture diagram expressed with semantic cards, project anatomy, capability cards, and a production-readiness checklist. Add links to `/products`, `/account`, and repository docs. Add a developer-portal link from the demo homepage.

### Task 2: Style the portal — Complete

**Files:**
- Modify: `theme.css`

Add an isolated docs visual system: dark ink hero, acid-green accent, orange signal color, documentation grid, code blocks, badges, checklist states, responsive behavior, and reduced-motion support. Keep the existing commerce/demo styles unchanged.

### Task 3: Document and verify the entry point — Complete

**Files:**
- Modify: `README.md`
- Test: `tests/server.test.mjs`

Document `http://localhost:3000/docs` as the developer entry point and add an HTTP assertion that the docs route renders the portal title and quick-start content. Run the focused server test and the complete test suite.
