---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Use only with /flow-baseline.
---

# Flow Baseline

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the first stage: it produces the contract every later stage reads.

Skill version: `0.14.0`.

Recommended model: Claude Opus 5. This phase writes the contract that every
later phase depends on.

Analyze one explicitly selected flow. Survey its rendered surfaces, let the
user choose a boundary from evidence rather than up front, then produce a final
`flow-contract.json` carrying the behavior baseline, the surface inventory and
a bounded target-architecture proposal, plus a short review summary in this
chat. Do not implement Angular code or present the proposed architecture as an
established team standard.

The contract is the only durable analysis artifact. Do not write a separate
prose report: everything a later skill needs belongs in the contract, and a
second copy in Markdown drifts out of date the moment either side is edited.

## Required inputs

Confirm before deep analysis:

- one human-selected flow and its user-visible goal;
- migration-skill-lab root containing the validator and schemas;
- product repository root;
- any hard constraint the user already knows, such as a component that must
  not be touched. The boundary itself is not an input: step 4 puts candidate
  boundaries to the user once the survey can show what each one costs;
- whether existing coverage evidence is available. Never offer the product's own
  coverage script: `test:ci` writes a `coverage\` tree and `junit.xml` into the
  product repository, and neither is gitignored, so the run would dirty the
  worktree it is required to leave untouched. Either record the gap, or offer
  one command you have constructed to write outside the product root, naming
  that location.
- the most recent validated work-item handoff for this `flowId`, when one
  exists; it supplies the Epic, Feature and User Story identity, parent
  relations and field text, so ask for those only when no such snapshot exists;
- whether a new Epic, Feature or User Story is requested;
- current User Story Tasks, when any exist; otherwise propose the three
  stakeholder-readable Tasks the handoff protocol fixes;
- declared work-item handoff JSON destination;
- the proposed product branch, external work-item reference and push policy for
  the later migration. Do not offer to enable `auto-local` here: the validator
  refuses `auto-local` without an expected branch and external reference.
  `pushPolicy` is `never` whenever the mode
  is `disabled`: without checkpoints the pipeline creates no commit it could
  push, and `confirm-after-pass` beside a disabled mode reads like a standing
  authorization. Leave the branch, reference and milestones absent when they are
  not yet assigned rather than inventing a placeholder that reads like a real
  value.
- the manual verification scenarios and rollback. Verification is manual: do
  not propose browser automation, a runner, or an owner to assign it to. Record
  what a person walks through, and leave an unresolved value absent rather than
  inventing one.

Derive the test, typecheck and build commands from the product's own
`package.json` rather than asking for them, and verify each one terminates. A
script such as `"test": "vitest"` starts a watcher, so `npm run test -- <file>`
never returns and would hang `flow-migrate`; the run-once form is what belongs
in `validationPlan`. Confirm the derived commands with the user in one line.

Derive the `flowId` and the run directory rather than asking for them. The
`flowId` is the selected flow as a slug; when an earlier artifact for this flow
exists, reuse its exact `flowId` so `supersedes` and `--since` still match. The
run directory is `<migration-skill-lab-root>\runs\<date>-<flowId>-baseline-<n>`.
State both in one line and continue. Ask only when the derived directory already
exists or the flow maps to more than one plausible id.

Also confirm:

- current external board state/progress separately from any proposed
  Task-derived state/progress.

Ask one focused question and stop if the scope is materially ambiguous. Never
choose the flow automatically.

Every question this run asks must have answerable options. Do not offer a route
the validator rejects, a command this skill's own safety boundary forbids, or a
value the run can derive. Resolving that before asking is this skill's job, not
the reader's.

## Workflow

1. Read `references/flow-contract.md`.
2. Capture the product revision and Git-visible worktree status. A dirty
   worktree is evidence, not permission to change it.
3. Read only relevant configuration, entry points, direct consumers, tests,
   stories and documentation. Follow dependencies only when they determine the
   selected flow's behavior or risk.
   Record a rendered-surface inventory for the selected route in the contract
   as `renderedSurfaceInventory`: every visible control, conditional capability
   branch, child component and action gets an `id`, a `surface` name, a status
   of `migrate`, `retain-react` or `excluded`, and a `reference` citation. Give
   the classification, not the mechanics: the condition under which a control
   renders is in the cited source, and a prose copy of it goes stale as soon as
   that source changes. `flow-migrate` compares this list against the real
   render tree, so a surface missing here is a surface nobody checks.
   For every surface rendered by its own component, search the product for
   importers outside this flow's directory and cite them. One search per
   component, and it is the single fact that makes a boundary judgeable: a
   control with a dozen external importers is shared infrastructure wherever it
   happens to sit on screen. Leave the counts out of the contract; they are
   reproducible from the source, and the boundary decision carries the
   conclusion.
4. Put two or three materially different boundaries to the user and let them
   choose. Scope is not an input to this run: the evidence that decides where to
   cut only exists once step 3 is done, so asking for it up front makes the
   human decide blind and forces this skill to reopen the question halfway.
   Give each candidate its `migrate` set, its `retain-react` neighbours, how
   many external importers its write allowlist would touch, the conditional
   branches it takes on, and what existing test evidence covers it. Judge each
   one against four criteria and say plainly where it fails:
   - one owner: every migrated surface belongs to this flow rather than to
     several object types;
   - no shared infrastructure in the write allowlist: a component with external
     importers does not belong inside the cut;
   - a measurable neighbour: a nested mount needs a `retain-react` sibling to
     compare visual parity against;
   - bounded branches: count capability gates and mode branches, because each
     one doubles the surface a later verification has to cover.
   This is the one question this skill may ask that it could partly answer
   itself. It is a real trade-off, and it arrives with the evidence rather than
   before it. Honour any hard constraint the user already stated, and never
   widen a boundary they ruled out.
   Record the outcome as a `decisions` entry: `topic` the slice boundary,
   `decision` the chosen candidate, `rationale` why, and `followUp` naming what
   a later slice picks up. The rejected candidates then live in the record
   instead of in chat history.
5. Label material conclusions `Confirmed`, `Inference` or `Open question`.
   Cite every confirmed repository claim with file and line.
6. Inventory existing relevant tests and map them to behavior. Use existing
   coverage artifacts when available. Do not generate coverage output inside
   the product repository. If approved measurement is unavailable, state the
   coverage gap and required safe measurement instead of guessing.
7. Record a focused target-architecture proposal for only the selected flow in
   the contract as `targetArchitecture`: `boundary.angularOwns` and
   `boundary.reactRetains`, the typed `adapter` with its `inputs`, `commands`,
   `events`, `nonSuccessOutcome` and `forbiddenAccess`, the `lifecycle` rules
   for mount, unmount and cancellation, the `styling` rules, and
   `dependencyChanges`. `boundary.angularOwns`, `boundary.reactRetains`,
   `adapter.inputs`, `adapter.commands`, `adapter.events`,
   `adapter.forbiddenAccess`, `lifecycle` and `styling` are each an array of
   strings; `adapter.nonSuccessOutcome` is one string; `dependencyChanges` is an
   object with a boolean `required` and an optional `paths` array and `note`.
   Preserve current boundaries where they are sound; do not mirror React
   mechanically or redesign the whole app.
   Name where the new Angular code lands, and put that path in
   `scope.allowedWritePaths`. A contract that describes a component without a
   directory to create it in cannot be implemented: `flow-migrate` refuses every
   write outside the allowlist, so the design would be recorded and then
   immediately unimplementable.
   This is the one part of the analysis that is not recoverable from the
   product source, because the Angular side does not exist yet. Left out of the
   contract it is simply lost, and `flow-migrate` asks a human to invent it a
   second time.
   Read the product's dependency manifest before filling in
   `dependencyChanges`, and cite it. When the target framework is absent there,
   `required` is `true` and the manifest, lockfile, build-config and TypeScript
   paths belong in `paths`; a first slice cannot mount a framework the product
   does not have. Never write `required: false` on the assumption that earlier
   slices already added it: that is a claim about the codebase, and an unchecked
   claim here hides the largest decision the migration needs.
   The mount or embedding mechanism is part of `targetArchitecture`, not a
   detail under it. While it is unresolved the architecture is unresolved, so it
   belongs in `openQuestions` and `flow-migrate` will report `BLOCKED` on it.
   Do not describe it as something a later phase can settle in passing.
   Capture observable visual parity (including layout insets, spacing, input
   containment and a reference screenshot when available). Mark every
   unresolved choice as an open question.
   Check whether the product already has a component-rendering harness, such as
   Storybook or an existing end-to-end runner, and name it in
   `validationPlan.browserValidation` when it does. An existing harness needs no
   owner and no tooling decision, so proposing an unassigned browser runner
   beside one is a gap this skill created rather than found. Verification is
   manual, so record what a person walks through rather than a command to
   automate it.
   A partial Angular mount may replace only inventory items marked `migrate`;
   it must remain inside the existing parent form when siblings are marked
   `retain-react`. Record that shape in the contract as
   `scope.partialMount`: set `nested: true` with the `retainedParent` and the
   `siblingSections` a migrated field must visually match. This field is what
   later makes real-host evidence mandatory for `flow-migrate` and
   `flow-verify`, so an omitted or wrongly `false` value silently weakens both.
   From schemaVersion 4 `scope.partialMount` is required: declaring
   `nested: false` is a deliberate statement, not something to leave out.
   Record every migrated surface in `visualParity` with its `id`, the retained
   `counterpart` it must look like, the concrete `appearance` requirements
   (border, radius, icon and label placement, trailing unit, design tokens
   rather than literal values) and the `layout` requirements (width, alignment
   and spacing against the retained sibling sections). Cite the counterpart
   with file and line in `reference` when one exists. Appearance that is not
   declared here cannot be verified later, so anything a user would notice
   belongs in this list. Every `migrate` inventory id needs a `visualParity`
   entry with the same id, and no other id may appear there; the validator
   enforces both directions.
   Record a reasoned-but-unproven risk as a `characterizationRequired` entry
   with its `hypothesis`, the `proveBefore` behavior it blocks and its
   `evidence`. A hypothesis that took cross-file reasoning to reach is not
   something a later skill re-derives by reading one file, so it belongs in the
   contract rather than in a sentence buried among test gaps.
   Record a resolved conflict between sources as a `decisions` entry with its
   `topic`, `decision`, `rationale` and any `followUp`. An open conflict stays
   an open question instead.
8. When current behavior differs from a plausible improvement, do not choose
   silently. Ask one focused product question with these routes:
   - preserve current behavior for migration;
   - include the improvement in this Story and revise its acceptance criteria;
   - preserve current behavior and propose a separate follow-up Story.
   Keep the contract pending until the answer is recorded.
9. Write `flow-contract.json` in the declared run directory at schemaVersion 6
   and validate it
   with `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<flow-contract.json>"`. Write no analysis report, and no other file in
   the product repository or the notes vault.
