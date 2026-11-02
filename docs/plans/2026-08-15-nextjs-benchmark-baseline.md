# Next.js Benchmark Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a separate provider-free Next.js + Tailwind + shadcn-shaped ecommerce baseline and measure it against Intent OS.

**Architecture:** The baseline uses App Router pages, server actions, a small in-memory/session boundary, shared UI primitives, and explicit validation. It is isolated under `benchmark/next-baseline` and is measured as a separate repository root; no external payment or identity provider is used.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS conventions, shadcn-style components.

---

### Task 1: Create the baseline application surface

Create the package manifest, App Router pages, shared components, catalog data, server actions, validation/session helpers, styling, and local tests needed to represent the shared ecommerce acceptance task.

### Task 2: Validate the baseline artifact

Run syntax/static checks over the baseline source and verify the required routes, mutation boundaries, validation, session handling, and test declarations are present.

### Task 3: Run the falsification measurement

Run `node scripts/benchmark.mjs --intent . --baseline benchmark/next-baseline`, save the measured JSON artifact, and update the benchmark documentation with the fact that the baseline is a source-level comparison unless its external dependencies are installed and its acceptance tests are executed.
