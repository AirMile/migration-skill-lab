---
document: skill-acceptance-criteria
skill: flow-migrate
targetVersion: 0.14.0
status: experimental
date: 2026-09-11
---

# `flow-migrate` v0.14.0 acceptance criteria

## Hard gates

A run fails immediately when it writes without a validating contract and the
user's `/flow-migrate` invocation, edits outside `scope.allowedWritePaths`,
changes dependencies or host contracts the contract does not declare, skips
the React baseline tests, hides a failed validation, or modifies skill source
during its own run.

## Required output

- A validating Flow Contract as input, with the invocation as the authorization
  to write inside its allowlist.
- React characterizing tests for the contract's uncovered scenarios before
  migration.
- A bounded Angular implementation and Angular tests for the same scenarios.
- Targeted test, typecheck and build results.
- A `migration-result.json` with contract hash, changed paths, validation,
  coverage status, rollback and limitations.
- Before/after product Git-visible worktree evidence.
- A schema-valid observation artifact written after `migration-result.json`,
  including an empty observation list when no concrete skill signal occurred.
- A checkpoint record for every eligible milestone and a schema-valid
  Epic/Feature/Story/Task progress snapshot plus deterministic Markdown.
- Checkpoints linked to the implementation Task, calculated Story progress and
  a daily standup block with the same percentage.

## Acceptance check

The source is acceptable when:

1. its write gate requires the validator root and a contract that validates,
   and treats the `/flow-migrate` invocation as the authorization to write
   inside that contract's allowlist, never an earlier run or a report;
2. it refuses dependency, lockfile, configuration and host changes the
   contract does not declare, while applying exactly the paths and changes
   `targetArchitecture` declares;
3. it preserves pre-existing product worktree changes;
4. it produces a schema-valid migration result;
5. it records unresolved Angular conventions as limitations instead of
   presenting them as approved standards;
6. it hands failure diagnosis to `flow-verify` rather than self-certifying.
7. it does not confuse product validation failures or missing conventions with
   skill-improvement evidence;
8. observation capture cannot change a completed, failed or blocked migration
   result.
9. automatic commits require `auto-local` in the contract's checkpoint policy,
   the expected branch,
   green validation and exact allowlisted staging;
10. it never uses `git add -A`, bypasses hooks, amends, pushes or includes an
    unproven pre-existing dirty delta;
11. checkpoint SHA, subject, paths and validation evidence are recorded;
12. it never updates Targetprocess or treats copy-ready progress as applied.
13. it never equates commit count with progress or creates one Task per commit.
14. repair attempts from verification belong to `flow-debug`, not this skill.
15. it leaves manual browser-flow and Maui-WebView scenario verification to a
    fresh independent `flow-verify` chat.
16. it ends by offering that fresh chat through one focused user question and
    never starts a verifier subagent.
17. it does not replace, hide or early-return from a parent React form while
    that form contains inventory items marked `retain-react`.
18. it characterizes retained controls and conditional branches before mounting
    the partial Angular slice.
19. it records `renderedSurfaceComparison` with `real-parent-tree` evidence,
    the retained sibling sections compared against and concrete style and
    layout observations whenever the contract declares a nested partial mount;
    a completed result without it is rejected.
20. it shows the generated `--inline` handoff verbatim in the chat and records
    `createdExternalIds` for every item the user confirmed creating, so the
    same Tasks are not re-proposed as `create` in a later phase;
21. it records one `renderedSurfaceComparison.surfaces` verdict per surface the
    contract declares in `visualParity`, with concrete observations;
22. a `completed` result never skips a declared surface and never leaves one on
    `deviates` or `not-checked`;
23. it treats visual parity as its own coherent milestone and checkpoint after
    the functional slice is green, so behavior and appearance carry separate
    evidence.
24. its `validation` list contains only the contract's declared test, typecheck
    and build commands plus `verify-checkpoint.mjs` invocations; a manual
    browser-flow or host entry recorded there is rejected.
25. each validation `summary` states what ran and whether it passed, and never
    claims what a green command proves about a contract scenario.
26. it reads a file once at the range it needs, repeats no near-identical
    search, and reads no schema or script source in place of running the
    validator;
27. observation capture evaluates the countable checks against this run's own
    tool history, and an empty list means every check was evaluated and none
    fired rather than that none was looked for.
28. every entry in the contract's `openQuestions` is checked against the slice
    before any product write, and one that prevents implementing produces
    `BLOCKED` rather than a decision taken in this phase.
29. coverage uses the safe measurement the contract's `testGaps` names, and a
    gap that stays unmeasurable is recorded as a limitation rather than left
    silent;
30. a required dependency change is applied exactly as the contract states it,
    at the pinned versions in `packages` and within `paths`, and a version is
    never chosen during this phase;
31. `validationPlan.installCommand` runs after any manifest or configuration
    change and before the test, typecheck and build commands, and is recorded
    in `validation` like any other command;
32. an item stays action `create` while `previousApplication.status` is
    `not-applied`, because `no-change` and `update` both require an
    `externalId`;
33. `migration-result.json` and the work-item handoff are validated in the same
    invocation as the Flow Contract, never alone;
34. the observation sidecar is named `skill-run-observations-flow-migrate.json`
    so it cannot overwrite the baseline's in a shared run directory;
35. typecheck and build run once at the end of a coherent milestone, not after
    every edit, and the targeted test carries the iteration;
36. `renderedSurfaceComparison.surfaces` records `addressed` or `not-addressed`
    at schemaVersion 4 and never a `matches` verdict; the visual judgement is
    `flow-verify`'s;
37. the continuation offers exactly three routes — open the next phase now
    using the host's own mechanism, show the invocation to paste, or save it in
    the run directory as a resumable checkpoint — and never opens a second
    terminal window;
38. artifact pointers come from a script (`seed-work-item.mjs`,
    `new-observations.mjs` or `hash-artifact.mjs`), never from digests computed
    by hand;
39. `references/checkpoints.md` is read only under `auto-local`, and nothing is
    committed under `disabled`;
40. the run starts from `run-context.mjs --save-status` and ends with its
    `--compare`;
41. the work-item snapshot is seeded from the baseline snapshot with
    `seed-work-item.mjs` and finalized with its `--finalize`;
42. the continuation passes every artifact `flow-verify` validates: the
    contract, the migration result and both work-item snapshots.