10. The contract is final when you write it. schemaVersion 6 has no `status`,
   no `approval` and no `targetArchitecture.status`, and the validator rejects
   them; there is no draft state and no approval gate to wait for. What bounds
   the next phase is `scope.allowedWritePaths`, so that list carries the weight
   the gate used to: every path in it has been checked for consumers outside
   this flow, and nothing is in it that the slice does not need.
   Before recording `scope.allowedWritePaths`, check each existing file for
   consumers outside this flow. A component that other forms import is shared
   infrastructure, and putting it in the allowlist authorizes changes whose
   blast radius reaches surfaces this contract marks `retain-react`. Either
   leave it out, or record a `decisions` entry saying which consumers were
   considered and why the risk is accepted. Apply this to every path, not only
   to the one control that prompted the question.
   Record checkpoint mode as `disabled` unless the user asks for `auto-local`,
   which then needs its expected branch and external reference. The contract
   carries concrete test, typecheck and build commands and a rollback; those are
   what `flow-migrate` runs, so an absent one is a missing input rather than an
   open question. An unresolved decision stays in `openQuestions`, and
   `flow-migrate` reports `BLOCKED` when one of them prevents implementing.
11. Write `work-item-baseline.json` after the Flow Contract. Populate the
   Epic, Feature and User Story templates from cited baseline evidence, use
   `create`, `update` or `no-change` honestly, and keep
   `manualApplication.status` at `copy-ready` or `not-applied`. Propose a new
   story only when the user requests it or evidence shows the selected scope
   does not responsibly fit the existing story.
   An item that is not on the board yet uses `create` and carries no external
   ID, and the contract's `workItemContext` omits it on that side too; the
   standup then omits `storyExternalId` as well. Never invent a placeholder such
   as `"0"` to satisfy a required field: a validated artifact that names a
   Targetprocess ID which does not exist is worse than one that says the item is
   still a proposal. Ask for the real ID when the item does exist.
   When a previous validated handoff exists for this `flowId`, copy each
   unchanged `fields` value from it byte for byte and set that item's action to
   `no-change`. Rewriting settled text produces a wording difference that is
   indistinguishable from a real change, which forces `update`, re-emits the
   whole item and asks a reader to re-review something that did not move. Use
   `update` only for an item whose content, proposed state or proposed progress
   actually moved, and say in `evidence` what moved it. Record the earlier
   snapshot in `supersedes` with its path, sha256 and `runId`, and set
   `schemaVersion` 4 when you do; the validator then rejects both a no-op
   `update` and a `no-change` that hides a real change. A first baseline for a
   flow has no predecessor and omits `supersedes`.
   `currentState` and `currentProgress` are never carried forward. They are the
   external board as the user confirmed it for this run.
   Run narrative belongs to the item that actually moved. `richReleaseNotes`
   describes what changed about that item, not what this run did in general, so
   an Epic or Feature whose scope did not change keeps its previous notes and
   stays `no-change`. Rewriting them anyway forces `update` and re-emits the
   whole item, which is the same waste by another route. The Story, its Tasks
   and the standup carry this run's news.
