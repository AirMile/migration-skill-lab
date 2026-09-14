---
document: skill-handoff-protocol
version: 0.8.0
status: experimental
date: 2026-09-08
---

# Migration handoff protocol v0.8.0

## Purpose

The skills communicate through small, versioned files rather than implicit
chat context. This makes scope, decisions, evidence and failures reviewable
between runs.

## Artifact chain

```text
flow-baseline
  -> boundary choice from surveyed candidates
  -> flow-contract.json
  -> work-item-baseline.json
  -> review summary
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

- No phase writes a prose report. Each one's JSON artifact is durable and its
  inline summary is where a human checks it; a second copy in Markdown drifts
  the moment either side is edited. A report can be rendered from the validated
  JSON whenever one is wanted, the way `render-work-item-handoff.mjs` renders a
  work-item handoff.
- Put only compact, non-sensitive JSON artifacts in
  `C:\Project\migration-skill-lab\runs\<run-id>`.
- Keep source code, credentials, tokens and private URLs out of every
  artifact.
- Never create an artifact in the product repository.

## Human decisions

`flow-baseline` runs in two parts. It first surveys the route's rendered
surfaces and the importers each one has outside the flow, then puts two or three
candidate boundaries to the user and records the chosen one, with the rejected
ones, as a `decisions` entry. Only then does the deep baseline run. The boundary
is the human decision this pipeline actually needs, and it is taken with the
evidence rather than before it; asking for it up front is what let two runs over
the same route produce different cuts.

Which slice a baseline takes is the decision before that one. `flow-plan`
records the slices the user approved as an ordered `queue` in the migration
map. A `flow-baseline` started without a flow lists what
`run-context.mjs --ready` marks available, queued first, and waits for the
user to confirm one; it never takes a slice on its own. It then claims the
slice with `run-context.mjs --claim`, which creates the run directory
atomically, so baselines in separate chats run side by side and never share a
slice. A contract or a sidecar in that directory closes the claim; an empty one
left behind is freed with `--release`.

There is no approval gate. From schemaVersion 6 a Flow Contract has no `status`
and no `approval`: it is final when it is written, and the validator rejects
those fields. A lab with one operator gained nothing from a draft state, a
successor pair and a checkpoint that asked the same person who had just answered
every question in the run.

What bounds `flow-migrate` is `scope.allowedWritePaths`. That list is the only
control over what an implementation run may touch, so the baseline checks every
path in it for consumers outside the flow and records the trade-off when a
shared one is included anyway. `flow-migrate` refuses every write outside the
list and stops rather than widening it.

Because that list is the only control, it also has to cover every kind of write
the contract asks for: the directory the new framework code lands in, the test
directory the `characterizationRequired` entries need, and every path
`targetArchitecture.dependencyChanges.paths` names. A contract that requires a
change to a file its own allowlist forbids has asked for work it made
impossible, and the validator rejects it.

Settled per-project decisions live in `docs\project-constants.md`, not in a
contract and not in a question. The framework version and the reason for it, the
exact packages, how the framework is compiled and mounted, the change-detection
strategy, the install command, where tests live, how coverage is measured and
the environment a person verifies in are the same for every flow. A skill reads
that page and states that it did. Re-deriving those per run produced the one
failure that kept the pipeline from reaching product code: the mount mechanism
came back as an open question in every contract, and `flow-migrate` reported
`BLOCKED` on it every time.

A dependency change is carried as exact `packages` at pinned versions and
repository-relative `paths`, with `validationPlan.installCommand` saying how it
is applied. `flow-migrate` applies it, runs that install command, and only then
runs the test, typecheck and build commands: a slice that adds packages and
typechecks without installing them fails on missing modules and reports a defect
that does not exist.

`checkpointPolicy` records only what is assigned: `mode` and `pushPolicy`, with
`pushPolicy` `never` whenever the mode is `disabled`. `auto-local` additionally
requires its expected branch, external reference and milestones. It does not
authorize push; `flow-verify` may offer one push only after overall `PASS`,
passed required host validation and a visible remote/branch/commit summary.

Verification is manual. The contract records the scenarios a person walks
through; it does not propose a browser runner, an automation command or an owner
to assign one to.

An Epic, Feature or Story that is not on the board yet is omitted from
`workItemContext` and proposed with `create`. A placeholder that satisfies a
required field while naming something that does not exist is never acceptable,
because a validated artifact is read as fact.

`flow-baseline` ends at one review summary. It renders scope, partial mount, the
rendered-surface inventory, the target architecture, scenario summaries,
required characterization, visual-parity surfaces, the write allowlist,
validation commands, rollback, checkpoint policy, decisions and open questions
from the validated contract. It is the review surface that replaced the baseline
report, so it carries what a reader could disagree with and cites the rest. It
asks for no reply: wanting the boundary, the allowlist or a scenario different
is a reason to run the baseline again.

A host plan mode is a session mode the user controls. A skill never switches it
on. When a session already runs in plan mode, the artifacts are written after it
is exited, because that mode forbids repository writes. The implementation phase
always runs in its own chat: a background agent cannot ask the user the
questions `flow-migrate` needs answered.

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
accepts 3 to 6, `verification-result` accepts 3 and 4, `migration-result`
accepts 2 to 5, and `debug-handoff` accepts 1 and 2. The JSON Schema keeps a newly required field
optional and the validator's rule layer makes it mandatory for the newer
version. Completed runs stay valid at the version they were written under,
which matters because a run's artifacts are immutable
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

Each skill writes `skill-run-observations-<skill>.json` only after its primary
artifact is complete. The filename carries the skill because the phases of one
flow share a run directory; a bare `skill-run-observations.json` means the
second skill to finish overwrites the first one's evidence. Runs recorded before
this convention use the bare name, and `migration-skill-audit` reads both.
This sidecar:

- is validated independently against
  `schemas\skill-run-observations.schema.json`;
- may contain an empty observation list, which asserts that every countable
  check was evaluated and none fired;
- records skill-execution evidence, not product findings;
- cannot change a Flow Contract, migration result or verification status;
- is consumed only by a later `migration-skill-audit`;
- remains immutable after capture.

Observation sidecars are not links in the functional artifact chain. Their
failure is reported separately and never converted into a success-shaped
primary result.

## Failure loop

`flow-verify` conducts the manual validation rather than asking whether
someone has performed it. It builds a walkthrough from the contract's scenarios
and visual parity entries, presents one item at a time with the concrete
control to act on and the expected result stated in the question, and collects
one verdict per item before moving on. The person in the chat is the tester;
there is no separate owner to assign.

The visual verdict belongs to that phase alone. From migration-result
schemaVersion 4 `flow-migrate` records `addressed` or `not-addressed` — what it
did — and `flow-verify` decides `matches` or `deviates`. An automated test in
jsdom is not evidence about padding, spacing or containment, so the phase that
wrote the code cannot also clear its own visual work.

From migration-result schemaVersion 5 `flow-migrate` also records one
`characterization` entry per `characterizationRequired` hypothesis: confirmed
or disproved with the test that settled it, or not-run, which a completed
result cannot contain. `flow-verify` tests the scenarios a disproved
hypothesis names in `proveBefore` explicitly, because they were migrated on a
corrected assumption.

Both phases run the contract's test, typecheck and build commands, and that is
deliberate rather than duplicated: `flow-migrate` runs them as a gate on its
own work, `flow-verify` runs them as the evidence.

`flow-verify` reports `PASS`, `FAIL` or `BLOCKED` per contract scenario. It
does not repair product code. For a local repairable result it writes a
`debug-handoff.json` and asks the user before opening a fresh `/flow-debug`
chat.
`flow-debug` chooses `immediate`, `light` or `heavy`, uses at most one attempt
per tier and writes `debug-result.json`. A repaired result must be checked by a
fresh independent `flow-verify`. External blockers do not start debug. A
contract change requires a new baseline run.

The caller owns the complete workflow, not `flow-verify` itself. It passes only
the declared artifact paths and repository root into the user-confirmed fresh
debug chat. After a repaired result it asks the user before opening another
fresh verifier with the contract, migration result and debug result.
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
the validated snapshot; a run does not write it. See `docs\work-item-handoff-protocol-v0.5.md`.

## Improvement loop

Capture runs after each flow-skill invocation. A full audit runs after the
complete slice, after concrete user feedback, or when evidence recurs. The audit
loads the complete target skill surface, retains all material findings and
requires a numbered human selection before applying any source change.
