# Flow Contract requirements

Use this reference for every `flow-baseline` run.

## Goal

Create a compact behavioral handoff, not an Angular design. The handoff must
give a later migration run enough evidence to know what may change, what must
remain observable and which unknowns block writing.

## Choosing the slice

The boundary is chosen during the run, not supplied before it. The survey in
step 3 produces the rendered-surface inventory and, for each surface with its
own component, the importers outside this flow's directory. Only then can two or
three candidate boundaries be put side by side, each judged against:

1. **one owner** — every migrated surface belongs to this flow, not to several
   object types;
2. **no shared infrastructure in the write allowlist** — a component other forms
   import stays outside the cut;
3. **a measurable neighbour** — a nested mount needs a `retain-react` sibling to
   compare visual parity against;
4. **bounded branches** — capability gates and mode branches are counted,
   because each one doubles what a later verification must cover.

Asking for the boundary up front makes the human decide before the evidence
exists, and it is why two runs over the same route produced different cuts for
line creation, Delete and the selected-line label. `scope.startState` and
`scope.endState` follow from the chosen candidate; they describe that slice, not
the whole route.

The chosen candidate and the rejected ones are recorded as a `decisions` entry.
The importer counts are not: they are reproducible from the source, and the
decision carries the conclusion.

## What the contract carries, and what it cites

There is no separate baseline report and no draft state. The contract is the
only durable analysis artifact and it is final when written; the run's chat
summary lets a reader check it, and authorizes nothing. Two categories decide
where something belongs.

Carry it in the contract when a later reader cannot recover it from the product
source:

- the write allowlist, and the start and end state that bound the slice;
- the rendered-surface classification, which is a choice about this slice and
  not a fact about the code;
- the target architecture, because the Angular side does not exist yet;
- visual-parity requirements: which surface must match which retained
  counterpart, and along which dimensions;
- scenarios, as the behavior this migration promises to preserve;
- hypotheses that took cross-file reasoning and still need characterizing;
- decisions taken between conflicting sources, and the questions still open;
- validation commands, rollback and checkpoint policy.

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
- `scope` with the start state, the end state and an explicit write allowlist,
  and nothing else. Every path in that allowlist has been checked for consumers
  outside this flow, and it contains a location for the new Angular code; a
  design with nowhere to land cannot be implemented. From schemaVersion 6 there
  is no `includedPaths` and no `excludedPaths`: the inventory below names every
  surface with a citation, the allowlist is the boundary, and the validator
  rejects a contract that restates either as a third path list;
- `renderedSurfaceInventory` with one entry per visible control, conditional
  branch, child component and action, each `migrate`, `retain-react` or
  `excluded` and cited;
- `targetArchitecture` with the mount or embedding mechanism, the ownership
  boundary, the typed adapter
  (`inputs`, `commands`, `events`, `nonSuccessOutcome`, `forbiddenAccess`),
  lifecycle and styling rules and `dependencyChanges`;
- `scenarios` as Given/When/Then observable outcomes with evidence pointers;
- `characterizationRequired` for each unproven hypothesis, with the behavior it
  blocks;
- `decisions` for a choice that shapes what this contract says: the chosen
  boundary, an accepted shared-path risk, a conflict between sources that has
  been resolved. Not why an earlier run was discarded; that is evidence about a
  skill and belongs in `skill-run-observations.json`;
- `testGaps` only for behavior without adequate evidence;
- `openQuestions` for unknowns that cannot be inferred safely;
- `workItemContext` with the existing Epic, Feature and selected User Story
  IDs. Omit the ones that do not exist on the board yet; the matching work-item
  entries then use `create` and the standup omits `storyExternalId`. A
  placeholder ID reads like a real Targetprocess reference and is worse than an
  honest proposal;
- `checkpointPolicy` with `disabled` unless the user asks for `auto-local`,
  which then requires `expectedBranch`, `externalRef` and `milestones`. Only
  `mode` and `pushPolicy` are required otherwise, and `pushPolicy` is `never`
  whenever the mode is `disabled`. Leave an unassigned value absent rather than
  filling it with a placeholder.
  `authorizedByRole` and `authorizedAt` are present only for `auto-local`, and
  `pushPolicy` is `never` whenever the mode is `disabled`;
- `validationPlan` with targeted tests that terminate, typecheck, build, the
  manual verification scenarios and the required host validation. Verification
  is manual, so record what a person walks through rather than a runner to
  automate it;
- `rollback` with concrete scope-preserving instructions: which files return to
  which state, and what a revert must not disturb. Restating that
  `migration-result.json` records the checkpoint SHAs tells `flow-migrate`
  something it already knows and answers nothing.

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
drawer and preserves the declared padding or margin.

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
matters and the safe command and location it would need.

## Review summary and continuation

The run ends at one checkpoint, not at a summary. Build the decision block from
the validated contract instead of from remembered prose, so the human reviews what
`flow-migrate` will actually read:

- `flowId`, the user-visible goal and the included/excluded boundary;
- `scope.partialMount`, including a deliberate `nested: false`;
- every `visualParity` id with the counterpart it must match;
- `scope.allowedWritePaths` verbatim;
- `scope.allowedWritePaths`, because that list is the only thing bounding the
  next phase's writes;
- the test, typecheck and build commands, the manual verification scenarios and
  the rollback;
- `checkpointPolicy`, including `disabled`;
- every open question and decision.

The summary is not a gate. It authorizes nothing and asks for no reply: the
contract it renders is already final. End it by naming what would need a new
run to change, which is the boundary, the write allowlist or a scenario.

Plan mode is a session mode of the host, not something a skill can switch on.
`/plan`, `--plan` and `--mode plan` belong to the user. When the session is
already in plan mode, that mode forbids repository writes until it is exited,
so write the contract and work-item snapshot after that instead of before it.
Their content and validation do not change; only their position in the run does.

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
by the contract path, the work-item handoff path, the
migration-skill-lab root, the product root and the run directory.
`flow-migrate` reads its inputs from those files and never from this chat, so a
saved invocation stays valid for a session opened days later. Keep the
invocation on one line and free of semicolons, which `wt.exe` reads as a
command separator, and prefer paths without spaces over nested quoting.
