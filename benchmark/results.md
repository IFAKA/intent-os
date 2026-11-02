# Benchmark run — 2026-08-15

Command:

```bash
node scripts/benchmark.mjs \
  --intent . \
  --intent-scope pages,src,public,schema.js,app.config.js,theme.css \
  --baseline benchmark/next-baseline \
  --baseline-scope app,components,lib,package.json,tsconfig.json
```

The Next.js baseline builds with Next 16.3.1 and its local Vitest security tests pass. The measured source comparison is recorded in `results.json`:

| Metric | Intent OS app | Next baseline | Intent / baseline |
| --- | ---: | ---: | ---: |
| Authored LOC | 480 | 146 | 3.29× |
| Files | 20 | 16 | 1.25× |
| Token estimate | 6,917 | 1,946 | 3.55× |
| Browser JS bytes | 17,739 | 0 | — |
| CSS bytes | 1,292 | 384 | 3.36× |

This is a preliminary source-level result, not a thesis win: the baseline has only two local security tests and does not yet execute the full shared acceptance specification. The target thresholds are therefore marked false in `results.json`; a fair final falsification run requires both implementations to pass the same acceptance and security test matrix.
