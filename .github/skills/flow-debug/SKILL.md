---
name: flow-debug
description: Diagnose and repair one failed or repairable BLOCKED React-to-Angular migration flow within an already approved write scope, then hand off to a fresh independent re-verification. Use only with /flow-debug.
---

# Flow Debug

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is out of band: it repairs a failure and hands back to verification.

Skill version: `0.2.0`.

Recommended model: Claude Sonnet 5 or GPT-5.3-Codex.

Repair one failed or repairable blocked migration only within the already
approved contract and artifact chain. Prefer a fresh isolated agent context.
Reload required state from versioned artifacts, not earlier chat memory.
`flow-debug` may prepare a repair candidate, but it never declares `PASS`.

## Required inputs

Confirm all inputs before any product write:

- path to the approved `flow-contract.json`;
- path to the corresponding `migration-result.json`;
- path to a `verification-result.json` whose overall status is `FAIL` or a
  repairable `BLOCKED`;
- path to the corresponding `debug-handoff.json` produced by `flow-verify`;
- migration-skill-lab root containing the validator, schemas and
  `scripts\verify-checkpoint.mjs`;
- product root, expected branch and current Git-visible worktree status;
- contract `status: approved` and `approval.status: approved`;
- exact `allowedWritePaths`, targeted validation commands, rollback guidance
  and checkpoint policy from the same approved contract;
- proof that the consumed artifacts share the same `flowId` and recorded
  content hashes;
- declared run-artifact directory.

Stop and report `BLOCKED` when an artifact is missing, incompatible,
unapproved, cross-flow, hash-mismatched, outside the approved write scope or
blocked by an external system.

## Workflow

1. Read `references/debug-contract.md`.
2. Run only in a fresh isolated chat opened from `flow-verify`. When isolation
   is unavailable, stop `BLOCKED` rather than reusing verification context.
   Reload every required artifact from disk and ignore prior chat assumptions.
3. Validate the approved Flow Contract, migration result and verification
   result with the handoff validator. Reject a `debug-handoff.json` whose
   `flowId`, artifact hashes, failure target or approved write scope does not
   match those validated artifacts.
4. Freeze the initial evidence: current branch, HEAD, Git-visible worktree
   status, failed criteria, failing commands, manual observations and artifact
   hashes.
5. Refuse external or approval blockers. Do not debug service outages, missing
   access, dependency approvals, host-contract changes or other issues that are
   outside the approved local product slice.
6. Treat a `visual-parity` failure as a first-class repair target: its
   expected outcome is the contract's declared `appearance` and `layout` for
   that surface, and its evidence must come from the real host layout. A
   visual repair confirmed only in an isolated fixture is not repaired.
7. Select the cheapest starting tier without asking:
   - `immediate` when the root cause is confirmed, local and already has a
     targeted reproduction;
   - `light` when exactly one strong local hypothesis explains the failure but
     is not yet proven;
   - `heavy` when the cause is unclear, crosses approved boundaries or the same
     failure already survived a lower-tier attempt.
8. Attempt exactly once per tier and escalate automatically in order
   `immediate -> light -> heavy`. Never reset attempts, repeat a tier or loop
   after `heavy`.
9. For each attempt, preserve and record all five evidence blocks even when no
   product file changes occur:
   - reproduction evidence;
   - current hypothesis;
   - actual file changes or `none`;
   - validation outcomes;
   - checkpoint outcome.
10. In each attempt, rerun or restate the smallest targeted reproduction from
   `flow-verify`, make only the minimum approved product edits inside
   `allowedWritePaths`, then rerun the targeted reproduction and declared
   validations.
