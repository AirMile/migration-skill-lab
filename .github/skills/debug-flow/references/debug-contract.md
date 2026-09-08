# Debug contract

Read this reference for every `debug-flow` run.

## Purpose

`debug-flow` repairs one failed or repairable blocked migration candidate
inside an already approved Flow Contract. It is a scoped repair stage, not a
new baseline, not a broader migration and not a verifier. Independent
re-verification remains mandatory.

## Artifact chain

The run consumes exactly these versioned artifacts:

- approved `flow-contract.json`;
- matching `migration-result.json`;
- matching `verification-result.json` with overall `FAIL` or repairable
  `BLOCKED`;
- matching `debug-handoff.json` produced by `verify-flow`.

Reject the run when any artifact is missing, unapproved, incompatible,
cross-flow or hash-mismatched. `debug-handoff.json` must point to the exact
contract, migration result and verification result that triggered the repair.
A prior chat explanation never overrides artifact evidence.

## Tier selection

Choose the cheapest valid tier automatically:

- `immediate`: a local root cause is already confirmed and a targeted
  reproduction exists. Do not use it for open-ended investigation or
  cross-boundary uncertainty.
- `light`: exactly one strong local hypothesis is plausible but not yet proven.
  Do not use it when multiple competing hypotheses remain or a lower tier has
  already failed.
- `heavy`: the cause is unclear, spans approved boundaries, or survived a lower
  tier. Do not use it to debug an external blocker or justify scope expansion.

If `immediate` is valid, do not start at `light` or `heavy`.

## Attempt budget

Attempts are monotonic and finite:

- at most one `immediate` attempt;
- at most one `light` attempt;
- at most one `heavy` attempt;
- escalation order is `immediate -> light -> heavy`;
- no attempt reset after a partial fix, new clue or manual retry;
- no tier repetition and no loop after `heavy`.

When the starting tier is `light`, `immediate` stays unused and cannot be
inserted later. When the starting tier is `heavy`, both cheaper tiers remain
unused rather than retroactively consumed.

## Attempt invariants

Every attempt must preserve a complete record of:

1. reproduction evidence;
2. current hypothesis;
3. changed paths or an explicit `none` record;
4. validation results;
5. checkpoint outcome.

A no-change attempt is still an attempt and must remain visible in the result.
A failed attempt is evidence, not something to overwrite.

## Scope boundary

All product edits must stay within `scope.allowedWritePaths`. `debug-flow`
never broadens the approved slice, rewrites the contract, or uses a failure as
permission to change dependencies, lockfiles, configuration, backend contracts,
Maui integration, Auth0 behavior or other host boundaries unless those exact
changes were already approved for this flow.

External blockers are not debugged here. Service outages, missing access,
unavailable environments, human approval gaps, and defects owned by an
external system produce `blocked`, not a repair attempt.

## Checkpoint discipline

A repair attempt may create a local checkpoint only when the consumed contract
still authorizes `auto-local` and the relevant reproduction plus declared
validations are green. Use the checkpoint verifier in order:

1. `verify-checkpoint.mjs --prepare` before staging;
2. stage only the explicit returned paths;
3. `verify-checkpoint.mjs --verify-staged` before commit;
4. create the local commit without bypassing hooks;
5. `verify-checkpoint.mjs --verify-commit` with the same manifest and new SHA.

Never use `git add -A`, `--no-verify`, amend, empty commits, force-push or any
push from `debug-flow`.

## Outcome rules

`debug-flow` may end only as:

- `repaired`: the targeted reproduction now passes, declared validations are
  recorded honestly, changed paths remain allowlisted, and the attempt record
  is complete;
- `blocked`: the issue is external, unreproducible, unapproved or needs a new
  contract or approval;
- `parked`: the `heavy` tier could not produce a safe local repair and a human
  decision is required.

`debug-flow` never declares `PASS`. A `repaired` result is only a candidate
repair and must hand off immediately to a fresh independent `verify-flow` run.
The verifying agent must not inherit the mutable debug context as proof.

## Chat transition

After a repaired result, ask the user before opening a fresh `/verify-flow`
chat. Never start a nested agent or perform the independent verification in the
debug chat.
