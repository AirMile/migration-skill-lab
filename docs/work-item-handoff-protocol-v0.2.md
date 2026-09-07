---
document: work-item-handoff-protocol
version: 0.2.0
status: experimental
date: 2026-09-07
---

# Work-item handoff protocol v0.2

## Purpose

Translate migration evidence into reviewable Epic, Feature, User Story, Task
and daily standup content without granting the skills access to TopDesk. The
versioned JSON snapshot is canonical. Generated Markdown is a copy/paste view
for the human operator.

## Phase snapshots

| Phase | Producer | Primary evidence | Purpose |
|---|---|---|---|
| baseline | `flow-baseline` | Flow Contract | Fill initial templates and acceptance criteria |
| migration | `migrate-flow` | Migration result | Report factual implementation progress and checkpoints |
| verification | `verify-flow` | Verification result | Report PASS/FAIL/BLOCKED, push outcome and final proposal |

The migration snapshot hashes the baseline snapshot. The verification snapshot
hashes the migration snapshot. Each later snapshot also records whether the
human confirmed that the previous proposal was applied or not applied. Never
overwrite an earlier snapshot.

## Actions and identity

Every Epic, Feature, User Story and Task uses `create`, `update` or
`no-change`.

- `create` has a stable local ID but no external ID.
- `update` and `no-change` require the existing external ID.
- every Feature points to the parent Epic local ID;
- every User Story points to the parent Feature local ID;
- every Task points to the parent User Story local ID;
- when the Feature already exists, each story also carries the matching parent
  external ID;
- a new story is proposed only by explicit request or evidence-backed scope
  splitting, never merely to distribute implementation tasks.

When analysis finds a possible behavior improvement, the handoff remains open
until a human chooses to preserve current behavior, include the improvement in
the active Story, or propose a separate follow-up Story.

The Epic handoff contains a copyable structure comment. Suggested future
Stories remain hierarchy proposals until a human creates them; no external IDs
are invented.

## Tasks and checkpoints

Tasks describe stakeholder-visible delivery, not individual Git operations.
For the migration flow, prefer:

1. establish the behavior baseline and approve the Flow Contract;
2. add React evidence and implement the bounded Angular slice;
3. independently verify automated and required host behavior.

Checkpoint commits are evidence on the implementation Task. Do not create one
Task per commit.

Each Task has a `contributionPercent`; all Tasks under one Story must total
100. User Story progress is the rounded weighted average of Task progress.
The validator rejects a hand-entered Story percentage that does not match.
A Task is `Done` exactly when its progress is 100%. A Story can be `Done` only
when all child Tasks are `Done`.

Each Story contains exactly one Task of each type: `baseline`,
`implementation` and `verification`. Only the implementation Task may list
checkpoint milestones.

## Manual application

Allowed states are:

- `copy-ready`: ready for review and manual paste;
- `not-applied`: explicitly not applied;
- `confirmed-applied`: a human confirmed the external result.

Only `confirmed-applied` carries confirmer role and timestamp. A skill never
opens TopDesk, calls an API or upgrades `copy-ready` based on an assumption.
For an immutable chain, `previousApplication` in the next phase records the
human-confirmed outcome and repeats the previous handoff hash.

## State and progress rules

Every work item records confirmed `currentState`/`currentProgress` separately
from calculated `proposedState`/`proposedProgress`. A copy-ready handoff never
changes the current values. A later immutable snapshot may update current
values only after a human confirms the external board.

Proposed state and percentage are derived from primary evidence. A migration
checkpoint may increase proposed progress but cannot prove completion. Only a
verification snapshot may propose `Done`, and only when overall verification
and required host validation pass.

The broader Feature can remain in progress when one bounded User Story is
done. The Epic can likewise contain multiple Features. Do not derive Feature
or Epic completion from one child Story.

## Daily standup

Each phase snapshot contains a short update for the active User Story:

- completed since the previous update;
- next work;
- current blockers or decisions;
- confirmed current board progress and proposed Task-derived Story progress;
- one short spoken summary.

This block is copy/paste support for daily communication. It must use the same
progress as the selected Story and must not claim that TopDesk was updated.

## Rendering

Run:

```powershell
node .\scripts\render-work-item-handoff.mjs <snapshot.json>
```

The renderer validates the snapshot and emits fields in TopDesk template
order. Use `--check` to detect generated Markdown drift.
