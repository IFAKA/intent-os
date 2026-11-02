# Phase 10 falsification benchmark

This benchmark compares two agents implementing the same ecommerce acceptance specification:

- A: Next.js + Tailwind + shadcn
- B: Intent OS

Give both agents the same prompt and the same product/order requirements from the project plan. Record the repository root for each implementation, then run:

```bash
node scripts/benchmark.mjs \
  --intent ./intent-os-run \
  --intent-scope pages,src,public,schema.js,app.config.js,theme.css \
  --baseline ./next-run \
  --baseline-scope app,components,lib,package.json,tsconfig.json \
  --metadata ./run-metadata.json
```

The command measures repository-visible application evidence: non-empty source LOC, source files, a rough generated-token estimate, browser JavaScript/CSS bytes, and which framework concepts appear. Scope arguments prevent framework internals and installed dependencies from distorting the comparison. `run-metadata.json` is for agent/process evidence the repository cannot infer:

```json
{
  "toolCalls": 0,
  "repairIterations": 0,
  "timeToFirstPassingImplementationSeconds": 0,
  "acceptanceTestsPassed": 0,
  "acceptanceTestsTotal": 0,
  "securityTestsPassed": 0,
  "securityTestsTotal": 0,
  "serverRequests": 0
}
```

The comparison is falsified if Intent OS fails any required acceptance or security test, or if it does not reach the target thresholds from the plan: 3× less authored LOC, 50% fewer tokens, 50% fewer files, no custom application JavaScript for the canonical flow, and no custom application CSS beyond theme/layout exceptions. The script reports measurements; it does not declare the thesis true.
