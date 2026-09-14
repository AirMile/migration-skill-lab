---
document: skill-acceptance-criteria
skill: flow-debug
targetVersion: 0.8.0
status: experimental
date: 2026-09-11
---

# `flow-debug` v0.8.0 acceptance criteria

## Hard gates

A run fails immediately when it repairs an external blocker, writes outside
`scope.allowedWritePaths`, resets or repeats a tier attempt, skips checkpoint
verification, declares `PASS`, or modifies skill source during its own run.

## Required output

- A validated artifact chain containing a validating `flow-contract.json`,
  matching `migration-result.json`, failed or repairable blocked
  `verification-result.json`, and matching `debug-handoff.json`.
- Recorded content hashes proving that all consumed artifacts describe the same
  flow and failure.
- Automatic cheapest-tier selection with a monotonic attempt ledger.
- At most one attempt per tier and automatic escalation
  `immediate -> light -> heavy`.
- For every attempt: reproduction evidence, hypothesis, changed paths,
  validation outcomes and checkpoint status.
- A `debug-result.json`, or `debug-result-<N>.json` when it answers
  verification attempt N, whose status is only `repaired`, `blocked` or
  `parked`, with no prose report beside it.
- Changed paths that remain a subset of `allowedWritePaths`.
- Local checkpoint evidence created through `verify-checkpoint.mjs` for every
  commit-eligible repaired milestone.
- A mandatory handoff to a fresh independent `flow-verify` after any
  `repaired` result.
- A schema-valid observation artifact written after the primary debug result,
  including an empty observation list when no concrete skill signal occurred.

## Acceptance check

The source is acceptable when:

1. it accepts only a validating Flow Contract and a `verification-result.json`
   whose overall status is `FAIL` or repairable `BLOCKED`, never `PASS`;
2. it rejects a `debug-handoff.json` or verification input whose `flowId`,
   contract hash, migration-result hash or failure target does not match;
3. it selects `immediate` only when the root cause is confirmed, local and has
   a targeted reproduction;
4. it selects `light` only for one strong but unproven local hypothesis;
5. it selects `heavy` for unclear, cross-boundary or repeated failures and does
   not downgrade afterward;
6. it enforces exactly one attempt per tier, no reset of attempts and no
   endless loop after `heavy`;
7. it records reproduction, hypothesis, changed paths, validation and
   checkpoint evidence for every attempt, including no-change attempts;
8. it never edits outside `allowedWritePaths` and never widens it;
9. it uses `verify-checkpoint.mjs --prepare`, `--verify-staged` and
   `--verify-commit` for commit-eligible repairs and never uses `git add -A`,
   `--no-verify`, amend, push or other history-rewriting shortcuts;
10. `repaired` requires a passing targeted reproduction, honest validation
    evidence and recorded checkpoint outcome;
11. it ends every `repaired` run by offering a fresh independent `/flow-verify`
    chat through the same three continuation routes as the other flow skills,
    and never self-certifies the migration as `PASS`;
12. external systems, and dependency, configuration or host changes the
    contract does not already declare, become `blocked`, not debugged;
13. a non-repair at `heavy` becomes `parked` for human decision rather than a
    silent retry or scope expansion;
14. observation capture excludes product defects, expected blockers, external
    issues, missing Angular conventions and unproven causality;
15. observation capture failure is visible but cannot rewrite the primary debug
    status;
16. a `visual-parity` failure is repaired against the contract's declared
    `appearance` and `layout` for the named surface, not against a fresh
    reading of the React source;
17. a visual repair confirmed only in an isolated or injected fixture is not
    recorded as `repaired`, because a fixture cannot show width, alignment or
    spacing against the retained sibling sections.
18. it reads a file once at the range it needs, repeats no near-identical
    search, and reads no schema or script source in place of running the
    validator;
19. observation capture evaluates the countable checks against this run's own
    tool history, and an empty list means every check was evaluated and none
    fired rather than that none was looked for.
20. observation capture follows `docs\flow-observation-capture.md`, shared with
    the other flow skills, and the sidecar is created with
    `new-observations.mjs`.
21. the run freezes its starting status with `run-context.mjs --save-status`
    and reports its delta with `--compare`, never by hand;
22. the continuation comes from `continuation.mjs` and carries every artifact
    re-verification validates: the contract, the migration result and
    `debug-result.json`;
23. every script, `verify-checkpoint.mjs` included, is invoked from
    `<lab>\scripts\`, never relative to the working directory;
24. artifact pointers in `debug-result.json` come from `hash-artifact.mjs`,
    never from digests computed by hand;
25. `run-context.mjs --compare --contract` runs before `debug-result.json` is
    written, and a path under `comparison.outsideAllowlist` keeps the result
    from `repaired`.
26. a repair answering `verification-result-<N>.json` writes
    `debug-result-<N>.json`, never overwriting the earlier repair a later
    verification hashes.
27. only a saved prompt named for the attempt this repair answers,
    `<flowId>-flow-debug-prompt.md` or `-prompt-<N>.md` for
    `verification-result-<N>.json`, is treated as this run's continuation, and
    its own `--save` names the next verification's prompt for attempt N + 1,
    so it never collides with the prompt that started attempt N.
