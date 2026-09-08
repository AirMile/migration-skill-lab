# Flow Contract requirements

Use this reference for every `flow-baseline` run.

## Goal

Create a compact behavioral handoff, not an Angular design. The handoff must
give a later migration run enough evidence to know what may change, what must
remain observable and which unknowns block writing.

## Required baseline report sections

Use this order:

1. Scope and feature boundary: user goal, start/end state, included paths,
   exclusions and confidence.
2. Behavior baseline: happy path, validation, errors, loading/empty/recovery,
   keyboard interaction, state mutation, persistence, side effects and cleanup.
   Mark non-applicable categories explicitly.
3. Evidence ledger: cited Confirmed evidence, Inferences with validation steps,
   contradictions and Open questions with owner, impact and blocker phase.
4. Existing test evidence and gaps: what assertions prove, observed execution
   when available, manual checks, coverage evidence and evidence priority.
5. Migration handoff: scenarios, allowed write paths, approval required before
   writing, validation commands and rollback constraints.
6. Sprint-backlog handoff: current Epic/Feature/Story/Task identity and
   relations, proposed field content, state/progress, manual application
   status, daily standup and any evidence-backed create proposal.
7. Target architecture: a bounded proposal for component ownership, typed
   adapter, state, mount/unmount, styling, browser automation, Maui smoke
   validation and exact dependency/build paths. Do not redesign the full app.
   Include a rendered-surface inventory that marks every child control and
   conditional branch as `migrate`, `retain-react` or `excluded`.

## `flow-contract.json`

The artifact must validate against
`schemas/flow-contract.schema.json`. It contains pointers and concise
descriptions only. Do not copy application source into JSON.

Populate:

- `repository` with the inspected root and revision;
- `baselineReport` with the persisted report path and SHA-256;
- `scope` with non-empty included paths and an explicit write allowlist;
- `scenarios` as Given/When/Then observable outcomes with evidence pointers;
- `testGaps` only for behavior without adequate evidence;
- `openQuestions` for unknowns that cannot be inferred safely;
- `approval` as `pending` until a human has explicitly approved the scope.
  The approved successor artifact records the approver role, date and concise
  `approvedDecisions`; it does not rewrite the draft baseline.
- `workItemContext` with the existing Epic, Feature and selected User Story
  IDs;
- `checkpointPolicy` with `disabled` until a human approves `auto-local`, the
  exact branch, external reference, milestone IDs and post-PASS push policy.
  `authorizedByRole` and `authorizedAt` are present only for `auto-local`;
- `validationPlan` with targeted tests, typecheck, build, an exact browser
  command and required manual host validation. Drafts may leave owner/command fields absent,
  but approval may not;
- `rollback` with concrete scope-preserving instructions.

The baseline report's rendered-surface inventory is binding during partial
migration. A component may not replace a parent React form when that would hide
an item marked `retain-react`.

## Work-item handoff

Write `work-item-baseline.json` against
`schemas/work-item-handoff.schema.json` after the Flow Contract. The snapshot
must point to the exact Flow Contract hash and map scenarios to the Epic,
Feature and User Story template fields. Add stakeholder-readable child Tasks
whose contribution weights total 100, calculate Story progress from those
Tasks, and include a daily standup block using the same percentage. Render it
to Markdown with
`scripts/render-work-item-handoff.mjs`, then show the `--inline` output in the
chat as the handoff for that step.

Targetprocess remains human-in-the-loop. `copy-ready` means the proposal is
ready to paste, not that it was applied. Only a later snapshot may record
`confirmed-applied`, and only after the user explicitly confirms the real
external state. Always render confirmed current state/progress separately from
the proposed Task-derived values.

## Visual parity

Record the source layout insets, spacing, input bounds and visual test evidence
as observable behavior. A framework boundary does not inherit React wrapper
styles; require browser verification that the replacement stays within the
drawer and preserves the approved padding or margin.

When the slice mounts inside a retained React parent, declare it in the
contract as `scope.partialMount` with `nested: true`, the `retainedParent` and
the `siblingSections` a migrated field must match. `migrate-flow` and
`verify-flow` both read that flag to decide whether real-host evidence is
mandatory, so leaving it out weakens the two downstream checks without any
visible error.

## Coverage discipline

Coverage is evidence about executed code, not proof of correct behavior.
Prioritize missing tests by user risk, integration boundary and missing
scenario evidence. A global percentage must not substitute for a per-flow
baseline.

If a coverage report is not already available, do not create product-repository
artifacts merely to obtain one. State the unavailable measurement, why it
matters and the safe command/location the human must approve.
