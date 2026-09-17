# Debug handoff

Read this only when the overall result is `FAIL` or `BLOCKED`.

Write `debug-handoff.json` after `verification-result.json`, scaffolded with
`new-result.mjs --artifact debug-handoff --status <repairable|external-blocked>`
and the three artifacts it consumes. It hashes them, names the file for the
attempt and opens one failure per criterion the verification did not pass.
Fill in, for each, the expected behavior; the actual evidence; a reproduction;
the suspected boundary; the candidate paths, narrowed from the allowlist it
starts with; and the tier recommendation with its reason.

Classify it:

- `repairable`: a local product failure that a fresh `flow-debug` chat can
  reproduce and change within `scope.allowedWritePaths`;
- `external-blocked`: missing access or environment, a dependency or
  configuration change the contract does not declare, or host ownership. It
  never starts debug.

Never repair, choose the final tier or treat a repair candidate as `PASS`.
`flow-debug` owns the repair; a contract change needs a new `flow-baseline`
run. For a `repairable` handoff, offer the fresh `/flow-debug` chat through the
continuation routes, carrying only the artifact paths and the product root.
