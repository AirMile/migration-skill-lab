---
name: flow-debug
description: Diagnose and repair one failed or repairable BLOCKED React-to-Angular migration flow inside the write scope its contract declares, then hand off to a fresh independent re-verification. Use only with /flow-debug.
---

# Flow Debug

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is out of band: it repairs a failure and hands back to verification.

Skill version: `0.7.0`.

Recommended model: Claude Sonnet 5 or GPT-5.3-Codex.

Repair one failed or repairable blocked migration inside the validated
contract and artifact chain, in a fresh chat opened from `flow-verify`. Reload
every input from disk, never from an earlier chat. `flow-debug` prepares a
repair candidate; it never declares `PASS`.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

The invocation names `flow-contract.json`, `migration-result.json`,
`verification-result.json`, `debug-handoff.json`, both work-item snapshots,
`<lab>`, the product root and the run directory. Everything else comes from
those:

- Validate first:
  `node "<lab>\scripts\validate-handoff.mjs" <flow-contract.json> <migration-result.json> <verification-result.json> <debug-handoff.json>`.
- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --run-dir <run-dir> --save-status --contract <flow-contract.json>`.
  That status, HEAD and branch, with the failed criteria, failing commands and
  manual observations in `verification-result.json`, are the frozen evidence
  every attempt is measured against. A saved `<flowId>-flow-debug-prompt.md`,
  or `-prompt-<N>.md` when this repair answers `verification-result-<N>.json`,
  means an earlier phase chose to continue later: say so in one line and resume
  from the artifacts it names. Another attempt's prompt is spent.
- From the contract: `scope.allowedWritePaths`, the test, typecheck and build
  commands, `rollback`, `checkpointPolicy` and `visualParity`.
- The work-item snapshots travel only so the repaired chain reaches the next
  `flow-verify` complete; this skill does not change them.

Report `BLOCKED` before any product write when:

- an artifact is missing, fails validation or belongs to another flow, or
  `debug-handoff.json` names a `flowId`, artifact hash or failure target that
  does not match the validated artifacts;
- `verification-result.json` is `PASS`, or `debug-handoff.json` is
  `external-blocked`;
- this is not a fresh chat opened from `flow-verify`: debug context never
  mixes with verification context.

## Workflow

1. **Refuse external blockers.** Service outages, missing access, unavailable
   environments and defects owned by an external system end as `blocked`,
   never as a repair attempt. So does a fix that would change dependencies,
   lockfiles, configuration, backend, Maui or Auth0 contracts or another host
   boundary beyond what the contract's `targetArchitecture` and allowlist
   already declare.
2. **Choose the cheapest valid starting tier** without asking:
   - `immediate`: the root cause is confirmed, local and already has a targeted
     reproduction. Never for open-ended investigation or cross-boundary
     uncertainty;
   - `light`: exactly one strong local hypothesis explains the failure but is
     not yet proven. Never while competing hypotheses remain;
   - `heavy`: the cause is unclear, crosses the slice boundary or already
     survived a lower tier. Never to debug an external blocker or to justify a
     wider scope.
   When `immediate` is valid, never start higher.
3. **Attempt budget.** At most one attempt per tier, escalating
   `immediate -> light -> heavy`. A cheaper tier that was skipped stays unused
   and is never inserted later. No reset after a partial fix, a new clue or a
   manual retry, no repeated tier and no loop after `heavy`.
4. **Each attempt** reruns or restates the smallest targeted reproduction from
   `debug-handoff.json`, makes only the minimum product edit inside
   `allowedWritePaths`, then reruns that reproduction and the declared test,
   typecheck and build commands. Record all five evidence blocks, also for an
   attempt that changed nothing: reproduction evidence, current hypothesis,
   changed paths or `none`, validation outcomes and checkpoint outcome. A
   failed attempt is evidence; never overwrite it with a later one.
5. **Visual parity** failures are first-class repair targets. The expected
   outcome is the contract's declared `appearance` and `layout` for the named
   surface, not a fresh judgement of the React source, and the evidence comes
   from the real host layout: a fixture cannot show width, alignment or
   spacing against the retained siblings, so a visual repair seen only there is
   not repaired. Record the measured deviation and the value after the repair,
   as for a behavioral reproduction.
6. **Checkpoints.** When `checkpointPolicy.mode` is `auto-local` and the
   reproduction and declared validations are green, write a checkpoint
   manifest and run, in order,
   `node "<lab>\scripts\verify-checkpoint.mjs" --prepare <manifest.json>`,
   stage only the paths it returns, `--verify-staged <manifest.json>`, commit
   without bypassing hooks, then `--verify-commit <manifest.json> <sha>`. When
   the mode is `disabled`, commit nothing.
7. **Worktree check.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare --contract <flow-contract.json>`
   and report the delta against the frozen status without reverting unrelated
   changes. A path under `comparison.outsideAllowlist` is a write outside the
   boundary, and the result cannot be `repaired`.