12. Create or update stakeholder-readable User Story Tasks for the behavior
   baseline, bounded implementation and independent manual verification. Assign
   explicit contribution percentages totaling 100 and derive User Story
   progress from Task progress. Link checkpoint milestone IDs to the
   implementation Task; do not create one Task per commit.
   The baseline Task is complete when the contract validates and its scenarios
   and decisions are visible; there is no approval gate left for it to hold
   open. The three Task kinds and
   the requirement that their weights total 100 are fixed by the handoff
   protocol, so propose the weights rather than asking whether to create the
   Tasks at all.
13. Keep confirmed current board values separate from proposed calculated
    values. A copy-ready proposal does not change current progress.
14. Add a daily standup block with completed work, next steps, blockers and
    both current and proposed User Story progress. Keep it short enough to say
    aloud.
15. Validate the Flow Contract and work-item snapshot together, passing the
   superseded baseline handoff as well when this run declares `supersedes`.
   Run
   `node "<migration-skill-lab-root>\scripts\render-work-item-handoff.mjs" --inline "<snapshot.json>"`,
   appending `--since "<previous-handoff.json>"` when a predecessor exists. The
   flag comes before the path; the reverse order makes the script look for a
   file named `--inline`. Show its
   output verbatim in this chat as the handoff for this step. Do not also write
   the full Markdown render: it is derivable from the validated snapshot at any
   time, so writing it during the run only creates a second file to keep in
   step. Do not paraphrase, summarize or reformat it; its value is
   that it is generated from the validated snapshot rather than from prose.
   Items the snapshot marks `no-change` are listed by identity only; do not
   restate their field text in chat to be helpful. Never claim that anything
   was applied.
