---
document: work-item-handoff-protocol
version: 0.4.0
status: experimental
date: 2026-09-08
---

# Work-item handoff protocol v0.4

## Purpose

Translate migration evidence into reviewable Epic, Feature, User Story, Task
and daily standup content without granting the skills access to Targetprocess.
The versioned JSON snapshot is canonical. Generated Markdown is a copy/paste view
for the human operator.

## Phase snapshots

| Phase | Producer | Primary evidence | Purpose |
|---|---|---|---|
| baseline | `flow-baseline` | Flow Contract | Fill initial templates and acceptance criteria |
| migration | `flow-migrate` | Migration result | Report factual implementation progress and checkpoints |
| verification | `flow-verify` | Verification result | Report PASS/FAIL/BLOCKED, push outcome and final proposal |

The migration snapshot hashes the baseline snapshot. The verification snapshot
hashes the migration snapshot. Each later snapshot also records whether the
human confirmed that the previous proposal was applied or not applied. Never
overwrite an earlier snapshot.

A rerun of the same phase is not a phase transition. From schemaVersion 4 a
baseline may declare `supersedes` with the `path`, `sha256` and `runId` of an
earlier baseline for the same flow. This is deliberately separate from
`previousHandoff`, which means "the previous phase, and here is whether the
human applied it". Passing both baselines to the validator in one call makes
the action rules apply between them, so a rerun cannot quietly re-propose
content that never moved. A first baseline for a flow omits the field.

## Actions and identity

Every Epic, Feature, User Story and Task uses `create`, `update` or
`no-change`.

- `create` has a stable local ID but no external ID.
- `update` and `no-change` require the existing external ID.
- `update` is only for an item that actually moved. When every field, the
  proposed state and the proposed progress equal the previous snapshot, the
  action must be `no-change`; the validator rejects a no-op `update`. This is
  what keeps a later handoff short instead of re-emitting content the reader
  has already applied.
- `no-change` must be honest in the other direction too: the validator rejects
  a `no-change` whose fields, proposed state or proposed progress moved.
- unchanged field text is copied from the previous snapshot byte for byte, not
  regenerated. Regenerated prose comes back reworded, and a wording difference
  is indistinguishable from a real change, so the item is forced to `update`
  and the reader re-reviews something that never moved. This is the single
  reason `no-change` was not reaching the board in practice.
- `currentState` and `currentProgress` are never carried forward. They record
  the external board as a human confirmed it for that run.
- `richReleaseNotes` belongs to its own item. It says what changed about that
  Epic, Feature or Story, not what the run did in general. Refreshing it on an
  item the run left alone forces `update` and re-emits the whole item, which
  defeats `no-change` by another route; this run's news belongs on the item
  that moved and in the standup.
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
opens Targetprocess, calls an API or upgrades `copy-ready` based on an
assumption.
For an immutable chain, `previousApplication` in the next phase records the
human-confirmed outcome and repeats the previous handoff hash.

When the previous proposal was actually applied, `previousApplication`
also carries `createdExternalIds`: the ID Targetprocess assigned to each item
the previous snapshot proposed to `create`. Without it the same Tasks are
re-proposed as `create` in every later phase and the chain never converges.
The validator requires a `confirmed-applied` status for the field, requires
each named local ID to have been a `create` in the previous snapshot, and
requires the current snapshot to carry that exact external ID under `update`
or `no-change`.

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
progress as the selected Story and must not claim that Targetprocess was
updated.

## Rendering

Run:

```powershell
node .\scripts\render-work-item-handoff.mjs <snapshot.json>
```

The renderer validates the snapshot and emits fields in Targetprocess template
order. Use `--check` to detect generated Markdown drift.

An item marked `no-change` renders as an identification block — action,
external ID, title and confirmed board state — followed by a line saying not to
touch it. Its field text is not restated in either render, because nobody may
copy it and printing it invites a reader to diff prose that did not move. A
`no-change` User Story still renders its Tasks: Task progress is what moves a
Story, so the Tasks can change while the Story text does not.

That full render is the archived artifact, not the working surface. For the
handoff a human actually reads, run:

```powershell
node .\scripts\render-work-item-handoff.mjs --inline <snapshot.json> --since <previous-snapshot.json>
```

It writes to stdout so a skill can show it inline in the chat at the step that
produced it. It reports only what changed since `--since`, puts each field in
its own fenced block labelled with its Targetprocess field name, and separates
four groups: change, create, still-to-create (unchanged re-proposals) and
explicitly unchanged. Items already created get a `createdExternalIds`
fragment to report back. Without `--since` it falls back to the complete set,
which is correct for a first-phase snapshot — except that a declared
`no-change` is always listed under unchanged, with or without `--since`, since
the validator has already proved that declaration honest.

Show that output verbatim. Its value is that it is generated from the
validated snapshot; a paraphrase reintroduces exactly the drift the canonical
JSON exists to prevent.
