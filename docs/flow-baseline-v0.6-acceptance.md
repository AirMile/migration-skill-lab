---
document: skill-acceptance-criteria
skill: flow-baseline
targetVersion: 0.6.0
status: experimental
date: 2026-09-08
---

# `flow-baseline` v0.6.0 acceptance criteria

## Hard gates

A run fails immediately if it changes the product repository, invents a
selected flow, omits a material uncertainty, makes an uncited confirmed
repository claim, writes a contract as approved without human approval, or
stores sensitive content.

## Required output

- A feature boundary with explicit exclusions and confidence.
- A behavior baseline covering applicable success, error, state, side-effect
  and cleanup behavior.
- A cited evidence ledger with `Confirmed`, `Inference` and `Open question`.
- Existing relevant tests, their proved behavior and prioritized evidence gaps.
- A draft report and `flow-contract.json` that validate against the handoff
  schema.
- A before/after Git-visible product worktree comparison.
- A schema-valid observation artifact written after the primary artifacts,
  including an empty observation list when no concrete skill signal occurred.
- A schema-valid baseline work-item snapshot and deterministic copy/paste
  Markdown with Epic/Feature/Story/Task identity, fields, state and progress.
- Task contribution weights totaling 100, calculated Story progress and a
  concise daily standup block with separate current/proposed percentages.
- A bounded Detail Drawer target-architecture proposal that does not mirror
  React mechanically or redesign the full frontend.
- A disabled or explicitly human-approved checkpoint policy with exact branch,
  external reference and push policy.
- A machine-readable validation plan and rollback; approval is impossible
  while required test, typecheck, build or host details are absent.

## Acceptance check

The source is acceptable when:

1. it requires a human-selected flow, migration-skill-lab root and explicit
   report/run locations;
2. it cannot write product code or tests;
3. it produces a draft, never self-approved, Flow Contract;
4. it refuses unsupported Angular target claims;
5. its example artifact validates with `validate-handoff.mjs`;
6. its source does not alter `migration-analyze` v0.1.
7. it excludes product findings, expected blockers, convention gaps and
   unproven causality from skill observations;
8. an observation-capture failure is visible but does not rewrite the Flow
   Contract status.
9. it never updates Targetprocess or presents `copy-ready` as externally
   applied;
10. it proposes a new story only after explicit request or evidence-backed
    scope splitting and never invents an external ID;
11. it creates no product or empty checkpoint commit in the read-only phase.
12. it groups technical checkpoints under stakeholder-readable Tasks instead
    of creating one Task per commit;
13. Story progress is derived from Task contributions, never guessed.
14. current board progress is never overwritten by a copy-ready proposal;
15. browser automation and Maui host smoke validation stay separate.
16. a possible behavior improvement triggers one explicit preserve/include/
    follow-up choice and remains open until answered.
17. it preserves draft pending/open wording as immutable history and requires a
    separate approved successor artifact with resolved decisions.
18. it records visual parity requirements, including drawer insets and input
    containment, for independent browser verification.
19. it ends by offering a user-confirmed fresh `/migrate-flow` chat rather than
    starting an implementation subagent.
20. it inventories every rendered child control and conditional branch as
    `migrate`, `retain-react` or `excluded` before proposing a partial mount.
21. it declares `scope.partialMount` with `retainedParent` and
    `siblingSections` whenever the proposed slice mounts inside a retained
    React parent, because both downstream skills read that flag to decide
    whether real-host evidence is mandatory.
22. it shows the generated `--inline` handoff verbatim in the chat rather than
    a paraphrase, so the copy/paste content comes from the validated snapshot.