16. Capture the product Git-visible worktree status again. If it changed, stop,
   report the delta and do not revert or attribute it without evidence.
17. Present one review summary. This block replaces the analysis report, so it
   has one job: let the reader see whether the analysis is right. It is not a
   gate and it authorizes nothing; the contract is already final and the write
   allowlist is what bounds `flow-migrate`. Render it from the validated
   contract, never from remembered prose, and include only what a reader could
   disagree with:
   - the `flowId`, boundary and `scope.partialMount` shape;
   - `renderedSurfaceInventory` as one line per surface with its status, since
     a control classified wrongly is the cheapest error to catch here and the
     most expensive to catch later;
   - `targetArchitecture` boundary and adapter in a few lines;
   - each scenario id with a one-line summary, so the reader sees which
     behaviors are being promised;
   - every `characterizationRequired` hypothesis, because an inference is where
     this analysis is most likely to be wrong;
   - `allowedWritePaths`, because that list is the only thing that bounds the
     next phase's writes, plus the test, typecheck and build commands, the
     manual verification scenarios, rollback and checkpoint policy;
   - every open question and decision.
   Do not restate confirmed behavior or its citations: a reader checks those by
   opening the cited line, and repeating them here only buries the parts that
   need judgment. Do not ask the reader to approve anything. Keep the block
   short enough to read in one screen, and end it by naming what would need a
   new run to change: the boundary, the write allowlist, or a scenario. Wanting
   any of those different is a reason to run the baseline again, not a reply to
   collect here.
   When the host already runs this session in plan mode, that mode forbids
   repository writes until it is exited, so the artifacts are written after it
   is. Their content and validation do not change; only their position in the
   run does. A skill cannot set the session mode: never enter or leave plan mode
   on the user's behalf.