8. **Write `debug-result.json`** in the run directory, copying the shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\debug\demo-line-drawer\debug-result.json"`
   and every pointer from `node "<lab>\scripts\hash-artifact.mjs" <file>...`,
   and validate it together with the four artifacts it consumed. Answering
   `verification-result-<N>.json`, name it `debug-result-<N>.json`: a later
   verification hashes the earlier one. It carries the starting tier, the attempt ledger, the diagnosis, changed paths,
   validation and checkpoint evidence, remaining limitations and one status:
   - `repaired`: the targeted reproduction and declared validations pass,
     every changed path is allowlisted and the ledger is complete;
   - `blocked`: the issue is external or unreproducible, or needs a contract
     change or a wider scope;
   - `parked`: `heavy` could not produce a safe local repair and a human
     decision is required.
   Write no prose report; summarize the result in this chat.
9. **Continuation.** A `repaired` result always goes to a fresh, independent
   `/flow-verify`; this skill never declares `PASS` or closes the loop itself.
   Build the invocation with
   `node "<lab>\scripts\continuation.mjs" --next flow-verify --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json> <migration-result.json> <work-item-baseline.json> <work-item-migration.json> <debug-result.json>`,
   then offer exactly three routes and perform only the chosen one:
   1. a fresh chat opened now through the host's own mechanism, carrying only
      the invocation. Never start a second terminal window;
   2. the invocation shown here, to paste into a chat the user opens;
   3. the same command with `--save`, a checkpoint rather than an
      abandonment, since every phase reads only artifacts.
   Never verify in this chat, spawn a verifier subagent or delegate to a
   background agent. A `blocked` or `parked` result goes to a human decision,
   or to a new `flow-baseline` run when the contract has to change.
10. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it with `--primary <debug-result.json> --status repaired`, `blocked` or
    `parked`.

## Safety boundary

Never:

- rely on earlier chat context instead of the artifact chain;
- repair an external blocker as if it were a local defect;
- edit a product path outside `allowedWritePaths`, widen it or rewrite the
  contract;
- add a dependency, change a lockfile, alter configuration, or modify backend,
  Maui, Auth0 or other host contracts unless the contract already declares
  that exact change;
- skip `verify-checkpoint.mjs`, use `git add -A`, bypass hooks, amend, create an
  empty commit, rewrite history, push, merge, publish or create a pull request;
- reset the tier ledger, repeat a tier or hide a failed attempt behind a later
  summary;
- declare `PASS`, skip the independent re-verification, update Targetprocess
  or make any other external write;
- turn a product-behavior improvement into a repair: an acceptance change
  needs a new `flow-baseline` run;
- edit this skill, its references, schemas or an installed snapshot during a
  run;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors. Read the validator's rule only when an error names no
  fix and one retry fails, and record that as an observation.
- Resolve a module path, barrel or single file, before reading it.
