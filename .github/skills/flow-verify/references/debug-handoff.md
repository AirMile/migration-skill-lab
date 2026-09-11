# Debug handoff

Read this only when the overall result is `FAIL` or `BLOCKED`.

Write `debug-handoff.json` after `verification-result.json`, copying the shape
from `print-shape.mjs` on `examples\debug\demo-line-drawer\debug-handoff.json`
and letting the validator correct it. It points to the exact consumed
artifacts by hash and carries, for the failed criterion, the scenario, command
or manual observation; the expected behavior; the actual evidence; a
reproduction; the suspected boundary; the allowlisted candidate paths; the
smallest recommended next action; and a tier recommendation.

Classify it:

- `repairable`: a local product failure that a fresh `flow-debug` chat can
  reproduce and change within the approved allowlist;
- `external-blocked`: missing access, environment, approval, dependency or
  host ownership. It never starts debug.

Never repair, choose the final tier or treat a repair candidate as `PASS`.
`flow-debug` owns the repair; a contract change needs a new `flow-baseline` and
renewed human approval. For a `repairable` handoff, offer the fresh
`/flow-debug` chat through the continuation routes, carrying only the artifact
paths and the product root.