18. Ask which continuation the user wants and perform only the chosen one:
   open a fresh interactive `/flow-migrate` chat now, show the invocation here
   for the user to paste into a chat they open themselves, or save it in the
   run directory for later. All three routes carry the same invocation,
   built from the contract path, the work-item handoff path,
   the migration-skill-lab root, the product root and the run directory; see
   `references/flow-contract.md`. Launch a chat only on that explicit choice,
   and report a refused or failed launch instead of describing the migration as
   started. Never continue the migration in this chat and never delegate it to
   a background agent, which cannot ask the user the questions `flow-migrate`
   needs answered.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out files in
  the product repository;
- write tests or product code;
- install dependencies, alter lockfiles, configuration or environment files;
- start persistent services or make external writes;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data in artifacts;
- write an analysis report, a rendered work-item Markdown file or any other
  file besides the contract, the work-item snapshot and the observation
  artifact in the declared run directory;
- edit this skill, its references or any installed skill snapshot during a run;
- present unapproved Angular conventions as target requirements.
- update Targetprocess through a browser, API or other external write;
- create an external work-item ID or mark a handoff `confirmed-applied`
  without the user's confirmation;
- invent Task progress independently of the validated weighted calculation;
- create one board Task per technical commit instead of grouping checkpoints
  under a stakeholder-readable delivery Task;
- silently convert a possible UX improvement into accepted migration behavior;
- create an empty or product checkpoint commit during this read-only phase;
- enter, leave or simulate a host plan mode;
- present the review summary as a gate, or ask the reader to approve anything;
- put a path in `scope.allowedWritePaths` that the chosen slice does not need:
  that list is the only thing bounding the next phase's writes;
- start the migration in this chat, in a background agent, or through any
  route the user did not choose;
- reword settled Epic, Feature, User Story or Task text that no evidence in
  this run shows changed, or restate a `no-change` item's fields in chat;
