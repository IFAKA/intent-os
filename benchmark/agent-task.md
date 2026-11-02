# Shared agent task

Implement this ecommerce slice in a fresh repository using the assigned stack:

1. Render a product catalog at `/products` with search, category filtering, URL-addressable pagination, and product detail by slug.
2. Let a user add a product to a cart with and without JavaScript. Prevent duplicate-click quantity corruption.
3. Render authoritative cart totals and reject invalid quantities and client-supplied prices.
4. Create an order draft, show it at checkout, and allow payment handoff behind a provider boundary.
5. Provide account/login and logout UI with session fixation protection and ownership checks.
6. Protect mutations with CSRF validation, rate-limit sensitive actions, escape output, and reject unowned orders.
7. Add tests for the acceptance specification in `docs/plans/2026-08-15-intent-os-project-plan.md`.

Do not count framework/library code as agent-authored work. Record tool calls, repair iterations, time to first passing implementation, and test results in the metadata shape in `acceptance-spec.md`.
