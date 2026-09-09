# Flow Contract requirements

Use this reference for every `flow-baseline` run.

## Goal

Create a compact behavioral handoff, not an Angular design. The handoff must
give a later migration run enough evidence to know what may change, what must
remain observable and which unknowns block writing.

## What the contract carries, and what it cites

There is no separate baseline report. The contract is the only durable
analysis artifact, and the run's chat summary is the review surface. Two
categories decide where something belongs.

Carry it in the contract when a later reader cannot recover it from the product
source:

- scope decisions: what is in, what is out, what may be written;
- the rendered-surface classification, which is a choice about this slice and
  not a fact about the code;
- the target architecture, because the Angular side does not exist yet;
- visual-parity requirements: which surface must match which retained
  counterpart, and along which dimensions;
- scenarios, as the behavior this migration promises to preserve;
- hypotheses that took cross-file reasoning and still need characterizing;
- decisions taken between conflicting sources, and the questions still open;
- validation commands, rollback, checkpoint policy and the approval record.

Cite it instead when the product source already holds it:

- how a control behaves today: the conversion arithmetic, the debounce window,
  the history rule, the tab order, the exact spacing tokens. A scenario names
  the behavior and points at the file and line that proves it.
- which controls the current form renders, and under what condition.

The reason is not brevity. A restated mechanism is a copy that silently
disagrees with the source the day someone edits it, and `flow-migrate` opens
that source anyway to write the code. A citation cannot go stale without the
staleness being visible.

## `flow-contract.json`

The artifact must validate against
`schemas/flow-contract.schema.json`. It contains pointers and concise
descriptions only. Do not copy application source into JSON.

Populate:

- `repository` with the inspected root and revision;
- `scope` with non-empty included paths and an explicit write allowlist. Every
  path in that allowlist has been checked for consumers outside this flow, and
  it contains a location for the new Angular code; a design with nowhere to land
  cannot be implemented;
- `renderedSurfaceInventory` with one entry per visible control, conditional
  branch, child component and action, each `migrate`, `retain-react` or
  `excluded` and cited;
- `targetArchitecture` with the ownership boundary, the typed adapter
  (`inputs`, `commands`, `events`, `nonSuccessOutcome`, `forbiddenAccess`),
  lifecycle and styling rules and `dependencyChanges`, at status `proposed`
  until a human approves the contract;
- `scenarios` as Given/When/Then observable outcomes with evidence pointers;
- `characterizationRequired` for each unproven hypothesis, with the behavior it
  blocks;
- `decisions` for a conflict between sources that has been resolved;
- `testGaps` only for behavior without adequate evidence;
- `openQuestions` for unknowns that cannot be inferred safely;
- `approval` as `pending` until a human has explicitly approved the scope.
  The approved successor artifact records the approver role, date and concise
  `approvedDecisions`; it does not rewrite the draft baseline.
- `workItemContext` with the existing Epic, Feature and selected User Story
  IDs. Omit the ones that do not exist on the board yet; the matching work-item
  entries then use `create` and the standup omits `storyExternalId`. A
  placeholder ID reads like a real Targetprocess reference and is worse than an
  honest proposal;
- `checkpointPolicy` with `disabled` until a human approves `auto-local`, which
  the validator refuses unless the contract is already approved. Only `mode` and
  `pushPolicy` are required in a draft; `expectedBranch` and `externalRef`
  become required on approval and `milestones` only for `auto-local`. Leave an
  unassigned value absent rather than filling it with a placeholder.
  `authorizedByRole` and `authorizedAt` are present only for `auto-local`;
- `validationPlan` with targeted tests that terminate, typecheck, build, an
  exact browser
  command and required manual host validation. Drafts may leave owner/command fields absent,
  but approval may not;
- `rollback` with concrete scope-preserving instructions.

`renderedSurfaceInventory` is binding during partial migration. A component may
not replace a parent React form when that would hide an item marked
`retain-react`. Every `migrate` entry needs a `visualParity` entry with the same
id, and `visualParity` may not name anything else.

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

Appearance is a declared acceptance criterion, not a review instruction. From
schemaVersion 4 the contract carries `visualParity`: one entry per migrated
surface with its `id`, the retained `counterpart` it must look like, the
`appearance` requirements (border, radius, icon and label placement, trailing
unit, design tokens instead of literal values) and the `layout` requirements
(width, alignment and spacing against the retained sibling sections). Cite the
counterpart with file and line in `reference` when one exists.

The validator enforces this list downstream: `flow-migrate` must return a
verdict per surface and `flow-verify` must status each one on its own. A
surface that is not declared here can therefore never fail later, so an
appearance difference the user would notice belongs in `visualParity` rather
than in the chat summary. `scope.partialMount` is required too; `nested: false` is
a deliberate statement about the mount shape, not an omission.

When the slice mounts inside a retained React parent, declare it in the
contract as `scope.partialMount` with `nested: true`, the `retainedParent` and
the `siblingSections` a migrated field must match. `flow-migrate` and
`flow-verify` both read that flag to decide whether real-host evidence is
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

## Approval checkpoint and continuation

The run ends at one checkpoint, not at a summary. Build the decision block from
the validated contract instead of from remembered prose, so the human reviews what
`flow-migrate` will actually read:

- `flowId`, the user-visible goal and the included/excluded boundary;
- `scope.partialMount`, including a deliberate `nested: false`;
- every `visualParity` id with the counterpart it must match;
- `scope.allowedWritePaths` verbatim;
- the test, typecheck and build commands, the browser and manual host scenarios
  and the rollback;
- `checkpointPolicy`, including `disabled`;
- every open question, marked blocking or non-blocking.

Offer three replies: approve, reject, or ask a question first. A blocking open
question must be resolved before the approve option is offered at all.
Approval writes a separate approved contract and baseline work-item handoff;
the draft pair stays exactly as it was written.

Plan mode is a session mode of the host, not something a skill can switch on.
`/plan`, `--plan` and `--mode plan` belong to the user. When the session is
already in plan mode, use its plan-approval mechanism for this checkpoint. That
mode also forbids repository writes before approval, so write the contract and
work-item snapshot after the approval instead of before it. Their content and
validation do not change; only their position in the run does.

Then ask which continuation the user wants, and perform only that one:

1. Open a fresh interactive chat now, with the same working directory and
   `--add-dir` arguments this session uses:

   ```powershell
   wt.exe -w 0 nt -d "<working-directory>" copilot -i "<invocation>"
   ```

2. Show `<invocation>` in this chat for the user to paste into a chat they open
   themselves.
3. Save `<invocation>` in the run directory as
   `<flowId>-flow-migrate-prompt.md` for a later session.

`<invocation>` is the same string in all three routes: `/flow-migrate` followed
by the approved contract path, the approved work-item handoff path, the
migration-skill-lab root, the product root and the run directory.
`flow-migrate` reads its inputs from those files and never from this chat, so a
saved invocation stays valid for a session opened days later. Keep the
invocation on one line and free of semicolons, which `wt.exe` reads as a
command separator, and prefer paths without spaces over nested quoting.