- carry a previous snapshot's `currentState` or `currentProgress` forward as
  if it were a fresh read of the external board.

## Handoff

The contract must contain the scope, rendered-surface inventory, target
architecture, behavior scenarios, visual parity, required characterization,
evidence pointers, test gaps, decisions, open questions, allowed product write
paths, Epic/Feature/Story context and checkpoint policy.
`work-item-baseline.json` contains the copy/paste hierarchy, Tasks and
daily standup proposal. Both are machine-readable inputs to `flow-migrate`; do
not rely on prior chat context or on a document a later skill cannot read.

Carry decisions, agreements and unproven hypotheses; cite everything else.
Confirmed current behavior lives in the product source, so a scenario names the
behavior and points at the file and line that proves it. Restating the
mechanism in the contract creates a copy that is wrong the moment the source
changes, and `flow-migrate` has to open that source anyway to write the code.

The run ends at one review summary and then exactly one continuation the user
picks: a fresh `/flow-migrate` chat opened now, the invocation shown for
pasting, or the invocation saved in the run directory for later. The summary
authorizes nothing, because the contract it renders is already final. What
bounds the next phase is `scope.allowedWritePaths`; wanting the boundary, that
allowlist or a scenario different is a reason to run the baseline again.

A scenario list alone is not permission to replace a parent component that
renders retained controls; `renderedSurfaceInventory` is what carries that
limit into the migration.

## Reading discipline

Context is a budget this run spends once, and every re-read of the same bytes
is paid again for nothing.

- Read a file once, at the range you need. Return to it only for a range you
  have not read; never re-read it whole after reading part of it, and never
  request a range overlapping one you already hold.
- Widen or narrow a search rather than repeating it. Two patterns that differ
  only in alternation, wording or case return mostly the same hits, so the
  second one buys nothing.
- Do not read `schemas\` or `scripts\` source to learn an artifact's shape.
  Copy the shape from `examples\handoff\`, write the artifact, run
  `validate-handoff.mjs` and act on its errors; the validator names what is
  missing far more cheaply than a schema read does. When an error names a rule
  but not the fix, and one more attempt does not resolve it, reading the rule in
  `scripts\validate-handoff.mjs` is the cheaper route: record it as an
  observation so the message gets improved instead of the next run guessing too.
- Resolve a module path before reading it. A directory may be a barrel or a
  single file, so check which exists instead of guessing and failing.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the baseline workflow to analyze these signals.

After the draft Flow Contract and work-item snapshot are complete, or after the
final `BLOCKED` or failed response when those artifacts cannot be produced:

1. Evaluate this run's own tool history against these checks and record every
   one that fired. They are countable, so answer them from the history rather
   than from impression:
   - the same file read more than twice, or re-read over a range already
     held: `unnecessary-context-load`;
   - two or more searches whose patterns differ only in alternation, wording
     or case: `unnecessary-context-load`;
   - a schema, validator or renderer source read instead of running the
     command: `unnecessary-context-load`;
   - a tool call that failed because this skill named a path, command or flag
     that does not exist or does not behave as written:
     `skill-caused-tool-failure`;
   - a step performed by hand that a script in `scripts\` already performs:
     `deterministic-step-candidate`;
   - a user correction, a restated instruction, or the same question asked
     twice: `user-correction` or `ambiguous-instruction`;
   - an artifact that needed a repair pass before it validated:
     `output-mismatch`.
2. Exclude product defects, expected precondition blockers, missing Angular
   conventions themselves, preferences and static speculation. Executor noise
   means a host or transport failure unrelated to this skill; a tool call this
   skill's own wording caused is never executor noise.
3. Deduplicate semantically equivalent signals from this run and preserve their
   occurrence count. Do not cap the number of material observations.
4. Write `<run-artifact-directory>\skill-run-observations.json`. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations.json>"`.
6. Report a capture or validation failure separately without changing the
   primary Flow Contract status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
