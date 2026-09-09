---
document: skill-handoff-protocol
version: 0.7.0
status: experimental
date: 2026-09-08
---

# Migration handoff protocol v0.7.0

## Purpose

The skills communicate through small, versioned files rather than implicit
chat context. This makes scope, approval, evidence and failures reviewable
between runs.

## Artifact chain

```text
flow-baseline
  -> flow-contract.json (draft)
  -> work-item-baseline.json (draft)
  -> approval checkpoint
  -> flow-contract.json (approved)
  -> work-item-baseline.json (approved)
  -> user-chosen fresh flow-migrate chat
  -> flow-migrate
  -> migration-result.json
  -> work-item-migration.json
  -> flow-verify
  -> verification-result.json (PASS)
     -> work-item-verification.json

  OR

  -> verification-result.json (FAIL / repairable BLOCKED)
  -> debug-handoff.json
  -> user-confirmed fresh flow-debug chat
  -> debug-result.json
  -> user-confirmed fresh independent flow-verify chat
```

The work-item artifacts form a supporting immutable sidechain. They produce
copy/paste Epic, Feature, Story, Task and standup updates but never prove that
Targetprocess was changed.

## Storage and confidentiality

- `flow-baseline` writes no report. Its contract is the durable artifact and
  its approval checkpoint is the review surface; a second prose copy of a
  validated artifact only drifts. Put a human-readable verification report in
  `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`.
- Put only compact, non-sensitive JSON artifacts in
  `C:\Project\migration-skill-lab\runs\<run-id>`.
- Keep source code, credentials, tokens and private URLs out of every
  artifact.
- Never create an artifact in the product repository.

## Human gate

`flow-baseline` produces a draft contract. A human must explicitly approve the
scope, acceptance criteria and `allowedWritePaths` before `flow-migrate` can
write product code. `flow-migrate` must stop if the contract or the user input
does not prove that approval.

The same approval may authorize `auto-local` checkpoint commits for the exact
branch, external reference and write allowlist. It does not authorize push.
`flow-verify` may offer one push only after overall `PASS`, passed required
host validation and a visible remote/branch/commit summary.

Draft baseline artifacts are immutable historical evidence. Human approval
creates a separate approved contract and matching baseline handoff; it does not
erase historical pending/open wording. The approved contract records the
approver, approval date and concise resolved decisions. Checkpoint authorization
fields exist only when its mode is `auto-local`.

`flow-baseline` asks for that approval at one checkpoint at the end of its run.
The checkpoint renders scope, partial mount, the rendered-surface inventory,
the proposed target architecture, scenario summaries, required characterization,
visual-parity surfaces, write allowlist, validation commands, rollback,
checkpoint policy, decisions and open questions from the validated contract, and
accepts approve, reject or a question. It is the review surface that replaced
the baseline report, so it carries what a reader could disagree with and cites
the rest. A
blocking open question is resolved before approval is offered. Only after the
approved pair validates does the run offer one continuation the user picks: a
fresh `flow-migrate` chat opened now, the invocation shown for pasting, or the
invocation saved in the run directory.

A host plan mode is a session mode the user controls. A skill never switches it
on. When a session already runs in plan mode, the checkpoint uses that mode's
plan-approval mechanism, and the artifacts are written after approval because
that mode forbids repository writes before it. The implementation phase always
runs in its own chat: a background agent cannot ask for the approvals
`flow-migrate` requires.

## Artifact requirements

| Artifact | Producer | Consumer | Required role |
|---|---|---|---|
| `flow-contract.json` | `flow-baseline` | `flow-migrate`, `flow-verify` | Scope and behavior source |
| `migration-result.json` | `flow-migrate` | `flow-verify` | Implementation and validation evidence |
| `verification-result.json` | `flow-verify` | Human reviewer | Independent decision evidence |
| `debug-handoff.json` | `flow-verify` | `flow-debug` | Reproducible failure dossier and repairability |
| `debug-result.json` | `flow-debug` | Fresh `flow-verify` | Finite repair attempt ledger |
| `work-item-baseline.json` | `flow-baseline` | `flow-migrate`, human | Initial Epic-to-Task and standup proposal |
| `work-item-migration.json` | `flow-migrate` | `flow-verify`, human | Factual Task/checkpoint progress |
| `work-item-verification.json` | `flow-verify` | Human | Verified final backlog and standup proposal |

Every artifact has `schemaVersion`, `skillVersion`, `runId`, `flowId` and
revision or content-hash pointers. A consumer rejects an incompatible version,
a mismatched flow, missing artifact or unknown status.

A schema accepts more than one `schemaVersion` at a time: `flow-contract`
accepts 3, 4 and 5, `verification-result` accepts 3 and 4, `migration-result`
accepts 2 and 3, and `debug-handoff` accepts 1 and 2. The JSON Schema keeps a newly required field
optional and the validator's rule layer makes it mandatory for the newer
version. Completed runs stay valid at the version they were written under,
which matters because a draft baseline and its artifacts are immutable
historical evidence. Skills always write the newest version, so a new run
cannot opt out of the newer rules by staying behind.

