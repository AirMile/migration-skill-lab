---
document: skill-handoff-protocol
version: 0.5.3
status: experimental
date: 2026-09-08
---

# Migration handoff protocol v0.5.3

## Purpose

The skills communicate through small, versioned files rather than implicit
chat context. This makes scope, approval, evidence and failures reviewable
between runs.

## Artifact chain

```text
flow-baseline
  -> flow-contract.json
  -> work-item-baseline.json
  -> human approval
  -> migrate-flow
  -> migration-result.json
  -> work-item-migration.json
  -> verify-flow
  -> verification-result.json (PASS)
     -> work-item-verification.json

  OR

  -> verification-result.json (FAIL / repairable BLOCKED)
  -> debug-handoff.json
  -> user-confirmed fresh debug-flow chat
  -> debug-result.json
  -> user-confirmed fresh independent verify-flow chat
```

The work-item artifacts form a supporting immutable sidechain. They produce
copy/paste Epic, Feature, Story, Task and standup updates but never prove that
Targetprocess was changed.

## Storage and confidentiality

- Put human-readable baseline and verification reports in
  `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`.
- Put only compact, non-sensitive JSON artifacts in
  `C:\Project\migration-skill-lab\runs\<run-id>`.
- Keep source code, credentials, tokens and private URLs out of every
  artifact.
- Never create an artifact in the product repository.

## Human gate

`flow-baseline` produces a draft contract. A human must explicitly approve the
scope, acceptance criteria and `allowedWritePaths` before `migrate-flow` can
write product code. `migrate-flow` must stop if the contract or the user input
does not prove that approval.

The same approval may authorize `auto-local` checkpoint commits for the exact
branch, external reference and write allowlist. It does not authorize push.
`verify-flow` may offer one push only after overall `PASS`, passed required
host validation and a visible remote/branch/commit summary.

Draft baseline artifacts are immutable historical evidence. Human approval
creates a separate approved contract and matching baseline handoff; it does not
erase historical pending/open wording. The approved contract records the
approver, approval date and concise resolved decisions. Checkpoint authorization
fields exist only when its mode is `auto-local`.

## Artifact requirements

| Artifact | Producer | Consumer | Required role |
|---|---|---|---|
| `flow-contract.json` | `flow-baseline` | `migrate-flow`, `verify-flow` | Scope and behavior source |
| `migration-result.json` | `migrate-flow` | `verify-flow` | Implementation and validation evidence |
| `verification-result.json` | `verify-flow` | Human reviewer | Independent decision evidence |
| `debug-handoff.json` | `verify-flow` | `debug-flow` | Reproducible failure dossier and repairability |
| `debug-result.json` | `debug-flow` | Fresh `verify-flow` | Finite repair attempt ledger |
| `work-item-baseline.json` | `flow-baseline` | `migrate-flow`, human | Initial Epic-to-Task and standup proposal |
| `work-item-migration.json` | `migrate-flow` | `verify-flow`, human | Factual Task/checkpoint progress |
| `work-item-verification.json` | `verify-flow` | Human | Verified final backlog and standup proposal |

Every artifact has `schemaVersion`, `skillVersion`, `runId`, `flowId` and
revision or content-hash pointers. A consumer rejects an incompatible version,
a mismatched flow, missing artifact or unknown status.

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
or report is complete. This sidecar:

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

`verify-flow` reports `PASS`, `FAIL` or `BLOCKED` per contract scenario. It
does not repair product code. For a local repairable result it writes a
`debug-handoff.json` and asks the user before opening a fresh `/debug-flow`
chat.
`debug-flow` chooses `immediate`, `light` or `heavy`, uses at most one attempt
per tier and writes `debug-result.json`. A repaired result must be checked by a
fresh independent `verify-flow`. External blockers do not start debug. A
contract change requires a new baseline and renewed human approval.

The caller owns the complete workflow, not `verify-flow` itself. It passes only
the declared artifact paths and repository root into the user-confirmed fresh
debug chat. After a repaired result it asks the user before opening another
fresh verifier with the approved contract, migration result and debug result.
The artifact chain remains the fallback when isolated subagents are
unavailable; no skill relies on nested skill invocation or prior chat memory.

## Visual parity

The baseline records observable drawer insets, spacing and input containment.
`verify-flow` evaluates those browser-visible properties in the actual drawer;
the implementation skill does not self-certify them.

The baseline also inventories every rendered control and conditional branch as
`migrate`, `retain-react` or `excluded`. A partial Angular mount is valid only
when it preserves every `retain-react` item in the active parent form.

The baseline declares that shape as `scope.partialMount`. When it is nested,
the validator requires `migrate-flow` to record
`renderedSurfaceComparison.evidenceSource: "real-parent-tree"` and refuses an
overall `PASS` unless `verify-flow` recorded
`browserValidation.evidenceSource: "real-host-layout"`. These replace prose
requirements that an earlier run satisfied on paper while using an isolated
fixture in practice.

## Work-item application loop

`copy-ready` means the generated content is ready for review and manual
application. It is not an external-write result. A later snapshot may use
`confirmed-applied` only after a human confirms what Targetprocess actually
shows. Create proposals never invent an external ID; the next snapshot records
the ID only after the item exists, through
`previousApplication.createdExternalIds`.

Each phase shows its handoff inline in the chat through
`render-work-item-handoff.mjs --inline ... --since <previous snapshot>`, which
reports only what moved. The full Markdown render remains the archived
artifact. See `docs\work-item-handoff-protocol-v0.3.md`.

## Improvement loop

Capture runs after each flow-skill invocation. A full audit runs after the
complete slice, after concrete user feedback, or when evidence recurs. The audit
loads the complete target skill surface, retains all material findings and
requires a numbered human selection before applying any source change.