11. When a repaired candidate has the required green evidence and checkpoint
    mode is `auto-local`, create a checkpoint manifest and run:

    ```powershell
    node .\scripts\verify-checkpoint.mjs --prepare <manifest.json>
    node .\scripts\verify-checkpoint.mjs --verify-staged <manifest.json>
    node .\scripts\verify-checkpoint.mjs --verify-commit `
      <manifest.json> <commit-sha>
    ```

    Stage only the verifier's explicit paths. Do not use `git add -A`, bypass
    hooks, amend or create an empty commit.
12. Write a concise human-readable debug summary and `debug-result.json` in the
    declared run directory. Use statuses honestly:
    - `repaired` when the targeted reproduction and declared validations now
      pass and the attempt record is complete;
    - `blocked` when the issue is external, unreproducible, unapproved or
      requires scope, dependency, configuration or host-contract changes that
      were not already approved;
    - `parked` when the `heavy` tier still cannot produce a safe, local repair
      and a human decision is required.
13. Every `repaired` result must end with a mandatory handoff to a fresh,
    independent `flow-verify` run. `flow-debug` never declares `PASS`, never
    treats a repair as verified and never closes the verification loop itself.
14. Record the final Git-visible worktree status and report any delta against
    the frozen baseline without reverting unrelated changes.
15. For a `repaired` result, end with one focused user question offering a
    fresh `/flow-verify` chat with only the declared artifacts and product root.
    Never spawn a verifier subagent or reuse this debug chat as verification.

## Safety boundary

Never:

- rely on earlier chat context instead of the declared artifact chain;
- repair or investigate an external blocker as if it were a local code defect;
- edit a product path outside `allowedWritePaths` or broaden the approved
  scope;
- add a dependency, change a lockfile, alter configuration, or modify backend,
  Maui, Auth0 or other host contracts unless that exact change is already
  approved in the consumed contract and handoff;
- edit this skill, its references, schemas or any installed skill snapshot
  during a run;
- skip `verify-checkpoint.mjs`, use `git add -A`, bypass hooks, amend, rewrite
  history, push, merge, publish or create a pull request;
- reset the tier ledger, retry the same tier indefinitely or hide a failed
  attempt behind a later summary;
- declare `PASS`, skip the independent re-verification, update Targetprocess
  or make any other external write;
- turn a product-behavior improvement into a repair; return any requested
  acceptance change to `flow-baseline` and renewed approval;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data in artifacts.

## Handoff

`debug-result.json` is the canonical repair artifact. It must include the
consumed artifact paths and hashes, the selected starting tier, the monotonic
attempt ledger, failed-scenario diagnosis, reproduction evidence, hypothesis
updates, changed paths, validation outcomes, checkpoint evidence, remaining
limitations and the final `repaired`, `blocked` or `parked` status.

A `repaired` result is incomplete without a fresh independent `flow-verify`
handoff that reuses the approved contract and current product state from disk.
A contract change, broadened scope or new approval requirement returns to
`flow-baseline` or a human decision instead of continuing in `flow-debug`.

A repaired candidate is handed to a fresh verifier only after the user confirms
the new-chat transition.

## Reading discipline

Context is a budget this run spends once, and every re-read of the same bytes
is paid again for nothing.

- Read a file once, at the range you need. Return to it only for a range you
  have not read; never re-read it whole after reading part of it, and never
  request a range overlapping one you already hold.
- Widen or narrow a search rather than repeating it. Two patterns that differ
  only in alternation, wording or case return mostly the same hits, so the
  second one buys nothing.
- Do not read `schemas\` or `scripts\` source to learn an artifact's shape.
  Copy the shape from `examples\handoff\`, write the artifact, run
  `validate-handoff.mjs` and act on its errors; the validator names what is
  missing far more cheaply than a schema read does.
- Resolve a module path before reading it. A directory may be a barrel or a
  single file, so check which exists instead of guessing and failing.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the debug workflow to analyze these signals.

After `debug-result.json` and the re-verification handoff are complete, or
after the final `blocked` or `parked` response when that artifact cannot be
produced:

1. Evaluate this run's own tool history against these checks and record every
   one that fired. They are countable, so answer them from the history rather
   than from impression:
   - the same file read more than twice, or re-read over a range already
     held: `unnecessary-context-load`;
   - two or more searches whose patterns differ only in alternation, wording
     or case: `unnecessary-context-load`;
   - a schema, validator or renderer source read instead of running the
     command: `unnecessary-context-load`;
   - a tool call that failed because this skill named a path, command or flag
     that does not exist or does not behave as written:
     `skill-caused-tool-failure`;
   - a step performed by hand that a script in `scripts\` already performs:
     `deterministic-step-candidate`;
   - a user correction, a restated instruction, or the same question asked
     twice: `user-correction` or `ambiguous-instruction`;
   - an artifact that needed a repair pass before it validated:
     `output-mismatch`.
2. Exclude product defects, external blockers, expected precondition blockers,
   missing Angular conventions themselves, preferences and static speculation.
   Executor noise means a host or transport failure unrelated to this skill; a
   tool call this skill's own wording caused is never executor noise.
3. Deduplicate semantically equivalent signals from this run and preserve their
   occurrence count. Do not cap the number of material observations.
4. Write `<run-artifact-directory>\skill-run-observations.json`. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations.json>"`.
6. Report a capture or validation failure separately without changing the
   primary debug status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.