Each work-item handoff points to its phase's primary artifact. Migration and
verification handoffs also point to the exact previous work-item snapshot.
They record the human-confirmed applied/not-applied outcome of that previous
snapshot in `previousApplication`. JSON is canonical; rendered Markdown is
generated and must match it.

Tasks carry stakeholder-visible delivery progress. Checkpoint commits are
evidence for an implementation Task, not separate board Tasks. Story progress
is validated from Task contribution weights, and each phase produces a short
daily standup block with the same percentage.

## Diagnostic observation sidecars

Each skill writes `skill-run-observations.json` only after its primary artifact
is complete. This sidecar:

- is validated independently against
  `schemas\skill-run-observations.schema.json`;
- may contain an empty observation list;
- records skill-execution evidence, not product findings;
- cannot change a Flow Contract, migration result or verification status;
- is consumed only by a later `migration-skill-audit`;
- remains immutable after capture.

Observation sidecars are not links in the functional artifact chain. Their
failure is reported separately and never converted into a success-shaped
primary result.

## Failure loop

`flow-verify` reports `PASS`, `FAIL` or `BLOCKED` per contract scenario. It
does not repair product code. For a local repairable result it writes a
`debug-handoff.json` and asks the user before opening a fresh `/flow-debug`
chat.
`flow-debug` chooses `immediate`, `light` or `heavy`, uses at most one attempt
per tier and writes `debug-result.json`. A repaired result must be checked by a
fresh independent `flow-verify`. External blockers do not start debug. A
contract change requires a new baseline and renewed human approval.

The caller owns the complete workflow, not `flow-verify` itself. It passes only
the declared artifact paths and repository root into the user-confirmed fresh
debug chat. After a repaired result it asks the user before opening another
fresh verifier with the approved contract, migration result and debug result.
The artifact chain remains the fallback when isolated subagents are
unavailable; no skill relies on nested skill invocation or prior chat memory.

## Visual parity

The baseline records observable drawer insets, spacing and input containment.
`flow-verify` evaluates those browser-visible properties in the actual drawer;
the implementation skill does not self-certify them.

The baseline also inventories every rendered control and conditional branch as
`migrate`, `retain-react` or `excluded`. A partial Angular mount is valid only
when it preserves every `retain-react` item in the active parent form.

The baseline declares that shape as `scope.partialMount`, which is required
from schemaVersion 4 so that a `nested: false` is a statement rather than an
omission. When it is nested, the validator requires `flow-migrate` to record
`renderedSurfaceComparison.evidenceSource: "real-parent-tree"` and refuses an
overall `PASS` unless `flow-verify` recorded
`browserValidation.evidenceSource: "real-host-layout"`. These replace prose
requirements that an earlier run satisfied on paper while using an isolated
fixture in practice.

Appearance itself is a declared criterion, carried end to end as its own track
rather than as a remark on a functional scenario:

| Phase | Field | Rule |
|---|---|---|
| `flow-baseline` | `visualParity[]` | One entry per migrated surface: retained counterpart, appearance requirements, layout requirements against the sibling sections. |
| `flow-migrate` | `renderedSurfaceComparison.surfaces[]` | One verdict per declared surface. A `completed` result cannot skip one or leave it on `deviates` or `not-checked`. |
| `flow-verify` | `visualCriteria[]` | One status per declared surface. Overall `PASS` needs every one green, on `real-host-layout` evidence under a nested mount. |
| `flow-verify` | `debug-handoff` `source: visual-parity` | An appearance defect routes through the normal repair loop instead of being handled beside the artifact chain. |

The consequence is that a surface nobody declared can never fail later, and a
declared surface cannot pass unnoticed. It closes the case where a verifier
recorded a visible deviation as a styling limitation rather than a failure,
and the case where the appearance defect had no field to live in and was
repaired outside the consumed handoff.

## Work-item application loop

`copy-ready` means the generated content is ready for review and manual
application. It is not an external-write result. A later snapshot may use
`confirmed-applied` only after a human confirms what Targetprocess actually
shows. Create proposals never invent an external ID; the next snapshot records
the ID only after the item exists, through
`previousApplication.createdExternalIds`.

Each phase shows its handoff inline in the chat through
`render-work-item-handoff.mjs --inline ... --since <previous snapshot>`, which
reports only what moved. The full Markdown render is available on demand from
the validated snapshot; a run does not write it. See `docs\work-item-handoff-protocol-v0.4.md`.

## Improvement loop

Capture runs after each flow-skill invocation. A full audit runs after the
complete slice, after concrete user feedback, or when evidence recurs. The audit
loads the complete target skill surface, retains all material findings and
requires a numbered human selection before applying any source change.
