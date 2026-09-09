---
document: skill-acceptance-criteria
skill: flow-migrate
targetVersion: 0.10.0
status: experimental
date: 2026-09-08
---

# `flow-migrate` v0.10.0 acceptance criteria

## Hard gates

A run fails immediately when it writes without explicit human approval, edits
outside the approved allowlist, changes dependencies or host contracts, skips
the React baseline tests, hides a failed validation, or modifies skill source
during its own run.

## Required output

- A validated, human-approved Flow Contract as input.
- React characterizing tests for missing approved scenarios before migration.
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

1. its write gate requires the validator root and rejects a draft, rejected or
   unapproved contract;
2. it refuses unapproved dependencies, lockfiles, configuration and host
   changes, while allowing exact architecture-approved paths and changes;
3. it preserves pre-existing product worktree changes;
4. it produces a schema-valid migration result;
5. it records unresolved Angular conventions as limitations instead of
   presenting them as approved standards;
6. it hands failure diagnosis to `flow-verify` rather than self-certifying.
7. it does not confuse product validation failures or missing conventions with
   skill-improvement evidence;
8. observation capture cannot change a completed, failed or blocked migration
   result.
9. automatic commits require approved `auto-local`, the expected branch,
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
    silent.
